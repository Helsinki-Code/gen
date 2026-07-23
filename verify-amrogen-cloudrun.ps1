# Verify AmroGen Cloud Run env + smoke tests - run from amrogen/ after deploy.
#
# Usage:
#   .\verify-amrogen-cloudrun.ps1
#   .\verify-amrogen-cloudrun.ps1 -RegenerateEnv
#   .\verify-amrogen-cloudrun.ps1 -BackendOnly
#   .\verify-amrogen-cloudrun.ps1 -FrontendOnly -SkipSmokeTests
#
# Compares local deploy artifacts (.env.production -> deploy/*.yaml) with live Cloud Run
# env var NAMES, checks URL alignment, and hits /health + frontend HTTP. Never prints secrets.

param(
  [switch]$RegenerateEnv,
  [switch]$SkipSmokeTests,
  [switch]$BackendOnly,
  [switch]$FrontendOnly,
  [string]$Project = "agentic-ai-amro",
  [string]$Region = "europe-west1",
  [string]$BackendService = "amrogen-backend",
  [string]$FrontendService = "amrogen-frontend"
)

$ErrorActionPreference = "Stop"

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

if ($BackendOnly -and $FrontendOnly) {
  Write-Error "Use -BackendOnly or -FrontendOnly, not both."
}

$CheckBackend = -not $FrontendOnly
$CheckFrontend = -not $BackendOnly

$RepoRoot = $PSScriptRoot
$BackendRoot = Join-Path $RepoRoot "amrogen\backend"
$FrontendRoot = Join-Path $RepoRoot "amrogen\frontend"
$BackendYaml = Join-Path $BackendRoot "deploy\env.cloudrun.yaml"
$FrontendYaml = Join-Path $FrontendRoot "deploy\env.cloudrun.yaml"
$FrontendBuildVars = Join-Path $FrontendRoot "deploy\cloudrun-build-public.vars"
$BackendProd = Join-Path $BackendRoot ".env.production"
$FrontendProd = Join-Path $FrontendRoot ".env.production"

$script:Failures = 0
$script:Warnings = 0

function Write-Pass([string]$Message) {
  Write-Host "  PASS: $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
  $script:Warnings += 1
  Write-Host "  WARN: $Message" -ForegroundColor Yellow
}

function Write-Fail([string]$Message) {
  $script:Failures += 1
  Write-Host "  FAIL: $Message" -ForegroundColor Red
}

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Normalize-Url([string]$Url) {
  if ([string]::IsNullOrWhiteSpace($Url)) { return "" }
  return $Url.Trim().TrimEnd("/").ToLowerInvariant()
}

function Get-EnvFileValue {
  param(
    [string]$Path,
    [string]$Key
  )

  if (-not (Test-Path $Path)) { return $null }

  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    $eq = $trimmed.IndexOf("=")
    if ($eq -le 0) { continue }
    $name = $trimmed.Substring(0, $eq).Trim()
    if ($name -ne $Key) { continue }
    $value = $trimmed.Substring($eq + 1).Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    return $value
  }

  return $null
}

function Get-YamlEnvKeys {
  param([string]$Path)

  if (-not (Test-Path $Path)) { return @() }

  $keys = @()
  foreach ($line in Get-Content $Path) {
    if ($line -match '^\s*(\w+):') {
      $keys += $Matches[1]
    }
  }
  return $keys | Sort-Object -Unique
}

function Get-BuildVarsKeys {
  param([string]$Path)

  if (-not (Test-Path $Path)) { return @() }

  $keys = @()
  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    $eq = $trimmed.IndexOf("=")
    if ($eq -le 0) { continue }
    $keys += $trimmed.Substring(0, $eq).Trim()
  }
  return $keys | Sort-Object -Unique
}

