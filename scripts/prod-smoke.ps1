# Production smoke checks for AmroGen (front + back). No secrets printed.
# Usage:
#   powershell -NoProfile -File c:\projects\agenticai\agentic-ai-amro-cleaned\amrogen\scripts\prod-smoke.ps1

param(
  [string]$BaseUrl = "https://amrogen.com",
  [string]$ApiUrl = "https://amrogen-backend-zgoudwucaq-ew.a.run.app"
)

$ErrorActionPreference = "Continue"
$fails = @()
$warns = @()

function Probe-Get([string]$Name, [string]$Url, [int]$Expect = 200, [scriptblock]$Extra = $null) {
  try {
    $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 30
    $code = [int]$r.StatusCode
    if ($code -ne $Expect) {
      $script:fails += "$Name => HTTP $code (expected $Expect)"
      Write-Host "  [FAIL] $Name => $code" -ForegroundColor Red
      return
    }
    if ($Extra) {
      $msg = & $Extra $r
      if ($msg) {
        $script:fails += "$Name => $msg"
        Write-Host "  [FAIL] $Name => $msg" -ForegroundColor Red
        return
      }
    }
    Write-Host "  [OK] $Name => $code" -ForegroundColor Green
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode.value__ }
    $script:fails += "$Name => ERR $code $($_.Exception.Message)"
    Write-Host "  [FAIL] $Name => ERR $code" -ForegroundColor Red
  }
}

Write-Host "=== Frontend $BaseUrl ===" -ForegroundColor Cyan
Probe-Get "home" "$BaseUrl/" 200 {
  param($r)
  if ($r.Content -notmatch '__AMROGEN_API_URL__') { return "missing API URL inject" }
  $null
}
Probe-Get "sign-in" "$BaseUrl/sign-in"
Probe-Get "dashboard" "$BaseUrl/dashboard"
Probe-Get "campaigns" "$BaseUrl/campaigns"
Probe-Get "discoveries" "$BaseUrl/discoveries"
Probe-Get "runtime-config" "$BaseUrl/api/runtime-config" 200 {
  param($r)
  if ($r.Content -notmatch 'amrogen-backend') { return "runtime-config API URL unexpected: $($r.Content.Substring(0,[Math]::Min(120,$r.Content.Length)))" }
  $null
}

Write-Host ""
Write-Host "=== Backend $ApiUrl ===" -ForegroundColor Cyan
Probe-Get "health" "$ApiUrl/health" 200 {
  param($r)
  if ($r.Content -notmatch '"ok"') { return "unexpected body" }
  $null
}
Probe-Get "health/ready" "$ApiUrl/health/ready" 200 {
  param($r)
  if ($r.Content -notmatch 'healthy') { return "not healthy: $($r.Content.Substring(0,[Math]::Min(160,$r.Content.Length)))" }
  $null
}

# Auth-gated should 401 without token
try {
  $r = Invoke-WebRequest -Uri "$ApiUrl/campaigns" -UseBasicParsing -TimeoutSec 20
  $warns += "GET /campaigns returned $($r.StatusCode) without auth (expected 401)"
  Write-Host "  [WARN] GET /campaigns without auth => $($r.StatusCode)" -ForegroundColor Yellow
} catch {
  $code = 0
  if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode.value__ }
  if ($code -eq 401 -or $code -eq 403) {
    Write-Host "  [OK] GET /campaigns without auth => $code" -ForegroundColor Green
  } else {
    $fails += "GET /campaigns without auth => $code"
    Write-Host "  [FAIL] GET /campaigns without auth => $code" -ForegroundColor Red
  }
}

# Cron without secret should 401/503
try {
  $r = Invoke-WebRequest -Uri "$ApiUrl/internal/cron/daily-digest" -Method POST -UseBasicParsing -TimeoutSec 20
  $warns += "POST daily-digest without auth => $($r.StatusCode)"
  Write-Host "  [WARN] cron without auth => $($r.StatusCode)" -ForegroundColor Yellow
} catch {
  $code = 0
  if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode.value__ }
  if ($code -in 401, 403, 404, 503) {
    Write-Host "  [OK] cron without auth => $code (endpoint may be undeployed if 404)" -ForegroundColor Green
    if ($code -eq 404) { $warns += "daily-digest route 404 - backend code with cron router not deployed yet" }
  } else {
    $fails += "cron without auth => $code"
    Write-Host "  [FAIL] cron without auth => $code" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
if ($fails.Count -eq 0 -and $warns.Count -eq 0) {
  Write-Host "All smoke checks passed." -ForegroundColor Green
  exit 0
}
foreach ($w in $warns) { Write-Host "WARN: $w" -ForegroundColor Yellow }
foreach ($f in $fails) { Write-Host "FAIL: $f" -ForegroundColor Red }
if ($fails.Count -gt 0) { exit 1 }
exit 0
