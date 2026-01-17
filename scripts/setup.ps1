$ErrorActionPreference = "Stop"

$root    = Resolve-Path (Join-Path $PSScriptRoot "..")
$desktop = Join-Path $root "apps\desktop"
$vision  = Join-Path $root "services\vision"

# --- Vision venv (your existing dev env) ---
$venvDir = Join-Path $vision ".venv"
$venvPy  = Join-Path $venvDir "Scripts\python.exe"
$reqWin  = Join-Path $vision "requirements.windows.txt"

# --- Packaged runtime (generated, NOT committed) ---
$runtimeRoot = Join-Path $desktop "resources\python_runtime"
$runtimeVenv = Join-Path $root ".venv_runtime"
$runtimePy   = Join-Path $runtimeVenv "Scripts\python.exe"
$runtimeReq  = Join-Path $desktop "requirements.txt"

Write-Host "== Winks Setup =="

# --- Node install ---
Write-Host "`n[1/3] Installing npm dependencies..."
Push-Location $desktop
npm install
Pop-Location

# --- Python venv for services/vision ---
Write-Host "`n[2/3] Setting up services/vision Python environment..."
if (-not (Test-Path $venvPy)) {
  Write-Host "Creating venv at services/vision/.venv..."
  Push-Location $vision
  python -m venv .venv
  Pop-Location
}

if (Test-Path $reqWin) {
  Write-Host "Installing services/vision requirements.windows.txt..."
  & $venvPy -m pip install --upgrade pip
  & $venvPy -m pip install -r $reqWin
} else {
  Write-Host "WARNING: services/vision/requirements.windows.txt not found (skipping pip install)"
}

# --- Build embedded runtime for apps/desktop (best practice) ---
Write-Host "`n[3/3] Building embedded Python runtime for apps/desktop..."
if (!(Test-Path $runtimeReq)) {
  Write-Host "WARNING: apps/desktop/requirements.txt not found (skipping runtime build)"
  Write-Host "         Create it (you already have: numpy/mediapipe/opencv/pyautogui) to enable reproducible builds."
  Write-Host "`n✅ Setup complete"
  exit 0
}

# Clean old generated runtime + temp venv
if (Test-Path $runtimeRoot) { Remove-Item -Recurse -Force $runtimeRoot }
if (Test-Path $runtimeVenv) { Remove-Item -Recurse -Force $runtimeVenv }

# Create venv used to assemble the runtime
python -m venv $runtimeVenv

# Install deps into that venv
& $runtimePy -m pip install --upgrade pip
& $runtimePy -m pip install -r $runtimeReq

# Reduce disk bloat a bit (optional)
& $runtimePy -m pip cache purge | Out-Null

# Copy venv -> resources/python_runtime (this is what you package)
New-Item -ItemType Directory -Force $runtimeRoot | Out-Null
Copy-Item -Recurse -Force "$runtimeVenv\*" $runtimeRoot

Write-Host "`n✅ Setup complete"
