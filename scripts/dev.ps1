$ErrorActionPreference = "Stop"

$root    = Resolve-Path (Join-Path $PSScriptRoot "..")
$desktop = Join-Path $root "apps\desktop"

Write-Host "== Starting Winks Desktop Dev =="

Push-Location $desktop
npm run dev
Pop-Location
