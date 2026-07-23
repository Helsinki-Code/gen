# Deploy AmroGen backend to Cloud Run (production)
# Prerequisites: gcloud CLI authenticated, backend/.env.production populated
#
# Usage (from amrogen/backend/):
#   .\deploy-production.ps1              # code + env
#   .\deploy-production.ps1 -EnvOnly     # env only
#   .\deploy-production.ps1 -CodeOnly    # code only, keep live Cloud Run env
#   .\deploy-production.ps1 -SkipEnvGenerate

param(
  [switch]$SkipEnvGenerate,
  [switch]$EnvOnly,
  [switch]$CodeOnly,
  [switch]$SkipPredeployChecks,
  [switch]$SkipScheduler,
  [string]$Project = "agentic-ai-amro",
  [string]$Region = "europe-west1",
  [string]$Service = "amrogen-backend"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if ($EnvOnly -and $CodeOnly) {
  Write-Error "Use -EnvOnly or -CodeOnly, not both."
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

# Hard fail: CRLF in start.sh makes Linux report "bad interpreter" and never bind PORT.
$startSh = Join-Path $PSScriptRoot "start.sh"
if (Test-Path $startSh) {
  $raw = [System.IO.File]::ReadAllBytes($startSh)
  if ($raw -contains 13) {
    Write-Host "Normalizing start.sh CRLF -> LF (required for Cloud Run)..." -ForegroundColor Yellow
    $text = [System.IO.File]::ReadAllText($startSh) -replace "`r`n", "`n" -replace "`r", "`n"
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($startSh, $text, $utf8)
  }
}

$EnvFile = Join-Path $PSScriptRoot "deploy\env.cloudrun.yaml"

if ($EnvOnly) {
  if (-not $SkipEnvGenerate) {
    if (-not (Test-Path ".env.production")) {
      Write-Error ".env.production not found. Copy from .env.example and set values."
    }
    Write-Host "Generating deploy/env.cloudrun.yaml from .env.production..." -ForegroundColor Green
    node scripts/generate-cloudrun-env.mjs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
  if (-not (Test-Path $EnvFile)) {
    Write-Error "Missing $EnvFile. Run without -SkipEnvGenerate first."
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

if (-not $CodeOnly -and -not $SkipEnvGenerate) {
  if (-not (Test-Path ".env.production")) {
    Write-Error ".env.production not found. Copy from .env.example and set values."
  }
  Write-Host "Generating deploy/env.cloudrun.yaml from .env.production..." -ForegroundColor Green
  node scripts/generate-cloudrun-env.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not $CodeOnly -and -not (Test-Path $EnvFile)) {
  Write-Error "Missing $EnvFile. Run without -SkipEnvGenerate first."
}

if (-not $EnvOnly -and -not $SkipPredeployChecks) {
  $RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
  . (Join-Path $RepoRoot "deploy-all-backends\predeploy.ps1")
  Invoke-ProductPredeployCheck -Name "AmroGen backend" -ProductPath $PSScriptRoot
}

if ($CodeOnly) {
  Write-Host "Code only (-CodeOnly). Building and deploying; keeping existing Cloud Run env..." -ForegroundColor Yellow
} else {
  Write-Host "Building and deploying from source (code + env)..." -ForegroundColor Green
}

$deployArgs = @(
  "run", "deploy", $Service,
  "--source", ".",
  "--region", $Region,
  "--project", $Project,
  "--allow-unauthenticated",
  "--platform", "managed",
  "--port", "8000",
  "--memory", "1Gi",
  "--cpu", "1",
  "--timeout", "3600",
  "--concurrency", "80"
)

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

function Invoke-AmrogenKeysScheduler {
  if ($SkipScheduler) {
    Write-Host "Skipping keys/top-up Cloud Scheduler (-SkipScheduler)." -ForegroundColor Yellow
    return
  }
  $schedulerScript = Join-Path $PSScriptRoot "scripts\setup-keys-topup-cron.ps1"
  if (-not (Test-Path $schedulerScript)) {
    Write-Host "Scheduler script missing: $schedulerScript" -ForegroundColor Yellow
    return
  }
  Write-Host ""
  Write-Host "Cloud Scheduler (keys / payments report)..." -ForegroundColor Cyan
  try {
    & $schedulerScript -SkipDeploy -Project $Project -Region $Region -Service $Service
    if ($LASTEXITCODE -ne 0) {
      Write-Host "Scheduler setup failed (non-fatal). Re-run: amrogen\backend\scripts\setup-keys-topup-cron.ps1 -SkipDeploy" -ForegroundColor Yellow
    }
  } catch {
    Write-Host "Scheduler setup skipped: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

Invoke-AmrogenKeysScheduler
Write-Host ""
Write-Host "Post-deploy:" -ForegroundColor Yellow
Write-Host "  1. Map https://api.amrogen.com to this Cloud Run service."
Write-Host "  2. Ensure the service account can access GCS bucket(s) used by AmroGen."
Write-Host "  3. Configure Stripe webhook: https://api.amrogen.com/webhooks/stripe"
Write-Host "  4. Keys cron: GET /internal/cron/keys-topup-report (wired into this deploy unless -SkipScheduler)"