function Invoke-GcloudDescribe {
  param(
    [string]$Service,
    [string]$Format
  )

  $prev = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  try {
    $result = gcloud run services describe $Service `
      --region $Region `
      --project $Project `
      --format $Format 2>&1
    if ($LASTEXITCODE -ne 0) {
      $msg = ($result | Out-String).Trim()
      if (-not $msg) {
        $msg = "exit code $LASTEXITCODE (check gcloud auth and project access)"
      }
      if ($msg -match 'SSL|certificate|CERTIFICATE') {
        Write-Fail "gcloud SSL error for $Service. Try: pip install certifi, then re-run deploy or this script."
      } else {
        Write-Fail "gcloud describe failed for $Service : $msg"
      }
      return $null
    }
    return $result
  } finally {
    $ErrorActionPreference = $prev
  }
}

function Get-CloudRunEnvKeys {
  param([string]$Service)

  $raw = Invoke-GcloudDescribe -Service $Service -Format "json"
  if (-not $raw) { return @() }

  $json = $raw | ConvertFrom-Json
  if (-not $json.spec.template.spec.containers[0].env) {
    return @()
  }

  return @($json.spec.template.spec.containers[0].env | ForEach-Object { $_.name }) | Sort-Object -Unique
}

function Get-CloudRunUrl {
  param([string]$Service)

  $raw = Invoke-GcloudDescribe -Service $Service -Format "value(status.url)"
  if (-not $raw) { return "" }
  return $raw.ToString().Trim()
}

function Test-KeySet {
  param(
    [string]$Label,
    [string[]]$ExpectedKeys,
    [string[]]$CloudKeys
  )

  if (-not $CloudKeys) {
    Write-Fail "$Label could not load Cloud Run env keys (gcloud describe failed)"
    return
  }

  $missing = Compare-Object $ExpectedKeys $CloudKeys | Where-Object { $_.SideIndicator -eq "<=" }
  $extra = Compare-Object $ExpectedKeys $CloudKeys | Where-Object { $_.SideIndicator -eq "=>" }

  if ($missing) {
    foreach ($item in $missing) {
      Write-Fail "$Label missing on Cloud Run: $($item.InputObject)"
    }
  } else {
    Write-Pass "$Label runtime keys match deploy/env.cloudrun.yaml ($($ExpectedKeys.Count) keys)"
  }

  if ($extra) {
    foreach ($item in $extra) {
      Write-Warn "$Label extra on Cloud Run (not in local yaml): $($item.InputObject)"
    }
  }
}

function Test-RequiredKeysPresent {
  param(
    [string]$Label,
    [string[]]$Keys,
    [string[]]$Required
  )

  foreach ($key in $Required) {
    if ($Keys -notcontains $key) {
      Write-Fail "$Label missing required key: $key"
    }
  }
}

function Test-UrlAlignment {
  param(
    [string]$Label,
    [string]$Configured,
    [string]$Expected,
    [switch]$AllowCustomDomain
  )

  $cfg = Normalize-Url $Configured
  $exp = Normalize-Url $Expected

  if (-not $cfg) {
    Write-Fail "$Label is not set in .env.production"
    return
  }

  if ($cfg -eq $exp) {
    Write-Pass "$Label matches Cloud Run URL"
    return
  }

  if ($AllowCustomDomain -and $cfg -notmatch '\.run\.app$') {
    Write-Warn "$Label is $($Configured) (custom domain). Cloud Run URL is $Expected - confirm DNS maps to the frontend service."
    return
  }

  Write-Fail "$Label is $Configured but Cloud Run URL is $Expected"
}

function Invoke-EnvGenerate {
  param(
    [string]$Name,
    [string]$Dir
  )

  Push-Location $Dir
  try {
    node scripts/generate-cloudrun-env.mjs
    if ($LASTEXITCODE -ne 0) {
      Write-Fail "$Name env generation failed"
    } else {
      Write-Pass "$Name deploy artifacts regenerated from .env.production"
    }
  } finally {
    Pop-Location
  }
}

Write-Host "AmroGen Cloud Run verification (project $Project, region $Region)" -ForegroundColor Cyan

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  Write-Error "gcloud CLI not found. Install Google Cloud SDK and authenticate first."
}

Write-Section "Prerequisites"

if ($RegenerateEnv) {
  if ($CheckBackend) { Invoke-EnvGenerate -Name "Backend" -Dir $BackendRoot }
  if ($CheckFrontend) { Invoke-EnvGenerate -Name "Frontend" -Dir $FrontendRoot }
} else {
  if ($CheckBackend -and -not (Test-Path $BackendYaml)) {
    Write-Warn "Missing $BackendYaml - run with -RegenerateEnv or deploy first."
  }
  if ($CheckFrontend -and -not (Test-Path $FrontendYaml)) {
    Write-Warn "Missing $FrontendYaml - run with -RegenerateEnv or deploy first."
  }
}

$backendUrl = $null
$frontendUrl = $null

if ($CheckBackend) {
  $backendUrl = Get-CloudRunUrl -Service $BackendService
  if (-not $backendUrl) {
    Write-Fail "Backend service '$BackendService' not found or has no URL"
  } else {
    Write-Pass "Backend URL: $backendUrl"
  }
}

if ($CheckFrontend) {
  $frontendUrl = Get-CloudRunUrl -Service $FrontendService
  if (-not $frontendUrl) {
    Write-Fail "Frontend service '$FrontendService' not found or has no URL"
  } else {
    Write-Pass "Frontend URL: $frontendUrl"
  }
}

if ($CheckBackend) {
  Write-Section "Backend environment"

  if (-not (Test-Path $BackendProd)) {
    Write-Fail "Missing $BackendProd"
  } else {
    Write-Pass "Found backend/.env.production"
  }

  if (Test-Path $BackendYaml) {
    $localKeys = Get-YamlEnvKeys -Path $BackendYaml
    $cloudKeys = Get-CloudRunEnvKeys -Service $BackendService
    Test-KeySet -Label "Backend" -ExpectedKeys $localKeys -CloudKeys $cloudKeys

    Test-RequiredKeysPresent -Label "Backend" -Keys $localKeys -Required @(
      "ENVIRONMENT",
      "JWT_SECRET",
      "FRONTEND_URL",
      "API_BASE_URL"
    )

    $hasDbUrl = $localKeys -contains "DATABASE_URL"
    $hasDbParts = ($localKeys -contains "DB_HOST") -and ($localKeys -contains "DB_NAME") -and ($localKeys -contains "DB_USER")
    if (-not $hasDbUrl -and -not $hasDbParts) {
      Write-Fail "Backend deploy yaml has no DATABASE_URL or DB_HOST/DB_NAME/DB_USER"
    } else {
      Write-Pass "Backend database configuration present in deploy yaml"
    }

    $jwt = Get-EnvFileValue -Path $BackendProd -Key "JWT_SECRET"
    if ($jwt -eq "change-me-in-production" -or [string]::IsNullOrWhiteSpace($jwt)) {
      Write-Fail "JWT_SECRET in backend/.env.production is missing or still the default"
    } else {
      Write-Pass "JWT_SECRET is set (value not shown)"
    }

    $environment = Get-EnvFileValue -Path $BackendProd -Key "ENVIRONMENT"
    if ($environment -ne "production") {
      Write-Warn "ENVIRONMENT in backend/.env.production is '$environment' (expected production for Cloud Run)"
    } else {
      Write-Pass "ENVIRONMENT=production"
    }

    if ($localKeys -notcontains "STRIPE_SECRET_KEY") {
      Write-Warn "STRIPE_SECRET_KEY not in deploy yaml - billing will not work"
    }
    if ($environment -eq "production" -and $localKeys -notcontains "STRIPE_WEBHOOK_SECRET") {
      Write-Warn "STRIPE_WEBHOOK_SECRET not in deploy yaml - production webhooks need a Dashboard whsec_..."
    }
    if ($localKeys -notcontains "RESEND_API_KEY") {
      Write-Warn "RESEND_API_KEY not in deploy yaml - auth/transactional email may fail"
    }
    if ($localKeys -contains "REDIS_URL") {
      Write-Warn "REDIS_URL in deploy yaml is unused — remove it (Procrastinate uses Postgres)"
    }
    if ($localKeys -contains "DATABASE_URL" -and ($localKeys -contains "DB_HOST")) {
      Write-Warn "DATABASE_URL set alongside DB_* — prefer DB_* only; remove DATABASE_URL from Cloud Run"
    }

    if ($backendUrl) {
      Test-UrlAlignment `
        -Label "API_BASE_URL" `
        -Configured (Get-EnvFileValue -Path $BackendProd -Key "API_BASE_URL") `
        -Expected $backendUrl
    }

    if ($frontendUrl) {
      Test-UrlAlignment `
        -Label "FRONTEND_URL" `
        -Configured (Get-EnvFileValue -Path $BackendProd -Key "FRONTEND_URL") `
        -Expected $frontendUrl `
        -AllowCustomDomain
    }

    $redirect = Get-EnvFileValue -Path $BackendProd -Key "GOOGLE_REDIRECT_URI"
    if ($redirect -and $backendUrl) {
      $expectedRedirect = "$backendUrl/gmail/callback"
      if ((Normalize-Url $redirect) -ne (Normalize-Url $expectedRedirect)) {
        Write-Warn "GOOGLE_REDIRECT_URI is $redirect - expected $expectedRedirect for Gmail OAuth"
      } else {
        Write-Pass "GOOGLE_REDIRECT_URI matches backend callback path"
      }
    }
  }
}

