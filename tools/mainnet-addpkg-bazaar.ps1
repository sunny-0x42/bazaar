# addpkg Bazaar stack on gnoland-1. Default is stage-only (no broadcast).
# GPAO EnablePackage is paid by the chain oracle, not this key.
param(
  [switch]$Broadcast,
  [string]$KeyName = "deploykey",
  [string]$Address = "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt",
  [string]$Remote = "https://rpc.gno.land:443",
  [string]$ChainId = "gnoland-1",
  [string]$GasFee = "1000000ugnot",
  [int]$GasWanted = 200000000,
  [string]$MaxDeposit = "90000000ugnot"
)
$ErrorActionPreference = "Stop"
$ROOT = Split-Path $PSScriptRoot -Parent
Set-Location $ROOT
$env:PATH = "C:\Users\Hi\tools;$env:PATH"
. (Join-Path $PSScriptRoot "mainnet-bazaar.ps1")

$m = Stage-BazaarMainnet -Root $ROOT -Address $Address
if (-not $Broadcast) {
  Write-Host "Staged only. Re-run with -Broadcast after you confirm CLA + liquid GNOT."
  Write-Host "docs/mainnet-deploy.md"
  exit 0
}

$common = "C:\Users\Hi\gnomemepad\scripts\gnokey-common.ps1"
if (-not (Test-Path $common)) { throw "gnokey-common.ps1 missing" }
. $common
Initialize-GnokeyPath
Import-DotEnvDeploy -Root "C:\Users\Hi\gnomemepad"
Import-DotEnvDeploy -Root $ROOT
if ($env:GNOKEY_NAME) { $KeyName = $env:GNOKEY_NAME }
if ($env:BAZAAR_DEPLOYER) { $Address = $env:BAZAAR_DEPLOYER }
Assert-DeployKeyExists -KeyName $KeyName -ExpectedAddress $Address

function Add-MainnetPkg([string]$PkgPath, [string]$PkgDir, [string]$Step) {
  $q = & gnokey query vm/qpaths --data $PkgPath --remote $Remote 2>&1 | Out-String
  if ($q -match [regex]::Escape($PkgPath) -and $q -notmatch "unknown|not found|invalid") {
    Write-Host "Already on chain (may still be inert): $PkgPath"
    return
  }
  Invoke-Gnokey -StepName $Step -Args @(
    "maketx", "addpkg", $KeyName,
    "--pkgpath", $PkgPath,
    "--pkgdir", $PkgDir,
    "--gas-fee", $GasFee,
    "--gas-wanted", "$GasWanted",
    "--max-deposit", $MaxDeposit,
    "--chainid", $ChainId,
    "--remote", $Remote,
    "--broadcast"
  )
}

function Wait-PkgEval([string]$PkgPath, [string]$Expr, [int]$Tries = 80) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    for ($i = 0; $i -lt $Tries; $i++) {
      $out = ""
      try {
        $out = & gnokey query vm/qeval -data "$PkgPath.$Expr" -remote $Remote 2>&1 | Out-String
      } catch {
        $out = [string]$_
      }
      if ($out -match '\(' -and $out -notmatch 'invalid package|not enabled|inert|unknown') {
        Write-Host "Enabled: $PkgPath"
        return
      }
      Write-Host "GPAO wait $PkgPath ($($i+1)/$Tries)"
      Start-Sleep -Seconds 15
    }
    throw "Package still inert after wait: $PkgPath"
  } finally {
    $ErrorActionPreference = $prev
  }
}

Add-MainnetPkg $m.FeePath $m.FeeDir "addpkg fee/v1"
Wait-PkgEval $m.FeePath "ProtocolFee(10000,50)"
Add-MainnetPkg $m.Grc721Path $m.Grc721Dir "addpkg grc721/v0"
Wait-PkgEval $m.Grc721Path "MaxSymbolLen"
Add-MainnetPkg $m.MetaPath $m.MetaDir "addpkg grc721/metadata/v0"
Wait-PkgEval $m.MetaPath "MetadataUpdateEvent"
Add-MainnetPkg $m.FactoryPath $m.FactoryDir "addpkg factory"
Wait-PkgEval $m.FactoryPath "Address()"

Write-Host "FACTORY=$($m.FactoryPath)"
Write-Host "Next: gnokey call Init on factory (EOA). LaunchFee is 10 GNOT in staged source."
Write-Host "Then: tools/mainnet-new-col.ps1 -Slug NAME -Broadcast"
