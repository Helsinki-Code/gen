# Ensure AmroGen Cloud Scheduler job for daily keys / Stripe / DB report.
# Does NOT deploy the Cloud Run service (use -SkipDeploy; there is no auto-deploy path here).
#
# Usage (from repo or amrogen/backend/scripts):
#   .\setup-keys-topup-cron.ps1 -SkipDeploy
#   .\setup-keys-topup-cron.ps1 -SkipDeploy -OnlyOnIssues
#
param(
  [switch]$SkipDeploy,
  [switch]$OnlyOnIssues,
  [string]$Project = 'agentic-ai-amro',
  [string]$Region = 'europe-west1',
  [string]$Service = 'amrogen-backend',
  [string]$JobName = 'amrogen-keys-topup-daily',
  [string]$Schedule = '0 7 * * *',
  [string]$TimeZone = 'Europe/London'
)

$ErrorActionPreference = 'Stop'

$backendRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envProd = Join-Path $backendRoot '.env.production'

function Get-EnvFileValue {
  param([string]$Path, [string]$Key)
  if (-not (Test-Path $Path)) { return $null }
  $pattern = '^\s*' + [regex]::Escape($Key) + '\s*='
  $line = Get-Content $Path | Where-Object { $_ -match $pattern } | Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -replace $pattern, '').Trim().Trim('"').Trim("'")
}

function Ensure-CronSecretInEnvProduction {
  $existing = Get-EnvFileValue -Path $envProd -Key 'CRON_SECRET'
  if ($existing) { return $existing }

  if (-not (Test-Path $envProd)) {
    throw ".env.production not found at $envProd (needed for CRON_SECRET)."
  }

  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $generated = -join ($bytes | ForEach-Object { $_.ToString('x2') })

  Add-Content -Path $envProd -Value ''
  Add-Content -Path $envProd -Value ("# Daily keys/top-up cron (Cloud Scheduler) - generated " + (Get-Date -Format o))
  Add-Content -Path $envProd -Value "CRON_SECRET=$generated"
  Add-Content -Path $envProd -Value 'DAILY_KEYS_REPORT_EMAIL=info@amrogen.com'
  Write-Host 'Appended CRON_SECRET (+ report email defaults) to backend/.env.production (value not printed).' -ForegroundColor Yellow
  return $generated
}

function Ensure-HttpSchedulerJob {
  param(
    [string]$Name,
    [string]$JobUri,
    [string]$JobSchedule,
    [string]$CronSecret,
    [string]$Deadline = '180s'
  )
  $gcloudCmd = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
  if ($gcloudCmd) { $gcloudExe = $gcloudCmd.Source }
  else { $gcloudExe = (Get-Command gcloud).Source }

  $authHeader = "Authorization=Bearer $CronSecret"
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  Write-Host "Recreating Scheduler job $Name (delete+create; avoids update --headers bugs)..." -ForegroundColor Cyan
  & $gcloudExe scheduler jobs delete $Name --project=$Project --location=$Region --quiet 2>$null | Out-Null
  $ErrorActionPreference = $prevEap

  & $gcloudExe scheduler jobs create http $Name `
    --project=$Project `
    --location=$Region `
    --schedule=$JobSchedule `
    --time-zone=$TimeZone `
    --uri=$JobUri `
    --http-method=GET `
    "--headers=$authHeader" `
    --attempt-deadline=$Deadline
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to ensure scheduler job $Name (exit $LASTEXITCODE)"
  }
}

if (-not $SkipDeploy) {
  Write-Host 'This script does not deploy Cloud Run. Re-run with -SkipDeploy after the backend is live.' -ForegroundColor Yellow
  Write-Host 'Example: .\setup-keys-topup-cron.ps1 -SkipDeploy' -ForegroundColor Cyan
  exit 1
}

try {
  $certBundle = & python -c 'import certifi; print(certifi.where())' 2>$null
  if ($certBundle -and (Test-Path $certBundle)) {
    $env:SSL_CERT_FILE = $certBundle
    $env:REQUESTS_CA_BUNDLE = $certBundle
    gcloud config set core/custom_ca_certs_file $certBundle 2>$null | Out-Null
  }
} catch {
  # Non-fatal
}

$null = Get-Command gcloud -ErrorAction Stop

Write-Host "Project=$Project Region=$Region Service=$Service Job=$JobName"

Write-Host 'Ensuring Cloud Scheduler API is enabled...' -ForegroundColor Cyan
gcloud services enable cloudscheduler.googleapis.com --project=$Project
if ($LASTEXITCODE -ne 0) {
  throw 'Failed to enable cloudscheduler.googleapis.com. Run: gcloud services enable cloudscheduler.googleapis.com --project=agentic-ai-amro'
}

$cronSecret = Ensure-CronSecretInEnvProduction
if (-not $cronSecret) { throw 'CRON_SECRET empty' }

Write-Host 'Ensuring CRON_SECRET + DAILY_KEYS_REPORT_EMAIL on Cloud Run service...' -ForegroundColor Cyan
$email = Get-EnvFileValue -Path $envProd -Key 'DAILY_KEYS_REPORT_EMAIL'
if (-not $email) { $email = 'info@amrogen.com' }
$updateVars = "CRON_SECRET=$cronSecret,DAILY_KEYS_REPORT_EMAIL=$email"

gcloud run services update $Service `
  --project=$Project `
  --region=$Region `
  --update-env-vars=$updateVars
if ($LASTEXITCODE -ne 0) {
  throw 'Failed to update Cloud Run env with CRON_SECRET'
}

$serviceUrl = (gcloud run services describe $Service --project=$Project --region=$Region --format='value(status.url)').Trim()
if (-not $serviceUrl) { throw 'Could not resolve Cloud Run service URL' }

$uri = "$serviceUrl/internal/cron/keys-topup-report"
if ($OnlyOnIssues) { $uri = "$uri" + '?onlyOnIssues=1' }

Ensure-HttpSchedulerJob -Name $JobName -JobUri $uri -JobSchedule $Schedule -CronSecret $cronSecret -Deadline '180s'
if ($LASTEXITCODE -ne 0) {
  Write-Host 'gcloud scheduler failed for keys-topup. Create manually:' -ForegroundColor Red
  Write-Host "  URI=$uri"
  Write-Host '  Header Authorization=Bearer (CRON_SECRET from backend/.env.production)'
  exit 1
}

Write-Host ''
Write-Host 'Verifying dry-run...' -ForegroundColor Cyan
$tmp = [System.IO.Path]::GetTempFileName()
try {
  $dryUrl = $serviceUrl + '/internal/cron/keys-topup-report?dryRun=1'
  curl.exe -sS -H "Authorization: Bearer $cronSecret" $dryUrl -o $tmp
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Dry-run curl failed (route may not be live yet - redeploy code).' -ForegroundColor Yellow
  } else {
    $json = Get-Content $tmp -Raw | ConvertFrom-Json
    Write-Host ("  ok=$($json.ok) dry_run=$($json.dry_run) to=$($json.to) subject=$($json.subject)")
  }
} finally {
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host "Done. Job=$JobName schedule=$Schedule ($TimeZone)" -ForegroundColor Green
Write-Host "URI=$uri"
Write-Host 'Emails go to DAILY_KEYS_REPORT_EMAIL / DAILY_DIGEST_TO / info@amrogen.com'
exit 0
