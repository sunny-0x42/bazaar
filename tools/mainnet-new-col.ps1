# Stage (and optionally addpkg) one collection realm from col template for gnoland-1.
# Template imports genesis p/nt/grc721 (Adena) + List/Buy on the same realm.
param(
  [Parameter(Mandatory = $true)]
  [string]$Slug,
  [switch]$Broadcast,
  [string]$KeyName = "deploykey",
  [string]$Address = "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt",
  [string]$Remote = "https://rpc.gno.land:443",
  [string]$ChainId = "gnoland-1",
  [string]$GasFee = "1000000ugnot",
  [int]$GasWanted = 250000000,
  [string]$MaxDeposit = "90000000ugnot"
)
$ErrorActionPreference = "Stop"
$ROOT = Split-Path $PSScriptRoot -Parent
Set-Location $ROOT
$env:PATH = "C:\Users\Hi\tools;$env:PATH"
. (Join-Path $PSScriptRoot "mainnet-bazaar.ps1")

$col = Stage-BazaarMainnetCol -Root $ROOT -Slug $Slug -Address $Address
if (-not $Broadcast) {
  Write-Host "Staged only $($col.Path)"
  Write-Host "Re-run with -Broadcast after factory is enabled + Init."
  exit 0
}

$common = "C:\Users\Hi\gnomemepad\scripts\gnokey-common.ps1"
. $common
Initialize-GnokeyPath
Import-DotEnvDeploy -Root "C:\Users\Hi\gnomemepad"
Import-DotEnvDeploy -Root $ROOT
if ($env:GNOKEY_NAME) { $KeyName = $env:GNOKEY_NAME }
if ($env:BAZAAR_DEPLOYER) { $Address = $env:BAZAAR_DEPLOYER }
Assert-DeployKeyExists -KeyName $KeyName -ExpectedAddress $Address

$q = & gnokey query vm/qpaths --data $col.Path --remote $Remote 2>&1 | Out-String
if ($q -match [regex]::Escape($col.Path) -and $q -notmatch "unknown|not found|invalid") {
  Write-Host "Already on chain: $($col.Path)"
} else {
  Invoke-Gnokey -StepName "addpkg $($col.Path)" -Args @(
    "maketx", "addpkg", $KeyName,
    "--pkgpath", $col.Path,
    "--pkgdir", $col.Dir,
    "--gas-fee", $GasFee,
    "--gas-wanted", "$GasWanted",
    "--max-deposit", $MaxDeposit,
    "--chainid", $ChainId,
    "--remote", $Remote,
    "--broadcast"
  )
}
Write-Host "COL_PKG=$($col.Path)"
Write-Host "Wait GPAO, then Adena Init on that pkg (Reserve slug first or send LaunchFee)."
