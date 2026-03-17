# Script para detener el Sistema de Restaurante
# Ejecutar con: powershell -ExecutionPolicy Bypass -File detener.ps1

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  🛑 DETENIENDO SISTEMA" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# Detener Backend (Node.js)
Write-Host "🔄 Deteniendo Backend (Node.js)..." -ForegroundColor Cyan
$nodeProcess = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcess) {
    Stop-Process -Name node -Force
    Write-Host "   ✅ Backend detenido" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  Backend no estaba corriendo" -ForegroundColor Gray
}

# Detener Frontend (Python)
Write-Host "🔄 Deteniendo Frontend (Python)..." -ForegroundColor Cyan
$pythonProcesses = Get-Process python -ErrorAction SilentlyContinue
if ($pythonProcesses) {
    Stop-Process -Name python -Force
    Write-Host "   ✅ Frontend detenido" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  Frontend no estaba corriendo" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ SISTEMA DETENIDO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Presiona cualquier tecla para cerrar..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
