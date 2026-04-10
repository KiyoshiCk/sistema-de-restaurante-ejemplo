# Script para iniciar el Sistema de Restaurante en Red Local
# Ejecutar con: powershell -ExecutionPolicy Bypass -File iniciar.ps1
param([switch]$Silencioso)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SISTEMA DE RESTAURANTE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configurar reglas de Firewall para permitir acceso en red local
Write-Host "[*] Configurando Firewall para acceso en red local..." -ForegroundColor Yellow
$firewallRules = @(
    @{ Name = "Restaurante-Backend-3000"; Port = 3000; Description = "Sistema Restaurante - Backend API" },
    @{ Name = "Restaurante-Frontend-5500"; Port = 5500; Description = "Sistema Restaurante - Frontend Web" }
)

foreach ($rule in $firewallRules) {
    $existingRule = Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue
    if (-not $existingRule) {
        try {
            New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Protocol TCP -LocalPort $rule.Port -Action Allow -Profile Private,Domain -Description $rule.Description -ErrorAction Stop | Out-Null
            Write-Host "    [OK] Regla de firewall creada: $($rule.Name)" -ForegroundColor Green
        } catch {
            Write-Host "    [WARN] No se pudo crear regla de firewall para puerto $($rule.Port). Ejecuta como Administrador." -ForegroundColor Yellow
        }
    } else {
        Write-Host "    [OK] Regla de firewall ya existe: $($rule.Name)" -ForegroundColor Gray
    }
}

# Detener procesos anteriores si existen (solo los puertos del sistema)
Write-Host "[*] Deteniendo procesos anteriores en puertos 3000 y 5500..." -ForegroundColor Yellow
$portsToFree = @(3000, 5500)
foreach ($port in $portsToFree) {
    $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        try {
            Stop-Process -Id $listener.OwningProcess -Force -ErrorAction Stop
            Write-Host "    [OK] Proceso en puerto $port detenido (PID: $($listener.OwningProcess))" -ForegroundColor Green
        } catch {
            Write-Host "    [WARN] No se pudo detener el proceso en puerto $port" -ForegroundColor Yellow
        }
    }
}
Start-Sleep -Seconds 2

# Verificar dependencias npm (primer uso o tras clonar el proyecto)
$nodeModulesPath = Join-Path $PSScriptRoot "backend\node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "[+] Primera ejecucion detectada: instalando dependencias npm..." -ForegroundColor Yellow
    try {
        Push-Location (Join-Path $PSScriptRoot "backend")
        npm install --loglevel=warn 2>&1
        Pop-Location
        Write-Host "    [OK] Dependencias instaladas." -ForegroundColor Green
    } catch {
        Pop-Location -ErrorAction SilentlyContinue
        Write-Host "    [ERROR] No se pudo ejecutar npm install: $_" -ForegroundColor Red
        Write-Host "    Ejecuta INSTALAR.bat primero para configurar los requisitos." -ForegroundColor Yellow
    }
}

# Iniciar Backend con PM2 (auto-restart si crashea)
Write-Host "[+] Iniciando Backend (Node.js con PM2)..." -ForegroundColor Green
$pm2Cmd = Get-Command pm2 -ErrorAction SilentlyContinue

if ($pm2Cmd) {
    # Detener instancia anterior si existe
    pm2 delete restaurante-backend 2>$null | Out-Null

    Push-Location "$PSScriptRoot\backend"
    pm2 start ecosystem.config.js 2>&1 | Out-Null
    Pop-Location
    Start-Sleep -Seconds 4

    $pm2Status = pm2 jlist 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue
    $backendApp = $pm2Status | Where-Object { $_.name -eq 'restaurante-backend' }
    if ($backendApp -and $backendApp.pm2_env.status -eq 'online') {
        Write-Host "    [OK] Backend iniciado con PM2 (auto-restart activado)" -ForegroundColor Green
        $backendOK = $true
    } else {
        Write-Host "    [WARN] PM2 no reporta estado online, verificando puerto..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        $backendOK = $null -ne (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
        if ($backendOK) {
            Write-Host "    [OK] Backend escuchando en puerto 3000" -ForegroundColor Green
        } else {
            Write-Host "    [ERROR] Backend no pudo iniciarse. Revisa logs\backend-error.log" -ForegroundColor Red
        }
    }
} else {
    # Fallback: arrancar con node directamente si PM2 no está disponible
    Write-Host "    [WARN] PM2 no encontrado, usando node directo..." -ForegroundColor Yellow
    $backendProcess = Start-Process -NoNewWindow -PassThru -FilePath "node" -ArgumentList "server.js" -WorkingDirectory "$PSScriptRoot\backend"
    Start-Sleep -Seconds 5
    $backendOK = $null -ne $backendProcess -and !$backendProcess.HasExited
    if ($backendOK) {
        Write-Host "    [OK] Backend iniciado (PID: $($backendProcess.Id))" -ForegroundColor Green
    } else {
        Write-Host "    [ERROR] Error al iniciar Backend" -ForegroundColor Red
    }
}

