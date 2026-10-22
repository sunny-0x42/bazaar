# Slim Genesis GRC721 as …/bazaar/gcol (no factory import, for GPAO). Then SetGenesis on bazaarv3.
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
$pkgPath = "gno.land/r/$Address/bazaar/gcol"
$dst = Join-Path $m.StageRoot "r\$Address\bazaar\gcol"
$v3Path = $m.FactoryV3Path
Copy-GnoPkg -SrcDir (Join-Path $ROOT "gno.land\r\bazaar\genesis") -DstDir $dst -Module $pkgPath -Address $Address -FactoryPath $v3Path -ExtraRewrite {
  param($raw)
  $raw = $raw.Replace("package genesis", "package gcol")
  $raw = $raw.Replace("gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/bazaarv3", "REMOVED_FACTORY")
  $raw = $raw -replace '(?m)^\t"REMOVED_FACTORY"\r?\n', ""
  $raw = $raw.Replace("factory.AttachGenesis(cross(cur))", "")
  $raw = $raw.Replace("syncFactory(cur, caller.String())", "")
  $raw = $raw.Replace("syncFactory(cur, from, to)", "")
  $idx = $raw.IndexOf("`nfunc Attach(cur realm)")
  if ($idx -ge 0) {
    $idx2 = $raw.IndexOf("`nfunc canonRarity", $idx)
    if ($idx2 -gt $idx) { $raw = $raw.Substring(0, $idx) + $raw.Substring($idx2) }
  }
  if ($raw -match 'bazaarv3|"gno.land/r/bazaar/factory"|factory\.Attach|factory\.Note|syncFactory|REMOVED_FACTORY') {
    throw "slim gcol still references factory"
  }
  return $raw
}
$srcGno = Join-Path $dst "genesis.gno"
$dstGno = Join-Path $dst "gcol.gno"
if (Test-Path $srcGno) { Move-Item -Force $srcGno $dstGno }
Write-Host "Staged $pkgPath"
Get-Content $dstGno -TotalCount 16

. "C:\Users\Hi\gnomemepad\scripts\gnokey-common.ps1"
Import-DotEnvDeploy -Root "C:\Users\Hi\gnomemepad"
Import-DotEnvDeploy -Root $ROOT
if ($env:GNOKEY_NAME) { $KeyName = $env:GNOKEY_NAME }
if ($env:BAZAAR_DEPLOYER) { $Address = $env:BAZAAR_DEPLOYER }
$pkgPath = "gno.land/r/$Address/bazaar/gcol"
$v3Path = "gno.land/r/$Address/bazaar/bazaarv3"
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
  Write-Host "Already parked: $pkgPath"
} else {
  Invoke-V15 -Step "addpkg gcol" -Cmd @(
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
  Write-Host "GPAO wait gcol ($($i+1)/80)"
  Start-Sleep -Seconds 15
}
if (-not $live) { throw "gcol still not live after GPAO wait" }

$ts = Query-V15 "vm/qeval" "$pkgPath.TotalSupply()"
if ($ts -match "call Init first") {
  Invoke-V15 -Step "Init gcol" -Cmd @(
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
  Write-Host "gcol Init already done"
}

$gp = Query-V15 "vm/qeval" "$v3Path.GenesisPkg()"
if ($gp -notmatch "bazaar/gcol") {
  Invoke-V15 -Step "SetGenesis gcol" -Cmd @(
    "maketx", "call",
    "-pkgpath", $v3Path,
    "-func", "SetGenesis",
    "-args", $pkgPath,
    "-gas-fee", $GasFee,
    "-gas-wanted", "80000000",
    "-chainid", $ChainId,
    "-remote", $Remote,
    "-broadcast",
    "-insecure-password-stdin=true",
    $KeyName
  )
} else {
  Write-Host "GenesisPkg already gcol"
}

Write-Host "GCOL=$pkgPath"
Write-Host "FACTORY_V3=$v3Path"
