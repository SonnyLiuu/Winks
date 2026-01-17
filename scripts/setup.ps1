$ErrorActionPreference = "Stop"

$root    = Resolve-Path (Join-Path $PSScriptRoot "..")
$desktop = Join-Path $root "apps\desktop"
$vision  = Join-Path $root "services\vision"
$venvPy  = Join-Path $vision ".venv\Scripts\python.exe"
$reqWin  = Join-Path $vision "requirements.windows.txt"

Write-Host "== Winks Setup =="

# --- Node install ---
Write-Host "`n[1/2] Installing npm dependencies..."
Push-Location $desktop
npm install
Pop-Location

# --- Python venv ---
Write-Host "`n[2/2] Setting up Python environment..."
if (-not (Test-Path $venvPy)) {
  Write-Host "Creating venv at services/vision/.venv..."
  Push-Location $vision
  python -m venv .venv
  Pop-Location
}

if (Test-Path $reqWin) {
  Write-Host "Installing Python requirements.windows.txt..."
  & $venvPy -m pip install --upgrade pip
  & $venvPy -m pip install -r $reqWin
} else {
  Write-Host "WARNING: requirements.windows.txt not found (skipping pip install)"
}

Write-Host "`n✅ Setup complete"