# Iniciar Frontend
Write-Host "[+] Iniciando Frontend (Python HTTP Server puerto 5500)..." -ForegroundColor Cyan
$frontendProcess = Start-Process -NoNewWindow -PassThru -FilePath "python" -ArgumentList "-m", "http.server", "5500", "--bind", "0.0.0.0" -WorkingDirectory "$PSScriptRoot\frontend"
Start-Sleep -Seconds 3

# Verificar Frontend
$frontendOK = $null -ne $frontendProcess -and !$frontendProcess.HasExited
if ($frontendOK) {
    Write-Host "    [OK] Frontend iniciado correctamente (PID: $($frontendProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "    [ERROR] Error al iniciar Frontend" -ForegroundColor Red
}

# Obtener IP local - Usar adaptador con gateway (el que tiene conexion real a la red)
$netConfigs = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null }

$ethernetIp = ($netConfigs | Where-Object { $_.InterfaceAlias -match "Ethernet" } | Select-Object -First 1).IPv4Address.IPAddress
$wifiIp = ($netConfigs | Where-Object { $_.InterfaceAlias -match "Wi-Fi|WLAN" } | Select-Object -First 1).IPv4Address.IPAddress

# Priorizar Ethernet sobre Wi-Fi
$ip = $ethernetIp
if (-not $ip) {
    $ip = $wifiIp
}
if (-not $ip) {
    # Fallback: tomar cualquier adaptador con gateway
    $ip = ($netConfigs | Select-Object -First 1).IPv4Address.IPAddress
}
if (-not $ip) {
    $ip = "localhost"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  SISTEMA INICIADO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  IP DEL SERVIDOR: $ip" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "URLs para acceder desde cualquier dispositivo:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   Inicio:   http://${ip}:5500/" -ForegroundColor White
Write-Host "   Admin:    http://${ip}:5500/admin.html" -ForegroundColor White
Write-Host "   Cliente:  http://${ip}:5500/cliente.html" -ForegroundColor White
Write-Host "   Cocina:   http://${ip}:5500/cocina.html" -ForegroundColor White

# Copiar URL principal al portapapeles
$urlPrincipal = "http://${ip}:5500/"
Set-Clipboard -Value $urlPrincipal
Write-Host ""
Write-Host "   [COPIADO] URL copiada al portapapeles: $urlPrincipal" -ForegroundColor Magenta
if ($ethernetIp -and $wifiIp -and $ethernetIp -ne $wifiIp) {
    Write-Host ""
    Write-Host "IPs detectadas:" -ForegroundColor Yellow
    Write-Host "   Ethernet: ${ethernetIp}" -ForegroundColor White
    Write-Host "   Wi-Fi:    ${wifiIp}" -ForegroundColor White
}
Write-Host ""
Write-Host "Credenciales iniciales: ver README.md" -ForegroundColor Yellow
Write-Host "IMPORTANTE: Cambia las contrasenas desde el panel Admin antes de usar en produccion" -ForegroundColor Yellow
Write-Host ""
Write-Host "Para detener: ejecutar .\detener.ps1" -ForegroundColor Magenta
Write-Host ""
if (-not $Silencioso) {
    Write-Host "Presiona cualquier tecla para cerrar esta ventana..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
