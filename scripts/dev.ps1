$ErrorActionPreference = "Stop"

$root    = Resolve-Path (Join-Path $PSScriptRoot "..")
$desktop = Join-Path $root "apps\desktop"

function Fail($msg) { Write-Error $msg; exit 1 }

# Default: run desktop dev
if ($args.Count -eq 0 -or $args[0] -eq "dev") {
  Write-Host "== Starting Winks Desktop Dev =="
  Push-Location $desktop
  npm run dev
  Pop-Location
  exit 0
}

# Release: patch/minor/major
if ($args[0] -eq "release") {
  $bump = if ($args.Count -ge 2) { $args[1] } else { "patch" }
  if ($bump -notin @("patch","minor","major")) { Fail "Usage: dev.ps1 release [patch|minor|major]" }

  if (git status --porcelain) { Fail "Working tree not clean. Commit/stash first." }

  $branch = (git rev-parse --abbrev-ref HEAD).Trim()
  if ($branch -ne "main") { Fail "Switch to main first." }

  git pull --ff-only | Out-Host

  Push-Location $desktop
  npm run "release:$bump" | Out-Host
  Pop-Location

  # push commit + tags created by npm version
  git push --follow-tags | Out-Host

  Write-Host "Release pushed ($bump). Check GitHub Actions -> Release."
  exit 0
}

Fail "Unknown command. Use: dev.ps1 [dev] or dev.ps1 release [patch|minor|major]"
