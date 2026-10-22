# Stage + addpkg the official-GRC721 Adena probe on gnoland-1.
# Imports genesis gno.land/p/nt/grc721/{v0,metadata/v0,enumerable/v0}.
param(
  [switch]$Broadcast,
  [string]$KeyName = "deploykey",
  [string]$Address = "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt",
  [string]$Remote = "https://rpc.gno.land:443",
  [string]$ChainId = "gnoland-1",
  [string]$GasFee = "1000000ugnot",
  [int]$GasWanted = 150000000,
  [string]$MaxDeposit = "30000000ugnot"
)
$ErrorActionPreference = "Stop"
$ROOT = Split-Path $PSScriptRoot -Parent
Set-Location $ROOT

$pkgPath = "gno.land/r/$Address/bazaar/stdnft"
$srcDir = Join-Path $ROOT "gno.land\r\bazaar\stdnft"
$dstDir = Join-Path $ROOT "deploy\mainnet\r\$Address\bazaar\stdnft"
New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
Get-ChildItem $srcDir -File | Where-Object {
  $_.Name -eq "gnomod.toml" -or ($_.Extension -eq ".gno" -and $_.Name -notlike "*_test*")
} | ForEach-Object {
  $raw = Get-Content $_.FullName -Raw -Encoding UTF8
  if ($_.Name -eq "gnomod.toml") {
    $raw = "module = `"$pkgPath`"`ngno = `"0.9`"`n"
  }
  [IO.File]::WriteAllText((Join-Path $dstDir $_.Name), $raw)
}
Write-Host "Staged $pkgPath"
Write-Host " dir $dstDir"
if (-not $Broadcast) {
  Write-Host "Re-run with -Broadcast to addpkg + Init + Mint."
  exit 0
}

$common = "C:\Users\Hi\gnomemepad\scripts\gnokey-common.ps1"
. $common
Import-DotEnvDeploy -Root "C:\Users\Hi\gnomemepad"
Import-DotEnvDeploy -Root $ROOT
if ($env:GNOKEY_NAME) { $KeyName = $env:GNOKEY_NAME }
if ($env:BAZAAR_DEPLOYER) { $Address = $env:BAZAAR_DEPLOYER }
$pkgPath = "gno.land/r/$Address/bazaar/stdnft"
Assert-DeployKeyExists -KeyName $KeyName -ExpectedAddress $Address

$gnokey = Join-Path $ROOT "deploy\mainnet\bin\gnokey.exe"
if (-not (Test-Path $gnokey)) { throw "missing $gnokey" }

function Invoke-V15 {
  param([string]$Step, [string[]]$Cmd)
  Write-Host ">> $Step"
  $pass = Get-GnokeyPassword
  $argLine = ($Cmd | ForEach-Object {
    if ($_ -match '[\s"]') { '"{0}"' -f ($_ -replace '"', '\"') } else { $_ }
  }) -join " "
  Write-Host "   gnokey $argLine"
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $gnokey
  $psi.Arguments = $argLine
  $psi.UseShellExecute = $false
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()
  $p.StandardInput.Write($pass)
  if (-not $pass.EndsWith("`n")) { $p.StandardInput.Write("`n") }
  $p.StandardInput.Close()
  $stdout = $p.StandardOutput.ReadToEnd()
  $stderr = $p.StandardError.ReadToEnd()
  $p.WaitForExit()
  if ($stdout) { Write-Host $stdout }
  if ($stderr) { Write-Host $stderr }
  if ($p.ExitCode -ne 0) { throw "Failed: $Step exit $($p.ExitCode)" }
}

function Query-V15([string]$AbciPath, [string]$Data) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    return & $gnokey query -data $Data -remote $Remote $AbciPath 2>&1 | Out-String
  } catch {
    return [string]$_
  } finally {
    $ErrorActionPreference = $prev
  }
}

$q = Query-V15 "vm/qpaths" $pkgPath
if ($q -match [regex]::Escape($pkgPath) -and $q -notmatch "unknown|not found|invalid") {
  Write-Host "Already on chain: $pkgPath"
} else {
  Invoke-V15 -Step "addpkg stdnft" -Cmd @(
    "maketx", "addpkg",
    "-pkgpath", $pkgPath,
    "-pkgdir", $dstDir,
    "-gas-fee", $GasFee,
    "-gas-wanted", "$GasWanted",
    "-max-deposit", $MaxDeposit,
    "-chainid", $ChainId,
    "-remote", $Remote,
    "-broadcast",
    "-insecure-password-stdin=true",
    $KeyName
  )
}

$prev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$enabled = $false
try {
  for ($i = 0; $i -lt 80; $i++) {
    $out = Query-V15 "vm/qeval" "$pkgPath.Name()"
    if ($out -match "call Init first" -or ($out -match '\(".*" string\)' -and $out -notmatch "invalid package|not enabled|inert")) {
      Write-Host "Enabled: $pkgPath"
      $enabled = $true
      break
    }
    Write-Host "GPAO wait stdnft ($($i+1)/80)"
    Start-Sleep -Seconds 15
  }
} finally {
  $ErrorActionPreference = $prev
}
if (-not $enabled) { throw "stdnft still inert after GPAO wait" }

$nameOut = Query-V15 "vm/qeval" "$pkgPath.Name()"
if ($nameOut -match "call Init first") {
  Invoke-V15 -Step "Init stdnft" -Cmd @(
    "maketx", "call",
    "-pkgpath", $pkgPath,
    "-func", "Init",
    "-args", "StdNFT",
    "-args", "STDNFT",
    "-gas-fee", $GasFee,
    "-gas-wanted", "80000000",
    "-chainid", $ChainId,
    "-remote", $Remote,
    "-broadcast",
    "-insecure-password-stdin=true",
    $KeyName
  )
} else {
  Write-Host "Init already done"
}

$balOut = Query-V15 "vm/qeval" "$pkgPath.TotalSupply()"
if ($balOut -notmatch '\(1 int64\)') {
  Invoke-V15 -Step "Mint stdnft 1" -Cmd @(
    "maketx", "call",
    "-pkgpath", $pkgPath,
    "-func", "Mint",
    "-args", "1",
    "-args", "Std Gnomie",
    "-args", "https://bazaar-gno.vercel.app/gnomies.png",
    "-gas-fee", $GasFee,
    "-gas-wanted", "80000000",
    "-chainid", $ChainId,
    "-remote", $Remote,
    "-broadcast",
    "-insecure-password-stdin=true",
    $KeyName
  )
} else {
  Write-Host "Token 1 already minted"
}

Write-Host "STDNFT_PKG=$pkgPath"
Write-Host "Adena Manage Collectables: paste $pkgPath on gnoland-1"
