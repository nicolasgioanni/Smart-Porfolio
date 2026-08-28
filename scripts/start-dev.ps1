param(
  [int]$Port = 0,
  [switch]$Verify,
  [switch]$NoOpen,
  [switch]$ForceInstall,
  [switch]$ForceGenerate
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js was not found. Install Node 20.19 or newer and try again."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm was not found. Install npm and try again."
}

$scriptPath = Join-Path $PSScriptRoot "start-dev.mjs"
$nodeArgs = @($scriptPath)

if ($Port -gt 0) {
  $nodeArgs += "--port"
  $nodeArgs += [string]$Port
}

if ($Verify) { $nodeArgs += "--verify" }
if ($NoOpen) { $nodeArgs += "--no-open" }
if ($ForceInstall) { $nodeArgs += "--force-install" }
if ($ForceGenerate) { $nodeArgs += "--force-generate" }

& node @nodeArgs
exit $LASTEXITCODE
