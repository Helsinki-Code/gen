# Run from amrogen/ root: .\sync-stripe-env.ps1 [-EnsurePrices]
param([switch]$EnsurePrices)

$Wrapper = Join-Path $PSScriptRoot "scripts\sync-stripe-env.mjs"
$Args = @($Wrapper)
if ($EnsurePrices) { $Args += "--ensure-prices" }

node @Args
exit $LASTEXITCODE
