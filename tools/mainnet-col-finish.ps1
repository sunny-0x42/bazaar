# Finish stdcol after addpkg: Init with LaunchFee send, drop, PublicMint.
param(
  [string]$Slug = "stdcol",
  [string]$Name = "StdCol",
  [string]$Symbol = "STDCOL",
  [string]$Cover = "https://bazaar-gno.vercel.app/gnomies.png",
  [string]$KeyName = "deploykey",
  [string]$Address = "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt",
  [string]$Remote = "https://rpc.gno.land:443",
  [string]$ChainId = "gnoland-1",
  [string]$GasFee = "1000000ugnot"
)
$ErrorActionPreference = "Stop"
$ROOT = Split-Path $PSScriptRoot -Parent
Set-Location $ROOT
. "C:\Users\Hi\gnomemepad\scripts\gnokey-common.ps1"
Import-DotEnvDeploy -Root "C:\Users\Hi\gnomemepad"
Import-DotEnvDeploy -Root $ROOT
if ($env:GNOKEY_NAME) { $KeyName = $env:GNOKEY_NAME }
if ($env:BAZAAR_DEPLOYER) { $Address = $env:BAZAAR_DEPLOYER }
Assert-DeployKeyExists -KeyName $KeyName -ExpectedAddress $Address
$pkgPath = "gno.land/r/$Address/bazaar/c/$Slug"
$gnokey = Join-Path $ROOT "deploy\mainnet\bin\gnokey.exe"

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

$nameOut = Query-V15 "vm/qeval" "$pkgPath.Name()"
if ($nameOut -match "call Init first") {
  Invoke-V15 -Step "Init $Slug + LaunchFee" -Cmd @(
    "maketx", "call",
    "-pkgpath", $pkgPath,
    "-func", "Init",
    "-args", $Name,
    "-args", $Symbol,
    "-args", $Cover,
    "-args", "1",
    "-args", "0",
    "-args", "500",
    "-send", "10000000ugnot",
    "-gas-fee", $GasFee,
    "-gas-wanted", "80000000",
    "-chainid", $ChainId,
    "-remote", $Remote,
    "-broadcast",
    "-insecure-password-stdin=true",
    $KeyName
  )
} else {
  Write-Host "Init already done: $nameOut"
}

$supply = Query-V15 "vm/qeval" "$pkgPath.TotalSupply()"
if ($supply -notmatch '\(1 int64\)') {
  $drop = "Std Gnomie|$Cover|Legendary|Kind:Adena;Surface:GRC721"
  Invoke-V15 -Step "AddDropItems" -Cmd @(
    "maketx", "call",
    "-pkgpath", $pkgPath,
    "-func", "AddDropItems",
    "-args", $drop,
    "-gas-fee", $GasFee,
    "-gas-wanted", "80000000",
    "-chainid", $ChainId,
    "-remote", $Remote,
    "-broadcast",
    "-insecure-password-stdin=true",
    $KeyName
  )
  Invoke-V15 -Step "PublicMint" -Cmd @(
    "maketx", "call",
    "-pkgpath", $pkgPath,
    "-func", "PublicMint",
    "-gas-fee", $GasFee,
    "-gas-wanted", "80000000",
    "-chainid", $ChainId,
    "-remote", $Remote,
    "-broadcast",
    "-insecure-password-stdin=true",
    $KeyName
  )
} else {
  Write-Host "Already minted"
}

Write-Host "COL_PKG=$pkgPath"
Write-Host "Adena: paste $pkgPath on gnoland-1 (token 1 unlisted)"