if ($CheckFrontend) {
  Write-Section "Frontend environment"

  if (-not (Test-Path $FrontendProd)) {
    Write-Fail "Missing $FrontendProd"
  } else {
    Write-Pass "Found frontend/.env.production"
  }

  if (Test-Path $FrontendYaml) {
    $localKeys = Get-YamlEnvKeys -Path $FrontendYaml
    $cloudKeys = Get-CloudRunEnvKeys -Service $FrontendService
    if ($localKeys.Count -eq 0) {
      Write-Pass "Frontend runtime env empty in yaml (only NEXT_PUBLIC_* in build - expected)"
    } else {
      Test-KeySet -Label "Frontend runtime" -ExpectedKeys $localKeys -CloudKeys $cloudKeys
    }
  }

  if (Test-Path $FrontendBuildVars) {
    $buildKeys = Get-BuildVarsKeys -Path $FrontendBuildVars
    $requiredPublic = @("NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SITE_URL")
    Test-RequiredKeysPresent -Label "Frontend build" -Keys $buildKeys -Required $requiredPublic
    Write-Pass "Frontend build vars file has $($buildKeys.Count) keys (NEXT_PUBLIC_* baked at build time)"

    if ($backendUrl) {
      Test-UrlAlignment `
        -Label "NEXT_PUBLIC_API_URL" `
        -Configured (Get-EnvFileValue -Path $FrontendProd -Key "NEXT_PUBLIC_API_URL") `
        -Expected $backendUrl
    }

    if ($frontendUrl) {
      Test-UrlAlignment `
        -Label "NEXT_PUBLIC_APP_URL" `
        -Configured (Get-EnvFileValue -Path $FrontendProd -Key "NEXT_PUBLIC_APP_URL") `
        -Expected $frontendUrl `
        -AllowCustomDomain

      $siteUrl = Get-EnvFileValue -Path $FrontendProd -Key "NEXT_PUBLIC_SITE_URL"
      if ([string]::IsNullOrWhiteSpace($siteUrl)) {
        Write-Fail "NEXT_PUBLIC_SITE_URL is not set"
      } else {
        Write-Pass "NEXT_PUBLIC_SITE_URL is set to $siteUrl"
      }
    }
  } else {
    Write-Fail "Missing $FrontendBuildVars - run node scripts/generate-cloudrun-env.mjs in amrogen/frontend"
  }
}

if ($CheckBackend -and $CheckFrontend -and $backendUrl -and $frontendUrl) {
  Write-Section "Cross-service URLs"
  Write-Host "  Backend:  $backendUrl"
  Write-Host "  Frontend: $frontendUrl"
  Write-Host "  Tip: If using amrogen.com, map the custom domain in Cloud Run and keep FRONTEND_URL / NEXT_PUBLIC_APP_URL on that domain."
}

if (-not $SkipSmokeTests) {
  Write-Section "Smoke tests"

  if ($CheckBackend -and $backendUrl) {
    try {
      $health = Invoke-WebRequest -Uri "$backendUrl/health" -UseBasicParsing -TimeoutSec 45
      if ($health.StatusCode -eq 200 -and $health.Content -match '"status"\s*:\s*"ok"') {
        Write-Pass "GET $backendUrl/health"
      } else {
        Write-Fail "GET $backendUrl/health returned HTTP $($health.StatusCode)"
      }
    } catch {
      Write-Fail "GET $backendUrl/health - $($_.Exception.Message)"
    }
  }

  if ($CheckFrontend -and $frontendUrl) {
    try {
      $frontendResponse = Invoke-WebRequest -Uri $frontendUrl -UseBasicParsing -TimeoutSec 60
      if ($frontendResponse.StatusCode -ge 200 -and $frontendResponse.StatusCode -lt 400) {
        Write-Pass "GET $frontendUrl (HTTP $($frontendResponse.StatusCode))"
      } else {
        Write-Fail "GET $frontendUrl returned HTTP $($frontendResponse.StatusCode)"
      }
    } catch {
      Write-Fail "GET $frontendUrl - $($_.Exception.Message)"
    }

    if ($backendUrl) {
      $apiConfigured = Get-EnvFileValue -Path $FrontendProd -Key "NEXT_PUBLIC_API_URL"
      if ((Normalize-Url $apiConfigured) -eq (Normalize-Url $backendUrl)) {
        Write-Pass "Frontend .env.production points API at live backend URL"
      } else {
        Write-Warn "Rebuild frontend if NEXT_PUBLIC_API_URL changed - value is baked into the JS bundle at deploy time"
      }
    }
  }
}

Write-Section "Summary"
Write-Host "  Failures: $script:Failures"
Write-Host "  Warnings: $script:Warnings"

if ($script:Failures -gt 0) {
  Write-Host ""
  Write-Host "Verification FAILED. Fix .env.production, run:" -ForegroundColor Red
  Write-Host "  .\deploy-amrogen.ps1 -EnvOnly          # push env only"
  Write-Host "  .\deploy-amrogen.ps1 -Frontend         # rebuild if NEXT_PUBLIC_* changed"
  exit 1
}

Write-Host ""
Write-Host "Verification passed." -ForegroundColor Green
if ($script:Warnings -gt 0) {
  Write-Host "Review warnings above (optional keys, custom domains, Stripe webhooks)." -ForegroundColor Yellow
}
exit 0
