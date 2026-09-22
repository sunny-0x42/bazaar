# Pearl addpkg one collection realm from the col template. Does NOT Init (creator Adena Init).
param(
  [Parameter(Mandatory = $true)]
  [string]$Slug,
  [string]$KeyName = "deploykey",
  [string]$Address = "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt",
  [string]$Remote = "https://rpc.pearl.testnets.gno.land:443",
  [string]$ChainId = "pearl-1",
  [string]$GasFee = "1000000ugnot",
  [int]$GasWanted = 250000000,
  [string]$MaxDeposit = "90000000ugnot"
)
$ErrorActionPreference = "Stop"
$ROOT = Split-Path $PSScriptRoot -Parent
Set-Location $ROOT
$env:PATH = "C:\Users\Hi\tools;$env:PATH"

$Slug = $Slug.Trim().ToLowerInvariant()
if ($Slug -notmatch '^[a-z][a-z0-9]{1,10}$') {
  throw "slug must be [a-z][a-z0-9]{1,10} (package name, no hyphen)"
}

$common = "C:\Users\Hi\gnomemepad\scripts\gnokey-common.ps1"
. $common
Initialize-GnokeyPath
Import-DotEnvDeploy -Root "C:\Users\Hi\gnomemepad"
Import-DotEnvDeploy -Root $ROOT
if ($env:GNOKEY_NAME) { $KeyName = $env:GNOKEY_NAME }
if ($env:BAZAAR_DEPLOYER) { $Address = $env:BAZAAR_DEPLOYER }
Assert-DeployKeyExists -KeyName $KeyName -ExpectedAddress $Address

$feePath = "gno.land/p/$Address/bazaar/fee/v1"
$grc721Root = "gno.land/p/$Address/bazaar/grc721"
$factoryPath = "gno.land/r/$Address/bazaar/factoryv3"
$colPath = "gno.land/r/$Address/bazaar/c/$Slug"
$stage = Join-Path $ROOT "deploy\pearl\r\$Address\bazaar\c\$Slug"
New-Item -ItemType Directory -Force -Path $stage | Out-Null

$srcDir = Join-Path $ROOT "gno.land\r\bazaar\col"
Get-ChildItem $srcDir -File | Where-Object { $_.Name -eq "gnomod.toml" -or ($_.Extension -eq ".gno" -and $_.Name -notlike "*_test*") } | ForEach-Object {
  $raw = Get-Content $_.FullName -Raw -Encoding UTF8
  $raw = $raw.Replace("package col", "package $Slug")
  $raw = $raw.Replace('"gno.land/r/bazaar/factory"', "factory `"$factoryPath`"")
  $raw = $raw.Replace("gno.land/p/bazaar/grc721", $grc721Root)
  $raw = $raw.Replace("gno.land/p/bazaar/fee/v1", $feePath)
  $raw = $raw.Replace('module = "gno.land/r/bazaar/col"', "module = `"$colPath`"")
  $name = $_.Name
  if ($name -eq "col.gno") { $name = "$Slug.gno" }
  [IO.File]::WriteAllText((Join-Path $stage $name), $raw)
}
Set-Content -Path (Join-Path $stage "gnomod.toml") -Encoding ascii -Value @"
module = "$colPath"
gno = "0.9"
"@

$q = & gnokey query vm/qpaths --data $colPath --remote $Remote 2>&1 | Out-String
if ($q -match [regex]::Escape($colPath) -and $q -notmatch "unknown|not found|invalid") {
  Write-Host "Already on chain: $colPath"
} else {
  Invoke-Gnokey -StepName "addpkg $colPath" -Args @(
    "maketx", "addpkg", $KeyName,
    "--pkgpath", $colPath,
    "--pkgdir", $stage,
    "--gas-fee", $GasFee,
    "--gas-wanted", "$GasWanted",
    "--max-deposit", $MaxDeposit,
    "--chainid", $ChainId,
    "--remote", $Remote,
    "--broadcast"
  )
}

Write-Host "COL_PKG=$colPath"
Write-Host "Next: Adena Init on that pkg with factory LaunchFee OriginSend"
