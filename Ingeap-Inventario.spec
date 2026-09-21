# -*- mode: python ; coding: utf-8 -*-
import os
import sys

block_cipher = None
base_dir = SPECPATH

added_files = [
    (os.path.join(base_dir, "frontend", "dist"), "frontend/dist"),
    (os.path.join(base_dir, "backend", "config.json"), "backend"),
    (os.path.join(base_dir, "backend", "assets"), "backend/assets"),
]

# Agregar credentials.json si existe en backend
creds_path = os.path.join(base_dir, "backend", "credentials.json")
if os.path.exists(creds_path):
    added_files.append((creds_path, "backend"))

hidden_imports = [
    "clr",
    "clr_loader",
    "pythonnet",
    "webview",
    "webview.platforms.winforms",
    "webview.platforms.edgechromium",
    "pystray",
    "pystray._win32",
    "PIL",
    "PIL.Image",
    "PIL.ImageDraw",
    "reportlab",
    "reportlab.lib",
    "reportlab.lib.colors",
    "reportlab.lib.pagesizes",
    "reportlab.platypus",
    "reportlab.lib.styles",
    "gspread",
    "google.auth",
    "google.oauth2.service_account",
    "googleapiclient.discovery",
    "googleapiclient.http",
    "sqlite3",
    "fastapi",
    "uvicorn",
    "starlette",
]

a = Analysis(
    [os.path.join(base_dir, 'main.py')],
    pathex=[base_dir],
    binaries=[],
    datas=added_files,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='IngeapInventario',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=os.path.join(base_dir, 'backend', 'assets', 'icon.ico'),
)
