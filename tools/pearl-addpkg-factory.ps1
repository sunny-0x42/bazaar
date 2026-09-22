# Pearl addpkg for Bazaar collection factory (not nftv7).
# Password: $env:GNOKEY_PASS or gnomemepad/.env.deploy (never printed).
param(
  [string]$KeyName = "deploykey",
  [string]$Address = "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt",
  [string]$Remote = "https://rpc.pearl.testnets.gno.land:443",
  [string]$ChainId = "pearl-1",
  [string]$GasFee = "1000000ugnot",
  [int]$GasWanted = 200000000,
  [string]$MaxDeposit = "90000000ugnot",
  [string]$LaunchFeeUgnot = "10000000",
  [string]$FactoryName = "factoryv3"
)
$ErrorActionPreference = "Stop"
$ROOT = Split-Path $PSScriptRoot -Parent
Set-Location $ROOT
$env:PATH = "C:\Users\Hi\tools;$env:PATH"

$common = "C:\Users\Hi\gnomemepad\scripts\gnokey-common.ps1"
if (-not (Test-Path $common)) { throw "gnokey-common.ps1 missing" }
. $common
Initialize-GnokeyPath
Import-DotEnvDeploy -Root "C:\Users\Hi\gnomemepad"
Import-DotEnvDeploy -Root $ROOT
if ($env:GNOKEY_NAME) { $KeyName = $env:GNOKEY_NAME }
if ($env:BAZAAR_DEPLOYER) { $Address = $env:BAZAAR_DEPLOYER }
Assert-DeployKeyExists -KeyName $KeyName -ExpectedAddress $Address

if ($FactoryName -eq "factory" -or $FactoryName -eq "factoryv2") {
  throw "Pearl factory/factoryv2 are frozen. Use factoryv3 (Reserve)."
}

$factoryPath = "gno.land/r/$Address/bazaar/$FactoryName"
$stage = Join-Path $ROOT "deploy\pearl"
$factoryDir = Join-Path $stage "r\$Address\bazaar\$FactoryName"
New-Item -ItemType Directory -Force -Path $factoryDir | Out-Null

Get-ChildItem (Join-Path $ROOT "gno.land\r\bazaar\factory") -Filter "*.gno" | Where-Object { $_.Name -notlike "*_test*" } | ForEach-Object {
  $src = Get-Content $_.FullName -Raw -Encoding UTF8
  $src = $src.Replace("package factory`n", "package $FactoryName`n")
  $src = $src.Replace("package factory`r`n", "package $FactoryName`r`n")
  $src = $src.Replace("gno.land/r/bazaar/factory", $factoryPath)
  [IO.File]::WriteAllText((Join-Path $factoryDir $_.Name), $src)
}
Set-Content -Path (Join-Path $factoryDir "gnomod.toml") -Encoding ascii -Value @"
module = "$factoryPath"
gno = "0.9"
"@

function Add-Pkg([string]$PkgPath, [string]$PkgDir, [string]$Step) {
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

function Call-Fn([string]$Func, [string[]]$FnArgs, [string]$Send, [string]$Step) {
  $cmd = @(
    "maketx", "call", $KeyName,
    "--pkgpath", $factoryPath,
    "--func", $Func,
    "--gas-fee", $GasFee,
    "--gas-wanted", "80000000",
    "--chainid", $ChainId,
    "--remote", $Remote,
    "--broadcast"
  )
  foreach ($a in $FnArgs) { $cmd += @("--args", $a) }
  if ($Send) { $cmd += @("--send", $Send) }
  Invoke-Gnokey -StepName $Step -Args $cmd
}

Add-Pkg $factoryPath $factoryDir "addpkg factory"
Call-Fn "Init" @() "" "Init factory"
Call-Fn "SetLaunchFee" @($LaunchFeeUgnot) "" "SetLaunchFee $LaunchFeeUgnot"

Write-Host "FACTORY_PKG=$factoryPath"
Write-Host "LaunchFee=$LaunchFeeUgnot ugnot"
Write-Host "New collection: powershell -File tools\pearl-new-col.ps1 -Slug <slug> then Adena Init on that pkg"
