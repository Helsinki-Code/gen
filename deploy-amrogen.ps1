# Run from amrogen/ — forwards to repo-root deploy-amrogen.ps1
param(
  [switch]$Frontend,
  [switch]$Backend,
  [switch]$Fullstack,
  [switch]$SkipEnvGenerate,
  [switch]$EnvOnly,
  [switch]$CodeOnly,
  [switch]$SkipPredeployChecks,
  [string]$Project = "agentic-ai-amro",
  [string]$Region = "europe-west1",
  [string]$FrontendService = "amrogen-frontend",
  [string]$BackendService = "amrogen-backend"
)

$RootScript = Join-Path (Split-Path $PSScriptRoot -Parent) "deploy-amrogen.ps1"
if (-not (Test-Path $RootScript)) {
  Write-Error "Not found: $RootScript. Run from agentic-ai-amro-cleaned instead."
}

$args = @()
if ($Frontend) { $args += "-Frontend" }
if ($Backend) { $args += "-Backend" }
if ($Fullstack) { $args += "-Fullstack" }
if ($SkipEnvGenerate) { $args += "-SkipEnvGenerate" }
if ($EnvOnly) { $args += "-EnvOnly" }
if ($CodeOnly) { $args += "-CodeOnly" }
if ($SkipPredeployChecks) { $args += "-SkipPredeployChecks" }
if ($Project) { $args += "-Project"; $args += $Project }
if ($Region) { $args += "-Region"; $args += $Region }
if ($FrontendService) { $args += "-FrontendService"; $args += $FrontendService }
if ($BackendService) { $args += "-BackendService"; $args += $BackendService }

& $RootScript @args
exit $LASTEXITCODE
