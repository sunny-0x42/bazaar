# List adcol #1 at 1 GNOT then Cancel. gnokey v1.5.
param(
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
$pkgPath = "gno.land/r/$Address/bazaar/c/adcol"
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

function Show-State([string]$Label) {
  Write-Host "=== $Label ==="
  Write-Host (Query-V15 "vm/qeval" "$pkgPath.Listed(1)")
  Write-Host (Query-V15 "vm/qeval" "$pkgPath.OwnerOf(`"1`")")
  Write-Host (Query-V15 "vm/qeval" "$pkgPath.BalanceOf(`"$Address`")")
  Write-Host (Query-V15 "vm/qeval" "$pkgPath.TokensOf(`"$Address`")")
}

Show-State "before List"
$listed = Query-V15 "vm/qeval" "$pkgPath.Listed(1)"
if ($listed -notmatch '\(true bool\)') {
  Invoke-V15 -Step "List adcol 1" -Cmd @(
    "maketx", "call",
    "-pkgpath", $pkgPath,
    "-func", "List",
    "-args", "1",
    "-args", "1000000",
    "-gas-fee", $GasFee,
    "-gas-wanted", "80000000",
    "-chainid", $ChainId,
    "-remote", $Remote,
    "-broadcast",
    "-insecure-password-stdin=true",
    $KeyName
  )
}
Show-State "after List"
Invoke-V15 -Step "Cancel adcol 1" -Cmd @(
  "maketx", "call",
  "-pkgpath", $pkgPath,
  "-func", "Cancel",
  "-args", "1",
  "-gas-fee", $GasFee,
  "-gas-wanted", "80000000",
  "-chainid", $ChainId,
  "-remote", $Remote,
  "-broadcast",
  "-insecure-password-stdin=true",
  $KeyName
)
Show-State "after Cancel"
