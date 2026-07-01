$ErrorActionPreference = "Stop"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js was not found. Install Node 20 or newer and try again."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm was not found. Install npm and try again."
}

$scriptPath = Join-Path $PSScriptRoot "verify-local.mjs"
& node $scriptPath
exit $LASTEXITCODE