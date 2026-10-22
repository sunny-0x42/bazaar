# addpkg Genesis collection as …/bazaar/gnft. Does not touch inert …/bazaar/genesis.
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
$pkgPath = "gno.land/r/$Address/bazaar/gnft"
$dst = Join-Path $m.StageRoot "r\$Address\bazaar\gnft"
Copy-GnoPkg -SrcDir (Join-Path $ROOT "gno.land\r\bazaar\genesis") -DstDir $dst -Module $pkgPath -Address $Address -FactoryPath $m.FactoryV3Path -ExtraRewrite {
  param($raw)
  return $raw.Replace("package genesis", "package gnft")
}
$srcGno = Join-Path $dst "genesis.gno"
$dstGno = Join-Path $dst "gnft.gno"
if (Test-Path $srcGno) { Move-Item -Force $srcGno $dstGno }
Write-Host "Staged $pkgPath"
Write-Host " dir $dst"

. "C:\Users\Hi\gnomemepad\scripts\gnokey-common.ps1"
Import-DotEnvDeploy -Root "C:\Users\Hi\gnomemepad"
Import-DotEnvDeploy -Root $ROOT
if ($env:GNOKEY_NAME) { $KeyName = $env:GNOKEY_NAME }
if ($env:BAZAAR_DEPLOYER) { $Address = $env:BAZAAR_DEPLOYER }
$pkgPath = "gno.land/r/$Address/bazaar/gnft"
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

$meta = Query-V15 "vm/qpkgmeta_json" $pkgPath
if ($meta -match '"status":"live"') {
  Write-Host "Already live: $pkgPath"
} elseif ($meta -match '"status":"inert"') {
  Write-Host "Already parked inert: $pkgPath"
} else {
  Invoke-V15 -Step "addpkg gnft" -Cmd @(
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

$live = $false
for ($i = 0; $i -lt 80; $i++) {
  $m2 = Query-V15 "vm/qpkgmeta_json" $pkgPath
  if ($m2 -match '"status":"live"') {
    Write-Host "Enabled: $pkgPath"
    $live = $true
    break
  }
  Write-Host "GPAO wait gnft ($($i+1)/80) $m2"
  Start-Sleep -Seconds 15
}
if (-not $live) { throw "gnft still not live after GPAO wait" }

$ts = Query-V15 "vm/qeval" "$pkgPath.TotalSupply()"
if ($ts -match "call Init first") {
  Invoke-V15 -Step "Init gnft" -Cmd @(
    "maketx", "call",
    "-pkgpath", $pkgPath,
    "-func", "Init",
    "-args", "Genesis",
    "-args", "GENESIS",
    "-gas-fee", $GasFee,
    "-gas-wanted", "80000000",
    "-chainid", $ChainId,
    "-remote", $Remote,
    "-broadcast",
    "-insecure-password-stdin=true",
    $KeyName
  )
} else {
  Write-Host "Init already done or TotalSupply readable"
}

Write-Host "GNFT=$pkgPath"
Write-Host "inert genesis path left untouched"
