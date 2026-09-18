# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['D:/Proyectos Ingeap/Ingeap/Registro de viajes - Inventario/main.py'],
    pathex=[],
    binaries=[],
    datas=[('D:/Proyectos Ingeap/Ingeap/Registro de viajes - Inventario/frontend/dist', 'frontend/dist'), ('D:/Proyectos Ingeap/Ingeap/Registro de viajes - Inventario/backend/credentials.json', 'backend')],
    hiddenimports=['uvicorn.logging', 'uvicorn.loops', 'uvicorn.loops.auto', 'uvicorn.protocols', 'uvicorn.protocols.http', 'uvicorn.protocols.http.auto', 'uvicorn.protocols.websockets', 'uvicorn.protocols.websockets.auto', 'uvicorn.lifespan', 'uvicorn.lifespan.on', 'webview', 'pystray', 'PIL', 'reportlab', 'reportlab.lib', 'reportlab.lib.colors', 'reportlab.lib.pagesizes', 'reportlab.platypus', 'reportlab.lib.styles', 'gspread', 'google.oauth2.service_account', 'fastapi', 'starlette', 'clr_loader', 'pythonnet'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='Ingeap-Inventario',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
