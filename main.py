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

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ingeap.main")

def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    """Verifica si el puerto ya está ocupado."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((host, port)) == 0

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
    """Ejecuta el servidor FastAPI con Uvicorn."""
    logger.info(f"Iniciando servidor FastAPI en {SERVER_HOST}:{SERVER_PORT}...")
    from backend.main_api import app
    uvicorn.run(app, host=SERVER_HOST, port=SERVER_PORT, log_level="info")

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

    # Iniciar Uvicorn en hilo concurrente en segundo plano
    server_thread = threading.Thread(target=run_uvicorn, daemon=True)
    server_thread.start()

    # Esperar a que el servidor backend esté respondiendo
    time.sleep(1.2)

    # Determinar si cargamos Vite dev server o frontend/dist/index.html
    target_url = f"http://localhost:{SERVER_PORT}"
    dist_index = STATIC_DIR / "index.html"

    if is_port_in_use(5173):
        target_url = args.dev_url
        logger.info(f"Detectado servidor Vite en ejecución. Apuntando PyWebView a {target_url}")
    elif dist_index.exists():
        target_url = f"http://localhost:{SERVER_PORT}"
        logger.info(f"Frontend compilado detectado en {dist_index}. Apuntando PyWebView a {target_url}")
    else:
        target_url = f"http://localhost:{SERVER_PORT}"
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
