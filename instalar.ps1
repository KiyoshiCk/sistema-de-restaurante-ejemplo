# ============================================================
#  INSTALADOR DE REQUISITOS - SISTEMA DE RESTAURANTE
#  Instala Node.js y Python si no estan presentes,
#  luego ejecuta npm install para las dependencias del proyecto.
#  Requiere: Windows 10 (2004+) o Windows 11 con winget
# ============================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Ok($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "    [*]  $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "    [!]  $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    [X]  $msg" -ForegroundColor Red }
function Write-Step($n,$msg) { Write-Host ""; Write-Host "[$n] $msg" -ForegroundColor White }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INSTALADOR - SISTEMA DE RESTAURANTE  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$reiniciarPath  = $false
$errores        = @()

# ── PASO 1: Verificar winget ─────────────────────────────────────
Write-Step 1 "Verificando gestor de paquetes (winget)..."
$wingetOk = $false
try {
    $wver = winget --version 2>$null
    if ($wver) { $wingetOk = $true; Write-Ok "winget disponible ($wver)" }
} catch {}

if (-not $wingetOk) {
    Write-Err "winget no esta disponible en este sistema."
    Write-Host ""
    Write-Host "  Instala manualmente desde:" -ForegroundColor Yellow
    Write-Host "   Node.js -> https://nodejs.org/es/download/" -ForegroundColor White
    Write-Host "   Python  -> https://www.python.org/downloads/" -ForegroundColor White
    Write-Host ""
    Write-Host "  Luego ejecuta este instalador de nuevo." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Presiona Enter para salir"
    exit 1
}

# ── PASO 2: Verificar / Instalar Node.js ─────────────────────────
Write-Step 2 "Verificando Node.js..."
$nodeOk = $false
try {
    $nodeVer = node --version 2>$null
    if ($nodeVer -match "v\d") { $nodeOk = $true; Write-Ok "Node.js ya instalado: $nodeVer" }
} catch {}

if (-not $nodeOk) {
    Write-Info "Node.js no encontrado. Instalando Node.js LTS (puede tardar unos minutos)..."
    try {
        winget install -e --id OpenJS.NodeJS.LTS `
            --accept-package-agreements `
            --accept-source-agreements `
            --silent 2>&1 | Out-Null
        Write-Ok "Node.js instalado correctamente."
        $reiniciarPath = $true
    } catch {
        Write-Err "No se pudo instalar Node.js: $_"
        $errores += "Node.js no se instalo correctamente."
        Write-Warn "Instala manualmente: https://nodejs.org/es/download/"
    }
}

# ── PASO 3: Verificar / Instalar Python ─────────────────────────
Write-Step 3 "Verificando Python..."
$pythonOk = $false

# Detectar si el comando 'python' apunta al stub de la Microsoft Store
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if ($pythonCmd) {
    if ($pythonCmd.Source -notmatch "WindowsApps") {
        $pyVer = python --version 2>$null
        if ($pyVer -match "Python \d") { $pythonOk = $true; Write-Ok "Python ya instalado: $pyVer" }
    } else {
        Write-Warn "Python del Store (atajo) detectado. Instalando Python real..."
    }
}

if (-not $pythonOk) {
    Write-Info "Python no encontrado. Instalando Python 3.12 (puede tardar unos minutos)..."
    try {
        winget install -e --id Python.Python.3.12 `
            --accept-package-agreements `
            --accept-source-agreements `
            --silent 2>&1 | Out-Null
        Write-Ok "Python instalado correctamente."
        $reiniciarPath = $true
    } catch {
        Write-Err "No se pudo instalar Python: $_"
        $errores += "Python no se instalo correctamente."
        Write-Warn "Instala manualmente: https://www.python.org/downloads/"
    }
}

# ── PASO 4: Refrescar PATH para ver los nuevos instaladores ──────
if ($reiniciarPath) {
    Write-Step 4 "Actualizando PATH del sistema..."
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Ok "PATH actualizado."
} else {
    Write-Step 4 "PATH ya esta actualizado."
    Write-Ok "No hubo nuevas instalaciones que requieran actualizar PATH."
}

# ── PASO 5: npm install ──────────────────────────────────────────
Write-Step 5 "Verificando dependencias del proyecto..."
$backendPath = Join-Path $PSScriptRoot "backend"
$nodeModulesPath = Join-Path $backendPath "node_modules"

# Leer dependencias requeridas del package.json
$pkgJson = Get-Content (Join-Path $backendPath "package.json") -Raw | ConvertFrom-Json
$depsRequeridas = $pkgJson.dependencies.PSObject.Properties.Name

# Verificar si todas las dependencias ya están instaladas
$todasInstaladas = $true
foreach ($dep in $depsRequeridas) {
    if (-not (Test-Path (Join-Path $nodeModulesPath $dep))) {
        $todasInstaladas = $false
        break
    }
}

if ($todasInstaladas) {
    Write-Ok "Todas las dependencias ya estan instaladas. Saltando npm install."
} elseif (Test-Path (Join-Path $backendPath "package.json")) {
    Write-Info "Faltan dependencias. Ejecutando npm install..."
    try {
        Push-Location $backendPath
        npm install --loglevel=warn 2>&1
        Pop-Location
        Write-Ok "Dependencias instaladas correctamente."
    } catch {
        Pop-Location -ErrorAction SilentlyContinue
        Write-Err "Error al instalar dependencias: $_"
        $errores += "npm install fallo. Intenta ejecutar manualmente: cd backend && npm install"
    }
} else {
    Write-Warn "No se encontro package.json en la carpeta backend."
    $errores += "No se encontro package.json."
}

# ── RESULTADO FINAL ─────────────────────────────────────────────
Write-Host ""
Write-Host "========================================"

if ($errores.Count -eq 0) {
    Write-Host "  INSTALACION COMPLETADA CON EXITO" -ForegroundColor Green
} else {
    Write-Host "  INSTALACION COMPLETADA CON ADVERTENCIAS" -ForegroundColor Yellow
    Write-Host ""
    foreach ($e in $errores) { Write-Warn $e }
}
Write-Host "========================================"
Write-Host ""

# ── PASO 6: Ofrecer autoarranque ────────────────────────────────
if ($errores.Count -eq 0) {
    $resp = Read-Host "Deseas que el sistema arranque automaticamente al iniciar Windows? (s/n)"
    if ($resp -match "^[sSyY]") {
        Write-Host ""
        Write-Host "[*] Configurando autoarranque..." -ForegroundColor Cyan
        Set-Location $PSScriptRoot
        powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\autoarranque.ps1"
    }
}

Write-Host ""
Write-Host "  Todo listo! Haz doble clic en INICIAR.bat para arrancar el sistema." -ForegroundColor Cyan

if ($reiniciarPath) {
    Write-Host ""
    Write-Host "  NOTA: Se instalaron nuevos programas. Si al iniciar aparece un error," -ForegroundColor Yellow
    Write-Host "        cierra todas las ventanas, reinicia el PC e intenta de nuevo." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Presiona Enter para cerrar"
