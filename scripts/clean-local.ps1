param(
  [switch]$NodeModules,
  [switch]$GeneratedContent,
  [switch]$NextBuild,
  [switch]$All,
  [switch]$Force
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js was not found. Install Node 20 or newer and try again."
}

$scriptPath = Join-Path $PSScriptRoot "clean-local.mjs"
$nodeArgs = @($scriptPath)

if ($NodeModules) { $nodeArgs += "--node-modules" }
if ($GeneratedContent) { $nodeArgs += "--generated-content" }
if ($NextBuild) { $nodeArgs += "--next-build" }
if ($All) { $nodeArgs += "--all" }
if ($Force) { $nodeArgs += "--force" }

& node @nodeArgs
exit $LASTEXITCODE