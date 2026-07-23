# Run from anywhere: .\sync-stripe-env.ps1 [-EnsurePrices]
param([switch]$EnsurePrices)

$BackendRoot = $PSScriptRoot
$Script = Join-Path $BackendRoot "scripts\sync-stripe-env.mjs"
$Args = @($Script)
if ($EnsurePrices) { $Args += "--ensure-prices" }

Push-Location $BackendRoot
try {
  node @Args
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}
