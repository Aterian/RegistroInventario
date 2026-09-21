# =========================================================
# Ingeap - Desinstalador Oficial
# Sistema de Gestión de Inventario y Viajes Multiproyecto
# =========================================================

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "     Desinstalacion de Ingeap Inventario                     " -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Yellow

# 1. Cerrar procesos en ejecucion
$Running = Get-Process -Name "IngeapInventario" -ErrorAction SilentlyContinue
if ($Running) {
    Write-Host "Cerrando aplicacion en ejecucion..." -ForegroundColor Cyan
    $Running | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$ProgramsPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Programs)

# 2. Eliminar acceso directo del Escritorio
$ShortcutDesktop = Join-Path $DesktopPath "Ingeap - Gestion de Inventario.lnk"
if (Test-Path $ShortcutDesktop) {
    Remove-Item $ShortcutDesktop -Force -ErrorAction SilentlyContinue
    Write-Host " [OK] Acceso directo eliminado del Escritorio." -ForegroundColor White
}

# 3. Eliminar acceso directo del Menú de Inicio
$ShortcutMenu = Join-Path $ProgramsPath "Ingeap - Gestion de Inventario.lnk"
if (Test-Path $ShortcutMenu) {
    Remove-Item $ShortcutMenu -Force -ErrorAction SilentlyContinue
    Write-Host " [OK] Acceso directo eliminado del Menu de Inicio." -ForegroundColor White
}

# 4. Eliminar autoinicio del Registro de Windows
$RegistryPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
try {
    Remove-ItemProperty -Path $RegistryPath -Name "IngeapInventario" -ErrorAction SilentlyContinue
    Write-Host " [OK] Registro de inicio automatico eliminado." -ForegroundColor White
} catch {
}

Write-Host "============================================================" -ForegroundColor Yellow
Write-Host " Desinstalacion completada con exito." -ForegroundColor Green
Write-Host " (Los datos locales en AppData se han conservado por seguridad)" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""
Start-Sleep -Seconds 3
