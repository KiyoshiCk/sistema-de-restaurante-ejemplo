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
    if ($nodeVer -match "v(\d+)\.") {
        $nodeMajor = [int]$Matches[1]
        if ($nodeMajor -le 22) {
            $nodeOk = $true
            Write-Ok "Node.js LTS detectado: $nodeVer"
        } else {
            Write-Warn "Node.js $nodeVer detectado (muy reciente, sin binarios para modulos nativos)."
            Write-Info "Instalando Node.js LTS v22 para compatibilidad con better-sqlite3..."
            winget install -e --id OpenJS.NodeJS.LTS `
                --accept-package-agreements `
                --accept-source-agreements `
                --silent 2>&1 | Out-Null
            # Refrescar PATH para usar el Node recien instalado
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                        [System.Environment]::GetEnvironmentVariable("Path","User")
            $nodeVerNew = node --version 2>$null
            if ($nodeVerNew -match "v(\d+)\." -and [int]$Matches[1] -le 22) {
                $nodeOk = $true
                Write-Ok "Node.js LTS instalado: $nodeVerNew"
                $reiniciarPath = $true
            } else {
                Write-Warn "Sigue activa la version $nodeVer. Puede que necesites reiniciar el PC."
                Write-Warn "Si el sistema falla, desinstala Node.js v$nodeMajor e instala v22 LTS desde https://nodejs.org"
                $nodeOk = $true  # Continuar de todas formas
            }
        }
    }
} catch {}

if (-not $nodeOk) {
    Write-Info "Node.js no encontrado. Instalando Node.js LTS v22..."
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

# ── PASO 4b: Visual Studio Build Tools (requerido por better-sqlite3) ──
Write-Step "4b" "Verificando Visual Studio Build Tools (compilador C++)..."
$vsBuildOk = $false

# Buscar cl.exe (compilador MSVC) en rutas comunes
$clPaths = @(
    "${env:ProgramFiles}\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC",
    "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC",
    "${env:ProgramFiles}\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC"
)
foreach ($p in $clPaths) {
    if (Test-Path $p) { $vsBuildOk = $true; break }
}

# También verificar via vswhere
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not $vsBuildOk -and (Test-Path $vswhere)) {
    $vsPath = & $vswhere -products * -requires Microsoft.VisualCpp.Tools.HostX64.TargetX64 -find VC\Tools\MSVC 2>$null
    if ($vsPath) { $vsBuildOk = $true }
}

if ($vsBuildOk) {
    Write-Ok "Visual Studio Build Tools ya instalado."
} else {
    Write-Info "Build Tools no encontrado. Instalando Visual Studio Build Tools con C++..."
    Write-Info "Esto puede tardar 5-10 minutos segun la velocidad de internet..."
    try {
        winget install Microsoft.VisualStudio.2022.BuildTools `
            --silent `
            --accept-package-agreements `
            --accept-source-agreements `
            --override "--quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" 2>&1 | Out-Null
        Write-Ok "Visual Studio Build Tools instalado."
        $reiniciarPath = $true
        # Refrescar PATH nuevamente
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("Path","User")
    } catch {
        Write-Err "No se pudo instalar Build Tools automaticamente: $_"
        Write-Warn "Instala manualmente desde: https://visualstudio.microsoft.com/visual-cpp-build-tools/"
        Write-Warn "Selecciona: 'Desarrollo de escritorio con C++' y vuelve a ejecutar este instalador."
        $errores += "Visual Studio Build Tools no instalado. npm install fallara con better-sqlite3."
    }
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
