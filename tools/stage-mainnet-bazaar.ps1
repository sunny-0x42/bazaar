# Stage gnoland-1 package dirs under deploy/mainnet/. No chain writes.
param(
  [string]$Address = "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt"
)
$ErrorActionPreference = "Stop"
$ROOT = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot "mainnet-bazaar.ps1")
$m = Stage-BazaarMainnet -Root $ROOT -Address $Address
Write-Host "STAGE=$($m.StageRoot)"
Write-Host "Next: read docs/mainnet-deploy.md then tools/mainnet-addpkg-bazaar.ps1 -Broadcast (human yes)."
