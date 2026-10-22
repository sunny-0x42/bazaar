# Stage + addpkg + Init bazaarv1 factory on gnoland-1 (2% protocol bps, 10 GNOT launch).
param(
  [string]$KeyName = "deploykey",
  [string]$Address = "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt",
  [string]$Remote = "https://rpc.gno.land:443",
  [string]$ChainId = "gnoland-1",
  [string]$GasFee = "1000000ugnot",
  [int]$GasWanted = 250000000,
  [string]$MaxDeposit = "40000000ugnot"
)
$ErrorActionPreference = "Stop"
$ROOT = Split-Path $PSScriptRoot -Parent
Set-Location $ROOT
. (Join-Path $PSScriptRoot "mainnet-bazaar.ps1")

$m = Get-BazaarMainnetRoots -Root $ROOT -Address $Address
$pkgPath = $m.FactoryV1Path
$dst = $m.FactoryV1Dir
Copy-GnoPkg -SrcDir (Join-Path $ROOT "gno.land\r\bazaar\factory") -DstDir $dst -Module $pkgPath -Address $Address -FactoryPath $pkgPath -ExtraRewrite {
  param($raw)
  $raw = $raw.Replace("package factory", "package bazaarv1")
  $raw = $raw.Replace("defaultLaunchFee = int64(1_000_000_000) // 1000 GNOT", "defaultLaunchFee = int64(10_000_000) // 10 GNOT")
  $raw = $raw.Replace("defaultLaunchFee = int64(1_000_000_000)", "defaultLaunchFee = int64(10_000_000)")
  return $raw
}
$gno = Join-Path $dst "factory.gno"
$v1 = Join-Path $dst "bazaarv1.gno"
if (Test-Path $gno) { Move-Item -Force $gno $v1 }
Write-Host "Staged $pkgPath"
Write-Host " dir $dst"

. "C:\Users\Hi\gnomemepad\scripts\gnokey-common.ps1"
Import-DotEnvDeploy -Root "C:\Users\Hi\gnomemepad"
Import-DotEnvDeploy -Root $ROOT
if ($env:GNOKEY_NAME) { $KeyName = $env:GNOKEY_NAME }
if ($env:BAZAAR_DEPLOYER) { $Address = $env:BAZAAR_DEPLOYER }
Assert-DeployKeyExists -KeyName $KeyName -ExpectedAddress $Address
$pkgPath = "gno.land/r/$Address/bazaar/bazaarv1"

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
  Invoke-V15 -Step "addpkg bazaarv1" -Cmd @(
    "maketx", "addpkg",
    "-pkgpath", $pkgPath,
    "-pkgdir", $dst,
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

$enabled = $false
for ($i = 0; $i -lt 80; $i++) {
  $out = Query-V15 "vm/qeval" "$pkgPath.LaunchFee()"
  if ($out -match "call Init first" -or ($out -match '\(\d+ int64\)' -and $out -notmatch "invalid package|not enabled|inert")) {
    Write-Host "Enabled: $pkgPath"
    $enabled = $true
    break
  }
  Write-Host "GPAO wait bazaarv1 ($($i+1)/80)"
  Start-Sleep -Seconds 15
}
if (-not $enabled) { throw "bazaarv1 still inert after GPAO wait" }

$feeOut = Query-V15 "vm/qeval" "$pkgPath.LaunchFee()"
if ($feeOut -match "call Init first") {
  Invoke-V15 -Step "Init bazaarv1" -Cmd @(
    "maketx", "call",
    "-pkgpath", $pkgPath,
    "-func", "Init",
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

Write-Host "FACTORY_V1=$pkgPath"
Write-Host "LaunchFee should be 10 GNOT; ProtocolBps 200"
