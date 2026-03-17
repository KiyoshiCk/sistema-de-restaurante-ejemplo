# Script para iniciar el Sistema de Restaurante en Red Local
# Ejecutar con: powershell -ExecutionPolicy Bypass -File iniciar.ps1

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SISTEMA DE RESTAURANTE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configurar variable de entorno para MongoDB
$env:MONGODB_URI = "mongodb+srv://admin:admin123@cluster0.yqpcckd.mongodb.net/restaurante?retryWrites=true&w=majority"

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

# Iniciar Backend
Write-Host "[+] Iniciando Backend (Node.js)..." -ForegroundColor Green
$backendProcess = Start-Process -NoNewWindow -PassThru -FilePath "node" -ArgumentList "server.js" -WorkingDirectory "$PSScriptRoot\backend"
Start-Sleep -Seconds 5

# Verificar Backend
$backendOK = $null -ne $backendProcess -and !$backendProcess.HasExited
if ($backendOK) {
    Write-Host "    [OK] Backend iniciado correctamente (PID: $($backendProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "    [ERROR] Error al iniciar Backend" -ForegroundColor Red
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

# Obtener IP local - PRIORIZAR ETHERNET sobre Wi-Fi (evitar adaptadores virtuales)
$ipCandidates = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notlike "169.*" -and
    $_.IPAddress -notlike "127.*" -and
    $_.AddressState -eq "Preferred" -and
    $_.InterfaceOperationalStatus -eq "Up" -and
    $_.InterfaceAlias -notmatch "vEthernet|VirtualBox|VMware|Hyper-V|WSL|Loopback|TAP|Npcap"
}

$ethernetIp = ($ipCandidates | Where-Object { $_.InterfaceAlias -match "Ethernet" } | Select-Object -First 1).IPAddress
$wifiIp = ($ipCandidates | Where-Object { $_.InterfaceAlias -match "Wi-Fi|WLAN" } | Select-Object -First 1).IPAddress

$ip = $ethernetIp
if (-not $ip) {
    $ip = $wifiIp
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
Write-Host "Credenciales:" -ForegroundColor Cyan
Write-Host "   Usuario: admin    Password: admin123" -ForegroundColor White
Write-Host "   Usuario: mesero   Password: mesero123" -ForegroundColor White
Write-Host "   Usuario: cocinero Password: cocinero123" -ForegroundColor White
Write-Host ""
Write-Host "Para detener: ejecutar .\detener.ps1" -ForegroundColor Magenta
Write-Host ""
Write-Host "Presiona cualquier tecla para cerrar esta ventana..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
