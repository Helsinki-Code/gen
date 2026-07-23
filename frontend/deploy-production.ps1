# Deploy AmroGen frontend to Cloud Run (production)
# Uses frontend/.env.production only — no repo-root .env required.
#
# Usage (from amrogen/frontend/):
#   .\deploy-production.ps1
#   .\deploy-production.ps1 -EnvOnly
#   .\deploy-production.ps1 -CodeOnly
#   .\deploy-production.ps1 -SkipEnvGenerate

param(
  [switch]$SkipEnvGenerate,
  [switch]$EnvOnly,
  [switch]$CodeOnly,
  [switch]$SkipPredeployChecks,
  [string]$Project = "agentic-ai-amro",
  [string]$Region = "europe-west1",
  [string]$Service = "amrogen-frontend"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if ($EnvOnly -and $CodeOnly) {
  Write-Error "Use -EnvOnly or -CodeOnly, not both."
}

function Get-CloudRunBuildEnvArgs {
  param([string]$BuildVarsPath = "deploy/cloudrun-build-public.vars")

  if (-not (Test-Path $BuildVarsPath)) {
    return @()
  }

  $pairs = @()
  foreach ($line in Get-Content $BuildVarsPath) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    $eq = $trimmed.IndexOf("=")
    if ($eq -le 0) { continue }
    $key = $trimmed.Substring(0, $eq).Trim()
    $value = $trimmed.Substring($eq + 1).Trim()
    if ($key.StartsWith("NEXT_PUBLIC_")) {
      $pairs += "${key}=${value}"
    }
  }

  if ($pairs.Count -eq 0) {
    return @()
  }

  return @("--set-build-env-vars", ($pairs -join ","))
}

function Stage-DocsForDocker {
  $srcDocs = Join-Path (Split-Path $PSScriptRoot -Parent) "docs"
  $stageRoot = Join-Path $PSScriptRoot ".docker-build\docs"
  if (-not (Test-Path $srcDocs)) {
    Write-Warning "docs/ not found at $srcDocs - blog pages may be empty in production."
    New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null
    return
  }
  if (Test-Path (Join-Path $PSScriptRoot ".docker-build")) {
    Remove-Item -Recurse -Force (Join-Path $PSScriptRoot ".docker-build")
  }
  New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null
  Copy-Item -Recurse -Path (Join-Path $srcDocs "*") -Destination $stageRoot
  Write-Host "Staged docs for Docker build." -ForegroundColor Green
}

# Windows: gcloud token refresh often fails without an explicit CA bundle.
try {
  $certBundle = python -c 'import certifi; print(certifi.where())' 2>$null
  if ($certBundle -and (Test-Path $certBundle)) {
    $env:SSL_CERT_FILE = $certBundle
    $env:REQUESTS_CA_BUNDLE = $certBundle
    gcloud config set core/custom_ca_certs_file $certBundle 2>$null | Out-Null
  }
} catch {
  # Non-fatal; gcloud may still work if system CAs are configured.
}

Write-Host "Deploying $Service to Cloud Run - region $Region, project $Project..." -ForegroundColor Cyan

if (-not $SkipEnvGenerate) {
  if (-not (Test-Path ".env.production")) {
    Write-Error ".env.production not found. Copy from .env.example and set values."
  }
  Write-Host "Generating deploy/*.yaml and build-time NEXT_PUBLIC vars from .env.production..." -ForegroundColor Green
  node scripts/generate-cloudrun-env.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$EnvFile = "deploy/env.cloudrun.yaml"
if (-not $CodeOnly -and -not $EnvOnly -and -not (Test-Path $EnvFile)) {
  Write-Error "Missing $EnvFile - run without -SkipEnvGenerate first."
}

if ($EnvOnly) {
  if (-not (Test-Path $EnvFile)) {
    Write-Error "Missing $EnvFile - run without -SkipEnvGenerate first."
  }
  Write-Host "Env only (-EnvOnly). Updating Cloud Run environment..." -ForegroundColor Yellow
  gcloud run services update $Service `
    --region $Region `
    --project $Project `
    --env-vars-file $EnvFile
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host "Environment updated." -ForegroundColor Green
  exit 0
}

if (-not (Test-Path "deploy/cloudrun-build-public.vars")) {
  Write-Error "Missing deploy/cloudrun-build-public.vars. Run generate-cloudrun-env.mjs first."
}

if (-not $EnvOnly -and -not $SkipPredeployChecks) {
  $RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
  $predeploy = Join-Path $RepoRoot "deploy-all-backends\predeploy.ps1"
  if (Test-Path $predeploy) {
    . $predeploy
    Invoke-ProductPredeployCheck -Name "AmroGen frontend" -ProductPath $PSScriptRoot
  }
}

Stage-DocsForDocker

if ($CodeOnly) {
  Write-Host "Code only (-CodeOnly). Building and deploying; keeping existing Cloud Run env..." -ForegroundColor Yellow
} else {
  Write-Host "Building and deploying frontend from source (code + env)..." -ForegroundColor Green
}

$deployArgs = @(
  "run", "deploy", $Service,
  "--source", ".",
  "--region", $Region,
  "--project", $Project,
  "--allow-unauthenticated",
  "--platform", "managed",
  "--port", "8080",
  "--memory", "1Gi",
  "--cpu", "1",
  "--timeout", "300",
  "--concurrency", "80"
)

$deployArgs += Get-CloudRunBuildEnvArgs

if (-not $CodeOnly) {
  $deployArgs += @("--env-vars-file", $EnvFile)
}

gcloud @deployArgs

if ($LASTEXITCODE -ne 0) {
  Write-Host "Deploy failed." -ForegroundColor Red
  exit 1
}

$Url = gcloud run services describe $Service --region $Region --project $Project --format="value(status.url)"
Write-Host ""
Write-Host "Deploy complete." -ForegroundColor Green
Write-Host "Cloud Run URL: $Url" -ForegroundColor Green
