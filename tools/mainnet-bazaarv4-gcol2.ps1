# addpkg bazaarv4 + gpush + gcol2. GPAO order: factory, pusher, slim GRC721+gpush.
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
$v4Path = $m.FactoryV4Path
$v4Dir = $m.FactoryV4Dir
Copy-GnoPkg -SrcDir (Join-Path $ROOT "gno.land\r\bazaar\factory") -DstDir $v4Dir -Module $v4Path -Address $Address -FactoryPath $v4Path -ExtraRewrite {
  param($raw)
  return $raw.Replace("package factory", "package bazaarv4")
}
$gno = Join-Path $v4Dir "factory.gno"
$v4gno = Join-Path $v4Dir "bazaarv4.gno"
if (Test-Path $gno) { Move-Item -Force $gno $v4gno }

$gpushPath = $m.GpushPath
$gpushDir = $m.GpushDir
Copy-GnoPkg -SrcDir (Join-Path $ROOT "gno.land\r\bazaar\gpush") -DstDir $gpushDir -Module $gpushPath -Address $Address -FactoryPath $v4Path -ExtraRewrite {
  param($raw)
  return $raw.Replace("factory.NoteHolderDiscount", "bazaarv4.NoteHolderDiscount")
}

$gcol2Path = $m.Gcol2Path
$gcol2Dir = $m.Gcol2Dir
Copy-GnoPkg -SrcDir (Join-Path $ROOT "gno.land\r\bazaar\genesis") -DstDir $gcol2Dir -Module $gcol2Path -Address $Address -FactoryPath $v4Path -ExtraRewrite {
  param($raw)
  $raw = $raw.Replace("package genesis", "package gcol2")
  if ($raw -match 'gno.land/r/.*/bazaar/factory|gno.land/r/.*/bazaar/bazaarv') {
    throw "gcol2 must not import factory"
  }
  return $raw
}
$srcG = Join-Path $gcol2Dir "genesis.gno"
$dstG = Join-Path $gcol2Dir "gcol2.gno"
if (Test-Path $srcG) { Move-Item -Force $srcG $dstG }

Write-Host "Staged $v4Path"
Write-Host "Staged $gpushPath"
Write-Host "Staged $gcol2Path"

. "C:\Users\Hi\gnomemepad\scripts\gnokey-common.ps1"
Import-DotEnvDeploy -Root "C:\Users\Hi\gnomemepad"
Import-DotEnvDeploy -Root $ROOT
if ($env:GNOKEY_NAME) { $KeyName = $env:GNOKEY_NAME }
if ($env:BAZAAR_DEPLOYER) { $Address = $env:BAZAAR_DEPLOYER }
$v4Path = "gno.land/r/$Address/bazaar/bazaarv4"
$gpushPath = "gno.land/r/$Address/bazaar/gpush"
$gcol2Path = "gno.land/r/$Address/bazaar/gcol2"
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

function Add-Pkg([string]$Path, [string]$Dir, [string]$Step) {
  $meta = Query-V15 "vm/qpkgmeta_json" $Path
  if ($meta -match '"status":"live"' -or $meta -match '"status":"inert"') {
    Write-Host "Already submitted: $Path"
    return
  }
  Invoke-V15 -Step $Step -Cmd @(
    "maketx", "addpkg",
    "-pkgpath", $Path,
    "-pkgdir", $Dir,
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

function Wait-Live([string]$Path) {
  for ($i = 0; $i -lt 80; $i++) {
    $m2 = Query-V15 "vm/qpkgmeta_json" $Path
    if ($m2 -match '"status":"live"') {
      Write-Host "Enabled: $Path"
      return
    }
    Write-Host "GPAO wait $Path ($($i+1)/80)"
    Start-Sleep -Seconds 15
  }
  throw "still not live: $Path"
}

Add-Pkg $v4Path $v4Dir "addpkg bazaarv4"
Wait-Live $v4Path
$feeOut = Query-V15 "vm/qeval" "$v4Path.LaunchFee()"
if ($feeOut -match "call Init first") {
  Invoke-V15 -Step "Init bazaarv4" -Cmd @(
    "maketx", "call",
    "-pkgpath", $v4Path,
    "-func", "Init",
    "-gas-fee", $GasFee,
    "-gas-wanted", "80000000",
    "-chainid", $ChainId,
    "-remote", $Remote,
    "-broadcast",
    "-insecure-password-stdin=true",
    $KeyName
  )
}

Add-Pkg $gpushPath $gpushDir "addpkg gpush"
Wait-Live $gpushPath

Add-Pkg $gcol2Path $gcol2Dir "addpkg gcol2"
Wait-Live $gcol2Path
$ts = Query-V15 "vm/qeval" "$gcol2Path.TotalSupply()"
if ($ts -match "call Init first") {
  Invoke-V15 -Step "Init gcol2" -Cmd @(
    "maketx", "call",
    "-pkgpath", $gcol2Path,
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
}

Invoke-V15 -Step "SetGenesis gcol2" -Cmd @(
  "maketx", "call",
  "-pkgpath", $v4Path,
  "-func", "SetGenesis",
  "-args", $gcol2Path,
  "-gas-fee", $GasFee,
  "-gas-wanted", "80000000",
  "-chainid", $ChainId,
  "-remote", $Remote,
  "-broadcast",
  "-insecure-password-stdin=true",
  $KeyName
)
Invoke-V15 -Step "SetDiscountPusher gpush" -Cmd @(
  "maketx", "call",
  "-pkgpath", $v4Path,
  "-func", "SetDiscountPusher",
  "-args", $gpushPath,
  "-gas-fee", $GasFee,
  "-gas-wanted", "80000000",
  "-chainid", $ChainId,
  "-remote", $Remote,
  "-broadcast",
  "-insecure-password-stdin=true",
  $KeyName
)

Write-Host "FACTORY_V4=$v4Path"
Write-Host "GPUSH=$gpushPath"
Write-Host "GCOL2=$gcol2Path"
