param(
  [switch]$ForceInstall,
  [switch]$ForceGenerate
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js was not found. Install Node 22.13 or newer and try again."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm was not found. Install npm and try again."
}

$scriptPath = Join-Path $PSScriptRoot "setup-local.mjs"
$nodeArgs = @($scriptPath)

if ($ForceInstall) { $nodeArgs += "--force-install" }
if ($ForceGenerate) { $nodeArgs += "--force-generate" }

& node @nodeArgs
exit $LASTEXITCODE
