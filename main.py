import os
import sys
import time
import socket
import threading
import argparse
import logging
from pathlib import Path

import uvicorn
from PIL import Image, ImageDraw

from backend.config import SERVER_HOST, SERVER_PORT, COLOR_PRIMARY_RED, PROJECT_ROOT, STATIC_DIR

# 1. Manejo seguro de flujos en entornos empaquetados (--windowed / sin consola)
IS_FROZEN = getattr(sys, 'frozen', False)
LOG_FILE = PROJECT_ROOT / "data" / "app_runtime.log"

class SafeLogWriter:
    def __init__(self, target_path):
        self.target_path = target_path
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

# 2. Configurar logging tanto a consola (si existe) como a archivo permanente
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

def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    """Verifica si el puerto ya está ocupado."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((host, port)) == 0

def wait_for_server(port: int, host: str = "127.0.0.1", timeout: float = 35.0) -> bool:
    """Espera activamente a que el servidor FastAPI esté escuchando y responda conexiones."""
    logger.info(f"Comprobando disponibilidad del backend en {host}:{port}...")
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with socket.create_connection((host, port), timeout=0.5):
                logger.info(f"Backend activo y respondiendo en {host}:{port} tras {time.time() - start_time:.2f}s.")
                return True
        except (OSError, ConnectionRefusedError):
            time.sleep(0.25)
    logger.error(f"Tiempo de espera agotado ({timeout}s) esperando al servidor en {host}:{port}.")
    return False

def create_tray_image():
    """Genera un icono en memoria para la bandeja de sistema."""
    img = Image.new("RGBA", (64, 64), color=(0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Dibujar circulo/cuadrado con color rojo corporativo #cc3333
    draw.rounded_rectangle([(4, 4), (60, 60)], radius=12, fill=COLOR_PRIMARY_RED)
    # Dibujar letra 'I' blanca
    draw.rectangle([(26, 16), (38, 48)], fill="white")
    draw.rectangle([(18, 16), (46, 22)], fill="white")
    draw.rectangle([(18, 42), (46, 48)], fill="white")
    return img

def run_uvicorn():
    """Ejecuta el servidor FastAPI con Uvicorn de forma segura en un hilo."""
    logger.info(f"Iniciando servidor FastAPI en {SERVER_HOST}:{SERVER_PORT}...")
    try:
        from backend.main_api import app
        config = uvicorn.Config(
            app=app,
            host=SERVER_HOST,
            port=SERVER_PORT,
            log_level="info",
            access_log=False
        )
        server = uvicorn.Server(config)
        # Desactivar instalación de signal handlers en hilos secundarios (requerido en Windows)
        server.install_signal_handlers = lambda: None
        server.run()
    except Exception as e:
        logger.exception(f"Error crítico en servidor Uvicorn: {e}")

def setup_tray(window):
    """Configura el icono en la bandeja del sistema con PyStray."""
    try:
        import pystray
        
        def on_show(icon, item):
            window.show()
            window.restore()

        def on_hide(icon, item):
            window.hide()

        def on_exit(icon, item):
            icon.stop()
            window.destroy()
            sys.exit(0)

        menu = pystray.Menu(
            pystray.MenuItem("Mostrar Ventana", on_show, default=True),
            pystray.MenuItem("Minimizar a Bandeja", on_hide),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Salir de Ingeap", on_exit)
        )

        icon_img = create_tray_image()
        tray_icon = pystray.Icon("IngeapInventario", icon_img, "Ingeap - Inventario y Viajes", menu)
        
        tray_thread = threading.Thread(target=tray_icon.run, daemon=True)
        tray_thread.start()
        logger.info("Icono de bandeja de sistema (PyStray) activado.")
    except Exception as e:
        logger.warning(f"No se pudo inicializar PyStray para bandeja de sistema: {e}")

def main():
    parser = argparse.ArgumentParser(description="Ingeap - Sistema de Inventario y Viajes")
    parser.add_argument("--server-only", action="store_true", help="Ejecutar solo el servidor FastAPI sin ventana PyWebView")
    parser.add_argument("--dev-url", type=str, default="http://localhost:5173", help="URL del frontend en desarrollo")
    args = parser.parse_args()

    # Si se pide solo servidor
    if args.server_only:
        run_uvicorn()
        return

    # Verificar si el backend ya estaba en ejecución
    server_already_running = is_port_in_use(SERVER_PORT, host="127.0.0.1")
    if not server_already_running:
        server_thread = threading.Thread(target=run_uvicorn, daemon=True)
        server_thread.start()

        # Esperar activamente a que el backend esté listo antes de abrir PyWebView
        server_ready = wait_for_server(SERVER_PORT, host="127.0.0.1", timeout=35.0)
        if not server_ready:
            logger.warning("El backend demoró más de 35s. Abriendo ventana igualmente...")
    else:
        logger.info(f"Puerto {SERVER_PORT} ya activo. Conectando ventana a la instancia existente.")

    # Target URL: Usar siempre 127.0.0.1 para evitar que Edge WebView2 intente resolver IPv6 (::1) y falle
    target_url = f"http://127.0.0.1:{SERVER_PORT}"
    dist_index = STATIC_DIR / "index.html"

    if is_port_in_use(5173, host="127.0.0.1"):
        target_url = args.dev_url
        logger.info(f"Detectado servidor Vite en ejecución. Apuntando PyWebView a {target_url}")
    elif dist_index.exists():
        target_url = f"http://127.0.0.1:{SERVER_PORT}"
        logger.info(f"Frontend compilado detectado en {dist_index}. Apuntando PyWebView a {target_url}")
    else:
        target_url = f"http://127.0.0.1:{SERVER_PORT}"
        logger.info(f"Apuntando PyWebView a backend raíz {target_url}")

    # Inicializar PyWebView en el hilo principal
    try:
        import webview

        window = webview.create_window(
            title="Ingeap - Control de Inventario y Viajes Multiproyecto",
            url=target_url,
            width=1280,
            height=820,
            min_size=(900, 600),
            text_select=True,
            confirm_close=False
        )

        # Configurar bandeja
        setup_tray(window)

        logger.info("Iniciando ventana de escritorio PyWebView...")
        webview.start(debug=False)
    except Exception as e:
        logger.error(f"No se pudo iniciar la interfaz gráfica PyWebView: {e}")
        logger.info("Continuando en modo servidor. Presione Ctrl+C para salir.")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Servidor detenido.")

if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    main()
