[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$taskName  = "SistemaRestaurante"
$scriptPath = Join-Path $PSScriptRoot "iniciar.ps1"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AUTOARRANQUE - Sistema de Restaurante" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$existente = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existente) {
    Write-Host "[!] El autoarranque YA esta configurado." -ForegroundColor Yellow
    Write-Host ""
    $respuesta = Read-Host "Deseas quitarlo? (s/n)"
    if ($respuesta -eq 's' -or $respuesta -eq 'S') {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host ""
        Write-Host "[OK] Autoarranque eliminado. El sistema ya no iniciara automaticamente." -ForegroundColor Green
    } else {
        Write-Host "[OK] Sin cambios." -ForegroundColor Gray
    }
} else {
    # Crear la tarea programada
    $action = New-ScheduledTaskAction `
        -Execute    "powershell.exe" `
        -Argument   "-WindowStyle Hidden -NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`" -Silencioso" `
        -WorkingDirectory $PSScriptRoot

    # Disparador: al iniciar sesión el usuario actual
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -ExecutionTimeLimit 0 `
        -MultipleInstances IgnoreNew

    try {
        Register-ScheduledTask `
            -TaskName  $taskName `
            -Action    $action `
            -Trigger   $trigger `
            -Settings  $settings `
            -RunLevel  Highest `
            -Force | Out-Null

        Write-Host "[OK] Listo! El sistema arrancara automaticamente al iniciar Windows." -ForegroundColor Green
        Write-Host ""
        Write-Host "Para quitarlo, ejecuta este archivo nuevamente." -ForegroundColor Yellow
    } catch {
        Write-Host "[ERROR] No se pudo registrar la tarea: $_" -ForegroundColor Red
        Write-Host "Intenta ejecutar AUTOARRANQUE.bat como Administrador." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Presiona cualquier tecla para cerrar..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
