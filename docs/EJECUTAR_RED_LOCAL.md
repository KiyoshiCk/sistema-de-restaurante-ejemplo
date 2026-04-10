# 🚀 Guía: Ejecutar el Sistema de Restaurante en Red Local

Esta guía te permite ejecutar el sistema y acceder desde cualquier dispositivo en tu red local (celular, tablet, otra PC).

---

## 📋 Requisitos Previos

- Node.js instalado
- Python instalado (para servidor frontend)

---

## 🔧 Paso 1: Obtener tu IP Local

Abre PowerShell y ejecuta:

```powershell
ipconfig
```

Busca tu **Dirección IPv4** en la sección de Wi-Fi o Ethernet. Ejemplo: `192.168.1.13`

---

## 🔥 Paso 2: Configurar el Firewall (Solo la primera vez)

### 2.1 Cambiar perfil de red a Privada

```powershell
Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
```

> Si usas Ethernet, cambia `"Wi-Fi"` por `"Ethernet"`

### 2.2 Agregar reglas de firewall

```powershell
# Para el Backend (puerto 3000)
netsh advfirewall firewall add rule name="Node.js Backend Port 3000" dir=in action=allow protocol=TCP localport=3000

# Para el Frontend (puerto 5500)
netsh advfirewall firewall add rule name="Frontend Port 5500" dir=in action=allow protocol=TCP localport=5500

# Para Node.js (programa)
New-NetFirewallRule -DisplayName "Node.js Allow All" -Direction Inbound -Program "C:\Program Files\nodejs\node.exe" -Action Allow -Profile Private,Public
```

---

## 🖥️ Paso 3: Iniciar el Backend

Abre PowerShell y ejecuta:

```powershell
cd "f:\sistema de restaurante - cliente\backend"
```

### Ejecución en segundo plano (recomendado)

```powershell
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "server.js" -WorkingDirectory "f:\sistema de restaurante - cliente\backend"
```

Para verificar que está corriendo:

```powershell
netstat -an | findstr ":3000"
```

Deberías ver: `TCP 0.0.0.0:3000 ... LISTENING`

---

## 🌐 Paso 4: Iniciar el Frontend

Abre **otra** ventana de PowerShell y ejecuta:

```powershell
Start-Process -NoNewWindow -FilePath "python" -ArgumentList "-m", "http.server", "5500", "--bind", "0.0.0.0" -WorkingDirectory "f:\sistema de restaurante - cliente\frontend"
```

Para verificar que está corriendo:

```powershell
netstat -an | findstr ":5500"
```

Deberías ver: `TCP 0.0.0.0:5500 ... LISTENING`

---

## ✅ Paso 5: Verificar que todo funciona

### Probar Backend:

```powershell
Invoke-WebRequest -Uri "http://TU_IP:3000/api/health" -UseBasicParsing
```

### Probar Frontend:

```powershell
Invoke-WebRequest -Uri "http://TU_IP:5500/admin.html" -UseBasicParsing
```

Reemplaza `TU_IP` con tu IP local (ej: `192.168.1.13`)

---

## 📱 Paso 6: Acceder desde otros dispositivos

Desde cualquier dispositivo conectado a la misma red WiFi, abre el navegador y visita:

| Página | URL |
|--------|-----|
| **Índice** | `http://TU_IP:5500/` |
| **Panel Admin** | `http://TU_IP:5500/admin.html` |
| **Vista Cliente** | `http://TU_IP:5500/cliente.html` |
| **Vista Cocina** | `http://TU_IP:5500/cocina.html` |

### Credenciales de acceso:

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| admin | admin123 | Administrador |
| mesero | mesero123 | Mesero |
| cocinero | cocinero123 | Cocinero |

---

## 🛑 Detener los servidores

### Detener Backend (Node.js):

```powershell
Get-Process node | Stop-Process -Force
```

### Detener Frontend (Python):

```powershell
Get-Process python | Stop-Process -Force
```

---

## 🔄 Script Rápido: Iniciar Todo

Crea un archivo `iniciar.ps1` y pega esto:

```powershell
# Iniciar Backend (SQLite, sin configuración adicional)
Write-Host "🚀 Iniciando Backend..." -ForegroundColor Green
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "server.js" -WorkingDirectory "f:\sistema de restaurante - cliente\backend"
Start-Sleep -Seconds 3

# Iniciar Frontend
Write-Host "🌐 Iniciando Frontend..." -ForegroundColor Cyan
Start-Process -NoNewWindow -FilePath "python" -ArgumentList "-m", "http.server", "5500", "--bind", "0.0.0.0" -WorkingDirectory "f:\sistema de restaurante - cliente\frontend"
Start-Sleep -Seconds 2

# Obtener IP
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -match "Wi-Fi|Ethernet" -and $_.IPAddress -notlike "169.*" } | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "✅ Sistema iniciado correctamente!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 URLs para acceder:" -ForegroundColor Yellow
Write-Host "   Admin:   http://${ip}:5500/admin.html"
Write-Host "   Cliente: http://${ip}:5500/cliente.html"
Write-Host "   Cocina:  http://${ip}:5500/cocina.html"
Write-Host ""
Write-Host "🔑 Credenciales: admin / admin123" -ForegroundColor Cyan
```

Para ejecutarlo:

```powershell
cd "f:\sistema de restaurante - cliente"
powershell -ExecutionPolicy Bypass -File iniciar.ps1
```

---

## 🐛 Solución de Problemas

### Error: "No es posible conectar con el servidor remoto"

1. Verificar que el servidor esté corriendo:
   ```powershell
   Get-Process node, python
   ```

2. Verificar puertos:
   ```powershell
   netstat -an | findstr "3000\|5500"
   ```

3. Verificar firewall:
   ```powershell
   Get-NetFirewallRule -DisplayName "*3000*", "*5500*"
   ```

### Error: "Red Pública bloqueando conexiones"

```powershell
Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
```

---

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                    TU RED LOCAL                      │
│                                                      │
│  ┌──────────────┐     ┌──────────────┐              │
│  │   Tu PC      │     │  Celular/    │              │
│  │              │     │  Otro PC     │              │
│  │ Backend:3000 │◄────│              │              │
│  │ Frontend:5500│◄────│  Navegador   │              │
│  │ SQLite (DB)  │     │              │              │
│  └──────────────┘     └──────────────┘              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 📅 Última actualización: Abril 2026
