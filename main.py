import os
import sys
import time
import socket
import threading
import argparse
import logging
import subprocess
from pathlib import Path

import webview
import pystray
from PIL import Image, ImageDraw

from backend.config import (
    DATA_DIR,
    STATIC_DIR,
    COLOR_PRIMARY_RED,
    recurso_path,
    IS_FROZEN,
    cargar_configuracion
)
from backend.database import init_db
from backend.api_bridge import ApiBridge, APP_VERSION
from backend.google_service import google_service

# 1. Manejo seguro de logs y flujos en entornos sin consola
LOG_FILE = DATA_DIR / "app_runtime.log"

class SafeLogWriter:
    def __init__(self, target_path):
        self.target_path = Path(target_path)
        self._file = None

    def _get_file(self):
        if self._file is None:
            try:
                self.target_path.parent.mkdir(parents=True, exist_ok=True)
                self._file = open(self.target_path, "a", encoding="utf-8", buffering=1)
            except Exception:
                pass
        return self._file

    def write(self, s):
        f = self._get_file()
        if f:
            try:
                f.write(s)
                f.flush()
            except Exception:
                pass

    def flush(self):
        f = self._get_file()
        if f:
            try:
                f.flush()
            except Exception:
                pass

if sys.stdout is None or sys.stderr is None:
    safe_writer = SafeLogWriter(LOG_FILE)
    if sys.stdout is None:
        sys.stdout = safe_writer
    if sys.stderr is None:
        sys.stderr = safe_writer

handlers = []
if sys.stderr is not None and not isinstance(sys.stderr, SafeLogWriter):
    handlers.append(logging.StreamHandler(sys.stderr))
try:
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    handlers.append(logging.FileHandler(LOG_FILE, encoding="utf-8"))
except Exception:
    pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=handlers if handlers else None
)
logger = logging.getLogger("ingeap.main")

_mutex_instancia = None

def asegurar_instancia_unica():
    """
    Garantiza una única instancia activa en Windows utilizando un Mutex nombrado.
    Si ya hay otra instancia, restaura su ventana y finaliza el proceso duplicado.
    """
    global _mutex_instancia
    if sys.platform != "win32":
        return

    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        ERROR_ALREADY_EXISTS = 183
        MUTEX_NAME = "Local\\IngeapInventario_App_SingleInstance_Mutex"

        _mutex_instancia = kernel32.CreateMutexW(None, False, MUTEX_NAME)
        ultimo_error = kernel32.GetLastError()

        if ultimo_error == ERROR_ALREADY_EXISTS:
            try:
                user32 = ctypes.windll.user32
                hwnd = user32.FindWindowW(None, "Ingeap - Gestión de Inventario y Viajes")
                if hwnd:
                    user32.ShowWindow(hwnd, 9)  # SW_RESTORE
                    user32.SetForegroundWindow(hwnd)
            except Exception:
                pass
            sys.exit(0)
    except Exception as e:
        logger.warning(f"[InstanciaUnica] Aviso verificando mutex: {e}")

def asegurar_inicio_automatico():
    """Registra la aplicación en el Registro de Windows (HKCU/Run) si está congelada en .exe."""
    if getattr(sys, "frozen", False) and sys.platform == "win32":
        try:
            import winreg
            exe_path = sys.executable
            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Run",
                0,
                winreg.KEY_SET_VALUE
            )
            winreg.SetValueEx(key, "IngeapInventario", 0, winreg.REG_SZ, f'"{exe_path}"')
            winreg.CloseKey(key)
        except Exception as e:
            logger.warning(f"[AutoStart] Error registrando en Windows Run: {e}")

