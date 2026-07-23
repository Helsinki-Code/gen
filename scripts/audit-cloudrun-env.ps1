# Pull Cloud Run env for AmroGen backend + frontend and validate required keys.
# Never prints secret values - only status (OK / MISSING / EMPTY / PLACEHOLDER / WARN).
#
# Usage:
#   powershell -NoProfile -File c:\projects\agenticai\agentic-ai-amro-cleaned\amrogen\scripts\audit-cloudrun-env.ps1

param(
  [string]$Project = "agentic-ai-amro",
  [string]$Region = "europe-west1",
  [string]$BackendService = "amrogen-backend",
  [string]$FrontendService = "amrogen-frontend"
)

$ErrorActionPreference = "Stop"

function Get-CloudRunEnv {
  param([string]$Service)
  $json = gcloud run services describe $Service `
    --region=$Region `
    --project=$Project `
    --format=json 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "gcloud describe failed for $Service : $json"
  }
  $obj = $json | ConvertFrom-Json
  $map = @{}
  $envList = $obj.spec.template.spec.containers[0].env
  if ($envList) {
    foreach ($e in $envList) {
      if ($null -ne $e.name) {
        $map[$e.name] = [string]$e.value
      }
    }
  }
  return $map
}

function Test-Placeholder([string]$Key, [string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return $true }
  $v = $Value.ToLowerInvariant()
  $patterns = @(
    "your-", "change-me", "example.com", "localhost", "127.0.0.1",
    "redis://your-redis", "redis://localhost",
    "postgresql+asyncpg://user:password", "https://your-", "http://localhost"
  )
  foreach ($p in $patterns) {
    if ($v.Contains($p)) { return $true }
  }
  if ($Value -match '\.\.\.$') { return $true }
  return $false
}

function Assert-Key {
  param(
    [hashtable]$EnvMap,
    [string]$Key,
    [ValidateSet("required", "recommended", "optional")]
    [string]$Level,
    [scriptblock]$ExtraCheck = $null
  )
  $status = "OK"
  $detail = ""
  if (-not $EnvMap.ContainsKey($Key)) {
    $status = "MISSING"
  } elseif ([string]::IsNullOrWhiteSpace($EnvMap[$Key])) {
    $status = "EMPTY"
  } elseif (Test-Placeholder $Key $EnvMap[$Key]) {
    $status = "PLACEHOLDER"
    $detail = "looks like a template/local value"
  } elseif ($ExtraCheck) {
    $extra = & $ExtraCheck $EnvMap[$Key]
    if ($extra) {
      $status = "WARN"
      $detail = [string]$extra
    }
  }

  $icon = switch ($status) {
    "OK" { "[OK]" }
    "MISSING" { "[FAIL]" }
    "EMPTY" { "[FAIL]" }
    "PLACEHOLDER" { "[FAIL]" }
    "WARN" { "[WARN]" }
  }

  if ($Level -eq "optional" -and $status -ne "OK") {
    Write-Host "  [SKIP] $Key ($status, optional)" -ForegroundColor DarkGray
    return @{ Key = $Key; Status = "SKIP"; Level = $Level }
  }

  $line = "  $icon $Key"
  if ($detail) { $line += " - $detail" }
  if ($status -eq "OK") {
    Write-Host $line -ForegroundColor Green
  } elseif ($status -eq "WARN") {
    Write-Host $line -ForegroundColor Yellow
  } else {
    Write-Host $line -ForegroundColor Red
  }
  return @{ Key = $Key; Status = $status; Level = $Level }
}

Write-Host "Auditing Cloud Run env - project=$Project region=$Region" -ForegroundColor Cyan
Write-Host ""

$failures = 0
$warnings = 0

Write-Host "=== $BackendService ===" -ForegroundColor Cyan
try {
  $be = Get-CloudRunEnv -Service $BackendService
  Write-Host ("  ({0} env vars on service)" -f $be.Count) -ForegroundColor DarkGray

  # Prod uses DB_* components (app builds the URL). Do not require DATABASE_URL.
  $dbParts = @("DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME")
  $dbPartsOk = $true
  foreach ($k in $dbParts) {
    if (-not $be.ContainsKey($k) -or [string]::IsNullOrWhiteSpace($be[$k]) -or (Test-Placeholder $k $be[$k])) {
      $dbPartsOk = $false
      break
    }
  }
  if ($dbPartsOk) {
    Write-Host "  [OK] DB_HOST / DB_USER / DB_PASSWORD / DB_NAME" -ForegroundColor Green
    if ($be.ContainsKey("DATABASE_URL") -and -not [string]::IsNullOrWhiteSpace($be["DATABASE_URL"])) {
      Write-Host "  [WARN] DATABASE_URL is set but unused when DB_* are present — remove it from Cloud Run" -ForegroundColor Yellow
      $warnings++
    }
  } else {
    Write-Host "  [FAIL] Database config — need DB_HOST, DB_USER, DB_PASSWORD, DB_NAME" -ForegroundColor Red
    $failures++
    foreach ($k in $dbParts) {
      $null = Assert-Key -EnvMap $be -Key $k -Level "required"
    }
  }
  if ($be.ContainsKey("REDIS_URL") -and -not [string]::IsNullOrWhiteSpace($be["REDIS_URL"])) {
    Write-Host "  [WARN] REDIS_URL is set but unused — remove it from Cloud Run" -ForegroundColor Yellow
    $warnings++
  }

  $backendChecks = @(
    @{ Key = "JWT_SECRET"; Level = "required" },
    @{ Key = "LOCAL_ENCRYPTION_KEY"; Level = "required"; Extra = { param($v) if ($v.Length -lt 32) { "should be >= 32 chars" } } },
    @{ Key = "ENVIRONMENT"; Level = "required"; Extra = { param($v) if ($v -ne "production") { "expected production, got '$v'" } } },
    @{ Key = "FRONTEND_URL"; Level = "required"; Extra = { param($v) if ($v -notmatch '^https://') { "expected https URL" } } },
    @{ Key = "API_BASE_URL"; Level = "recommended"; Extra = { param($v) if ($v -notmatch '^https://') { "expected https URL" } } },
    @{ Key = "ADMIN_EMAILS"; Level = "required" },
    @{ Key = "ANTHROPIC_API_KEY"; Level = "required" },
    @{ Key = "LEAD_AGENT_ID"; Level = "required" },
    @{ Key = "LEAD_ENV_ID"; Level = "required" },
    @{ Key = "OUTREACH_AGENT_ID"; Level = "required" },
    @{ Key = "OUTREACH_ENV_ID"; Level = "required" },
    @{ Key = "EMAIL_AGENT_ID"; Level = "recommended" },
    @{ Key = "EMAIL_ENV_ID"; Level = "recommended" },
    @{ Key = "SMS_AGENT_ID"; Level = "recommended" },
    @{ Key = "SMS_ENV_ID"; Level = "recommended" },
    @{ Key = "REPLY_MONITOR_AGENT_ID"; Level = "recommended" },
    @{ Key = "REPLY_MONITOR_ENV_ID"; Level = "recommended" },
    @{ Key = "ORCHESTRATOR_AGENT_ID"; Level = "recommended" },
    @{ Key = "ORCHESTRATOR_ENV_ID"; Level = "recommended" },
    @{ Key = "COORDINATOR_AGENT_ID"; Level = "recommended" },
    @{ Key = "COORDINATOR_ENV_ID"; Level = "recommended" },
    @{ Key = "VAULT_IDS"; Level = "recommended" },
    @{ Key = "STRIPE_SECRET_KEY"; Level = "required" },
    @{ Key = "STRIPE_PRICE_STARTER"; Level = "required" },
    @{ Key = "STRIPE_PRICE_PROFESSIONAL"; Level = "required" },
    @{ Key = "STRIPE_PRICE_ENTERPRISE"; Level = "required" },
    @{ Key = "STRIPE_WEBHOOK_SECRET"; Level = "recommended" },
    @{ Key = "RESEND_API_KEY"; Level = "recommended" },
    @{ Key = "GEMINI_API_KEY"; Level = "recommended" },
    @{ Key = "GCS_BUCKET_NAME"; Level = "recommended" },
    @{ Key = "CRON_SECRET"; Level = "recommended" },
    @{ Key = "DAILY_DIGEST_TO"; Level = "recommended" },
    @{ Key = "ACCOUNT_DISCOVERY_ENABLED"; Level = "optional" },
    @{ Key = "DISCOVERY_AGENT_ID"; Level = "optional" },
    @{ Key = "DISCOVERY_ENV_ID"; Level = "optional" }
  )

  foreach ($c in $backendChecks) {
    $r = Assert-Key -EnvMap $be -Key $c.Key -Level $c.Level -ExtraCheck $c.Extra
    if ($r.Status -in @("MISSING", "EMPTY", "PLACEHOLDER") -and $c.Level -eq "required") {
      $failures++
    } elseif ($r.Status -in @("MISSING", "EMPTY", "PLACEHOLDER", "WARN") -and $c.Level -eq "recommended") {
      $warnings++
    } elseif ($r.Status -eq "WARN" -and $c.Level -eq "required") {
      $warnings++
    }
  }

  $discOn = ($be["ACCOUNT_DISCOVERY_ENABLED"] -eq "true" -or $be["ACCOUNT_DISCOVERY_ENABLED"] -eq "1")
  if ($discOn) {
    Write-Host "  Discovery flag is ON - checking agent wiring..." -ForegroundColor Cyan
    foreach ($k in @("DISCOVERY_AGENT_ID", "DISCOVERY_ENV_ID")) {
      $r = Assert-Key -EnvMap $be -Key $k -Level "required"
      if ($r.Status -ne "OK") { $failures++ }
    }
  } else {
    Write-Host "  [INFO] ACCOUNT_DISCOVERY_ENABLED is not true - discovery create stays disabled" -ForegroundColor DarkGray
  }
} catch {
  Write-Host "  [FAIL] Could not read backend env: $_" -ForegroundColor Red
  $failures++
}

Write-Host ""
Write-Host "=== $FrontendService ===" -ForegroundColor Cyan
try {
  $fe = Get-CloudRunEnv -Service $FrontendService
  Write-Host ("  ({0} env vars on service)" -f $fe.Count) -ForegroundColor DarkGray

  $frontendChecks = @(
    @{ Key = "AMROGEN_BACKEND_URL"; Level = "required"; Extra = { param($v) if ($v -notmatch '^https://') { "expected https backend URL" } } },
    @{ Key = "NEXT_PUBLIC_API_URL"; Level = "required"; Extra = { param($v) if ($v -notmatch '^https://') { "expected https backend URL" } } },
    @{ Key = "NEXT_PUBLIC_APP_URL"; Level = "recommended"; Extra = { param($v) if ($v -notmatch '^https://') { "expected https app URL" } } },
    @{ Key = "NEXT_PUBLIC_SITE_URL"; Level = "recommended"; Extra = { param($v) if ($v -notmatch '^https://') { "expected https site URL" } } }
  )

  foreach ($c in $frontendChecks) {
    $r = Assert-Key -EnvMap $fe -Key $c.Key -Level $c.Level -ExtraCheck $c.Extra
    if ($r.Status -in @("MISSING", "EMPTY", "PLACEHOLDER") -and $c.Level -eq "required") {
      $failures++
    } elseif ($r.Status -in @("MISSING", "EMPTY", "PLACEHOLDER", "WARN") -and $c.Level -eq "recommended") {
      $warnings++
    }
  }

  $apiUrl = $fe["AMROGEN_BACKEND_URL"]
  if (-not $apiUrl) { $apiUrl = $fe["NEXT_PUBLIC_API_URL"] }
  if ($apiUrl -and $apiUrl -notmatch 'amrogen-backend') {
    Write-Host "  [WARN] Frontend API URL does not look like amrogen-backend" -ForegroundColor Yellow
    $warnings++
  }
} catch {
  Write-Host "  [FAIL] Could not read frontend env: $_" -ForegroundColor Red
  $failures++
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
if ($failures -eq 0 -and $warnings -eq 0) {
  Write-Host "All checked env vars look valid." -ForegroundColor Green
  exit 0
}
if ($failures -eq 0) {
  Write-Host "No hard failures; $warnings warning(s)." -ForegroundColor Yellow
  exit 0
}
Write-Host "$failures failure(s), $warnings warning(s)." -ForegroundColor Red
exit 1
