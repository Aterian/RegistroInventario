import os
import sys
import subprocess
from pathlib import Path

ROOT = Path(__file__).parent.resolve()

def build():
    # 1. Asegurar que frontend/dist esté al día
    dist_dir = ROOT / "frontend" / "dist"
    if not (dist_dir / "index.html").exists():
        print("Compilando frontend Vite...")
        subprocess.run(["npm", "run", "build"], cwd=str(ROOT / "frontend"), check=True, shell=True)

    # 2. Configurar recursos a empaquetar
    add_datas = [
        f'{ROOT / "frontend" / "dist"};frontend/dist',
    ]

    creds = ROOT / "backend" / "credentials.json"
    if creds.exists():
        add_datas.append(f'{creds};backend')

    hidden_imports = [
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "webview",
        "pystray",
        "PIL",
        "reportlab",
        "reportlab.lib",
        "reportlab.lib.colors",
        "reportlab.lib.pagesizes",
        "reportlab.platypus",
        "reportlab.lib.styles",
        "gspread",
        "google.oauth2.service_account",
        "fastapi",
        "starlette",
        "clr_loader",
        "pythonnet"
    ]

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name=Ingeap-Inventario",
        "--onefile",
        "--windowed",
        "--clean",
    ]

    for d in add_datas:
        cmd.extend(["--add-data", d])

    for hi in hidden_imports:
        cmd.extend(["--hidden-import", hi])

    cmd.append(str(ROOT / "main.py"))

    print("Iniciando compilación con PyInstaller...")
    subprocess.run(cmd, cwd=str(ROOT), check=True)
    print("\n¡Ejecutable generado con éxito en dist/Ingeap-Inventario.exe!")

if __name__ == "__main__":
    build()