def obtener_icono_tray():
    """Genera o carga el icono corporativo rojo para la bandeja del sistema."""
    ruta_assets = recurso_path("backend/assets")
    for f_nom in ["icon.png", "app.ico"]:
        cand = ruta_assets / f_nom
        if cand.exists():
            try:
                return Image.open(str(cand))
            except Exception:
                pass

    # Icono en memoria con estilo corporativo Ingeap (#cc3333)
    img = Image.new("RGBA", (64, 64), color=(0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([(4, 4), (60, 60)], radius=14, fill=COLOR_PRIMARY_RED)
    # Letra I estilizada
    draw.rectangle([(26, 16), (38, 48)], fill="white")
    draw.rectangle([(18, 16), (46, 22)], fill="white")
    draw.rectangle([(18, 42), (46, 48)], fill="white")
    return img

def run_headless_server():
    """Modo servidor puro (FastAPI / Uvicorn) para despliegues en contenedores o Cloud."""
    import uvicorn
    from backend.config import SERVER_HOST, SERVER_PORT
    from backend.main_api import app
    logger.info(f"Iniciando API headless en {SERVER_HOST}:{SERVER_PORT}...")
    uvicorn.run(app, host=SERVER_HOST, port=SERVER_PORT, log_level="info")

def main():
    parser = argparse.ArgumentParser(description="Ingeap Inventario Desktop & Cloud Service")
    parser.add_argument("--server-only", action="store_true", help="Inicia únicamente el servidor FastAPI headless.")
    parser.add_argument("--dev", action="store_true", help="Apunta la ventana al servidor de desarrollo de Vite (localhost:5173).")
    args = parser.parse_args()

    # 1. Modo servidor headless opcional
    if args.server_only:
        init_db()
        run_headless_server()
        return

    # 2. Inicialización de escritorio nativo (estilo ReporteDiario)
    asegurar_inicio_automatico()
    init_db()

    # Precarga y sincronización de catálogos en segundo plano
    threading.Thread(target=lambda: google_service.get_catalogos(recargar=False), daemon=True).start()

    api_bridge = ApiBridge()

    # Determinar URL de la interfaz React
    index_html = STATIC_DIR / "index.html"
    if args.dev or not index_html.exists():
        target_url = "http://localhost:5173"
        logger.info(f"Modo desarrollo: conectando PyWebView a {target_url}")
    else:
        target_url = str(index_html.resolve())
        logger.info(f"Cargando frontend empaquetado desde {target_url}")

    ventana = webview.create_window(
        title="Ingeap - Gestión de Inventario y Viajes",
        url=target_url,
        js_api=api_bridge,
        width=1280,
        height=820,
        resizable=True,
        min_size=(900, 650)
    )

    if ventana is None:
        raise RuntimeError("No se pudo instanciar la ventana de PyWebView.")

    api_bridge.set_ventana(ventana)

    # 3. Configuración de Bandeja del Sistema (pystray)
    icono_img = obtener_icono_tray()
    tray_icon = None

    def mostrar_ventana(icon=None, item=None):
        if ventana:
            ventana.show()
            try:
                ventana.restore()
            except Exception:
                pass

    def ocultar_ventana(icon=None, item=None):
        if ventana:
            ventana.hide()

    def sincronizar_catalogo(icon=None, item=None):
        threading.Thread(target=lambda: google_service.get_catalogos(recargar=True), daemon=True).start()
        if tray_icon and hasattr(tray_icon, "notify"):
            try:
                tray_icon.notify("Sincronización con Google Sheets iniciada en segundo plano.", "Ingeap Inventario")
            except Exception:
                pass

    def comprobar_actualizacion_menu(icon=None, item=None):
        res = api_bridge.verificar_actualizacion()
        if res.get("actualizacion_disponible"):
            mostrar_ventana()
            if tray_icon and hasattr(tray_icon, "notify"):
                try:
                    tray_icon.notify(f"Nueva versión {res.get('version_nueva')} disponible.", "Actualización Ingeap")
                except Exception:
                    pass
        else:
            if tray_icon and hasattr(tray_icon, "notify"):
                try:
                    tray_icon.notify(f"Tienes la versión más reciente ({APP_VERSION}).", "Ingeap Inventario")
                except Exception:
                    pass

    def salir_programa(icon=None, item=None):
        if tray_icon:
            tray_icon.stop()
        if ventana:
            ventana.events.closing.clear()
            ventana.destroy()
        os._exit(0)

    menu = pystray.Menu(
        pystray.MenuItem("Abrir Inventario", mostrar_ventana, default=True),
        pystray.MenuItem("Sincronizar con Google Sheets", sincronizar_catalogo),
        pystray.MenuItem("Comprobar Actualizaciones", comprobar_actualizacion_menu),
        pystray.MenuItem("Ocultar en Bandeja", ocultar_ventana),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Salir", salir_programa)
    )

    tray_icon = pystray.Icon(
        "IngeapInventario",
        icono_img,
        "Ingeap - Gestión de Inventario",
        menu
    )

    def al_cerrar():
        """Minimiza a la bandeja del sistema en lugar de cerrar el proceso."""
        if ventana:
            ventana.hide()
        return False

    ventana.events.closing += al_cerrar

    # Ejecutar icono de bandeja en hilo desacoplado
    tray_icon.run_detached()

    logger.info("Iniciando bucle de ventana PyWebView (edgechromium)...")
    webview.start(gui="edgechromium")

    try:
        if tray_icon:
            tray_icon.stop()
    except Exception:
        pass

if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    asegurar_instancia_unica()
    main()
