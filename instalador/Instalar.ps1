# =========================================================
# Ingeap - Instalador Oficial
# Sistema de Gestión de Inventario y Viajes Multiproyecto
# =========================================================

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "============================================================" -ForegroundColor Red
Write-Host "     Instalador Oficial - Ingeap Inventario v1.1.0          " -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Red
Write-Host ""

# 1. Rutas del sistema
$LocalApp = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::LocalApplicationData)
$TargetDir = Join-Path $LocalApp "Ingeap\Inventario"
$SourceDir = $PSScriptRoot
$ExeSource = Join-Path $SourceDir "IngeapInventario.exe"
$ExeTarget = Join-Path $TargetDir "IngeapInventario.exe"

# 2. Verificar existencia del ejecutable
if (!(Test-Path $ExeSource)) {
    Write-Host "[ERROR] No se encontro IngeapInventario.exe en: $SourceDir" -ForegroundColor Red
    pause
    exit 1
}

# 3. Cerrar procesos previos
$Running = Get-Process -Name "IngeapInventario" -ErrorAction SilentlyContinue
if ($Running) {
    Write-Host "Cerrando versiones previas en ejecucion..." -ForegroundColor Cyan
    $Running | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# 4. Crear directorio destino en LocalAppData
if (!(Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

Write-Host "1. Copiando aplicacion a LocalAppData..." -ForegroundColor Yellow
Copy-Item -Path $ExeSource -Destination $ExeTarget -Force

# Copiar archivos de configuracion y credenciales si existen en el origen o en backend
$RootProject = Split-Path -Parent $SourceDir
$CredsSource = Join-Path $RootProject "backend\credentials.json"
$CredsTarget = Join-Path $TargetDir "credentials.json"
if (Test-Path $CredsSource) {
    Copy-Item -Path $CredsSource -Destination $CredsTarget -Force
}

$ConfigSource = Join-Path $RootProject "backend\config.json"
$ConfigTarget = Join-Path $TargetDir "config.json"
if ((Test-Path $ConfigSource) -and !(Test-Path $ConfigTarget)) {
    Copy-Item -Path $ConfigSource -Destination $ConfigTarget -Force
}

# 5. Desbloquear permisos de Windows SmartScreen
Unblock-File -LiteralPath $ExeTarget -ErrorAction SilentlyContinue

# 6. Crear accesos directos
Write-Host "2. Creando accesos directos..." -ForegroundColor Yellow
$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$ProgramsPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Programs)

$ShortcutDesktop = Join-Path $DesktopPath "Ingeap - Gestion de Inventario.lnk"
$ShortcutMenu = Join-Path $ProgramsPath "Ingeap - Gestion de Inventario.lnk"

$WshShell = New-Object -ComObject WScript.Shell

$s1 = $WshShell.CreateShortcut($ShortcutDesktop)
$s1.TargetPath = $ExeTarget
$s1.WorkingDirectory = $TargetDir
$s1.Description = "Ingeap Inventario - Control de Viajes y Stock"
$s1.IconLocation = "$ExeTarget,0"
$s1.Save()

$s2 = $WshShell.CreateShortcut($ShortcutMenu)
$s2.TargetPath = $ExeTarget
$s2.WorkingDirectory = $TargetDir
$s2.Description = "Ingeap Inventario - Control de Viajes y Stock"
$s2.IconLocation = "$ExeTarget,0"
$s2.Save()

Write-Host "   [OK] Acceso directo en Escritorio creado." -ForegroundColor Green
Write-Host "   [OK] Acceso directo en Menu Inicio creado." -ForegroundColor Green

# 7. Registrar inicio automatico con Windows
Write-Host "3. Configurando inicio automatico con Windows..." -ForegroundColor Yellow
$RegistryPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
try {
    Set-ItemProperty -Path $RegistryPath -Name "IngeapInventario" -Value "`"$ExeTarget`"" -Force
    Write-Host "   [OK] Registro de auto-inicio configurado." -ForegroundColor Green
} catch {
    Write-Host "   [ADVERTENCIA] No se pudo configurar el inicio automatico: $_" -ForegroundColor DarkYellow
}

# 8. Iniciar la aplicacion instalada
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " ¡Instalacion completada con exito!" -ForegroundColor White
Write-Host " Iniciando la aplicacion..." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Green

# Limpiar variables de entorno de PyInstaller por seguridad
$env:PYINSTALLER_RESET_ENVIRONMENT = "1"
Start-Process -FilePath "explorer.exe" -ArgumentList "`"$ExeTarget`""

Write-Host ""
