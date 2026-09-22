# Pearl addpkg for Bazaar fee + nft. Signs with the user's existing deploykey.
# Password: $env:GNOKEY_PASS or gnomemepad/.env.deploy (never printed).
param(
  [string]$KeyName = "deploykey",
  [string]$Address = "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt",
  [string]$Remote = "https://rpc.pearl.testnets.gno.land:443",
  [string]$ChainId = "pearl-1",
  [string]$GasFee = "1000000ugnot",
  [int]$GasWantedFee = 80000000,
  [int]$GasWantedNft = 300000000,
  [int]$GasWantedGrc721 = 200000000,
  [string]$MaxDeposit = "90000000ugnot",
  [string]$NftName = "nftv7"
)
$ErrorActionPreference = "Stop"
$ROOT = Split-Path (Split-Path $PSScriptRoot -Parent) -ErrorAction SilentlyContinue
if (-not $ROOT -or -not (Test-Path (Join-Path $ROOT "gno.land"))) {
  $ROOT = Split-Path $PSScriptRoot -Parent
}
Set-Location $ROOT
$env:PATH = "C:\Users\Hi\tools;$env:PATH"

$common = "C:\Users\Hi\gnomemepad\scripts\gnokey-common.ps1"
if (-not (Test-Path $common)) { throw "gnokey-common.ps1 missing" }
. $common
Initialize-GnokeyPath
Import-DotEnvDeploy -Root "C:\Users\Hi\gnomemepad"
Import-DotEnvDeploy -Root $ROOT
if ($env:GNOKEY_NAME) { $KeyName = $env:GNOKEY_NAME }
# Signing key `deploykey` on this machine is g1n4pl5… (Pearl namespace).
# Do not take GNOKEY_ADDR from gnomemepad .env.deploy (that is g1mv0052…).
if ($env:BAZAAR_DEPLOYER) { $Address = $env:BAZAAR_DEPLOYER }

Assert-DeployKeyExists -KeyName $KeyName -ExpectedAddress $Address

if ($NftName -eq "nftv5" -or $NftName -eq "nftv6") {
  throw "nftv5/nftv6 are frozen on Pearl. Use nftv7 (default) or a later name."
}

$feePath = "gno.land/p/$Address/bazaar/fee/v1"
$grc721Root = "gno.land/p/$Address/bazaar/grc721"
$grc721v0Path = "$grc721Root/v0"
$grc721MetaPath = "$grc721Root/metadata/v0"
$grc721EnumPath = "$grc721Root/enumerable/v0"
$grc721RoyalPath = "$grc721Root/royalty/v0"
$nftPath = "gno.land/r/$Address/bazaar/$NftName"
$stage = Join-Path $ROOT "deploy\pearl"
$feeDir = Join-Path $stage "p\$Address\bazaar\fee\v1"
$nftDir = Join-Path $stage "r\$Address\bazaar\$NftName"
New-Item -ItemType Directory -Force -Path $feeDir | Out-Null
New-Item -ItemType Directory -Force -Path $nftDir | Out-Null

Copy-Item (Join-Path $ROOT "gno.land\p\bazaar\fee\v1\fee.gno") $feeDir -Force
Set-Content -Path (Join-Path $feeDir "gnomod.toml") -Encoding ascii -Value @"
module = "$feePath"
gno = "0.9"
"@

function Stage-Grc721([string]$RelDir, [string]$ModPath) {
  $srcDir = Join-Path $ROOT "gno.land\p\bazaar\grc721\$RelDir"
  $dstDir = Join-Path $stage "p\$Address\bazaar\grc721\$RelDir"
  New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
  Get-ChildItem $srcDir -Filter "*.gno" | Where-Object { $_.Name -notlike "*_test*" } | ForEach-Object {
    $src = Get-Content $_.FullName -Raw -Encoding UTF8
    $src = $src.Replace("gno.land/p/bazaar/grc721", $grc721Root)
    [IO.File]::WriteAllText((Join-Path $dstDir $_.Name), $src)
  }
  Set-Content -Path (Join-Path $dstDir "gnomod.toml") -Encoding ascii -Value @"
module = "$ModPath"
gno = "0.9"
"@
}

Stage-Grc721 "v0" $grc721v0Path
Stage-Grc721 "metadata\v0" $grc721MetaPath
Stage-Grc721 "enumerable\v0" $grc721EnumPath
Stage-Grc721 "royalty\v0" $grc721RoyalPath

Get-ChildItem (Join-Path $ROOT "gno.land\r\bazaar\nft") -Filter "*.gno" | Where-Object { $_.Name -notlike "*_test*" } | ForEach-Object {
  $src = Get-Content $_.FullName -Raw -Encoding UTF8
  $src = $src.Replace("gno.land/p/bazaar/fee/v1", $feePath)
  $src = $src.Replace("gno.land/p/bazaar/grc721", $grc721Root)
  # Last path element must match `package` name.
  $src = $src.Replace("package nft`n", "package $NftName`n")
  $src = $src.Replace("package nft`r`n", "package $NftName`r`n")
  [IO.File]::WriteAllText((Join-Path $nftDir $_.Name), $src)
}
Set-Content -Path (Join-Path $nftDir "gnomod.toml") -Encoding ascii -Value @"
module = "$nftPath"
gno = "0.9"
"@

Write-Host "Staged $feePath, GRC721, and $nftPath"

function Add-Pkg([string]$PkgPath, [string]$PkgDir, [int]$GasWanted, [string]$Step) {
  $q = & gnokey query vm/qpaths --data $PkgPath --remote $Remote 2>&1 | Out-String
  if ($q -match [regex]::Escape($PkgPath) -and $q -notmatch "unknown|not found|invalid") {
    Write-Host "Already on chain: $PkgPath"
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

function Call-Fn([string]$PkgPath, [string]$Func, [string[]]$FnArgs, [string]$Send, [string]$Step) {
  $cmd = @(
    "maketx", "call", $KeyName,
    "--pkgpath", $PkgPath,
    "--func", $Func,
    "--gas-fee", $GasFee,
    "--gas-wanted", "400000000",
    "--chainid", $ChainId,
    "--remote", $Remote,
    "--broadcast"
  )
  foreach ($a in $FnArgs) { $cmd += @("--args", $a) }
  if ($Send) { $cmd += @("--send", $Send) }
  Invoke-Gnokey -StepName $Step -Args $cmd
}

Add-Pkg $feePath $feeDir $GasWantedFee "addpkg fee/v1"
Add-Pkg $grc721v0Path (Join-Path $stage "p\$Address\bazaar\grc721\v0") $GasWantedGrc721 "addpkg grc721/v0"
Add-Pkg $grc721MetaPath (Join-Path $stage "p\$Address\bazaar\grc721\metadata\v0") $GasWantedGrc721 "addpkg grc721/metadata/v0"
Add-Pkg $grc721EnumPath (Join-Path $stage "p\$Address\bazaar\grc721\enumerable\v0") $GasWantedGrc721 "addpkg grc721/enumerable/v0"
Add-Pkg $grc721RoyalPath (Join-Path $stage "p\$Address\bazaar\grc721\royalty\v0") $GasWantedGrc721 "addpkg grc721/royalty/v0"
Add-Pkg $nftPath $nftDir $GasWantedNft "addpkg nft"

Call-Fn $nftPath "Init" @() "" "Init nft"
Call-Fn $nftPath "SeedSamples" @() "" "SeedSamples"

Write-Host "NFT_PKG=$nftPath"
Write-Host "Set UI Settings NFT path to that value. Pearl faucet: https://pearl.testnets.gno.land/faucet"
