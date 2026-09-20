@echo off
setlocal
title Compilador del Instalador - Ingeap Inventario

echo ============================================================
echo   Compilacion de Sistema de Inventario - Ingeap S.A.
echo ============================================================
echo.

set "ROOT_DIR=%~dp0"
set "FRONTEND_DIR=%ROOT_DIR%frontend"
set "INSTALADOR_DIR=%ROOT_DIR%instalador"

echo [1/3] Compilando Frontend React (Vite)...
cd /d "%FRONTEND_DIR%"
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Fallo la compilacion del Frontend Vite.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Empaquetando Aplicacion Principal con PyInstaller...
cd /d "%ROOT_DIR%"
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
)
call pyinstaller --clean --distpath "%INSTALADOR_DIR%" Ingeap-Inventario.spec
if %errorlevel% neq 0 (
    echo [ERROR] Fallo el empaquetado de IngeapInventario.exe.
    pause
    exit /b %errorlevel%
)

echo.
echo [3/3] Empaquetando Instalador Autonomo de Archivo Unico...
call pyinstaller --clean --distpath "%INSTALADOR_DIR%" backend\Instalador_Ingeap_Inventario.spec
if %errorlevel% neq 0 (
    echo [ERROR] Fallo el empaquetado del Instalador.
    pause
    exit /b %errorlevel%
)

echo.
echo ============================================================
if exist "%INSTALADOR_DIR%\Instalador_Ingeap_Inventario.exe" (
    echo   Compilacion finalizada exitosamente!
    echo   Ejecutable App:        instalador\IngeapInventario.exe
    echo   Instalador Autonomo:   instalador\Instalador_Ingeap_Inventario.exe
) else (
    echo [ERROR] No se encontro el instalador generado en %INSTALADOR_DIR%.
)
echo ============================================================
echo.
pause
