# Stage + addpkg + Init bazaarv3 factory and genesis on gnoland-1.
# Does not overwrite bazaarv2. ProtocolSink + AttachGenesis.
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
$v3Path = $m.FactoryV3Path
$v3Dir = $m.FactoryV3Dir
Copy-GnoPkg -SrcDir (Join-Path $ROOT "gno.land\r\bazaar\factory") -DstDir $v3Dir -Module $v3Path -Address $Address -FactoryPath $v3Path -ExtraRewrite {
  param($raw)
  $raw = $raw.Replace("package factory", "package bazaarv3")
  return $raw
}
$gno = Join-Path $v3Dir "factory.gno"
$v3gno = Join-Path $v3Dir "bazaarv3.gno"
if (Test-Path $gno) { Move-Item -Force $gno $v3gno }

$genPath = $m.GenesisPath
$genDir = $m.GenesisDir
Copy-GnoPkg -SrcDir (Join-Path $ROOT "gno.land\r\bazaar\genesis") -DstDir $genDir -Module $genPath -Address $Address -FactoryPath $v3Path
Write-Host "Staged $v3Path"
Write-Host "Staged $genPath"

. "C:\Users\Hi\gnomemepad\scripts\gnokey-common.ps1"
Import-DotEnvDeploy -Root "C:\Users\Hi\gnomemepad"
Import-DotEnvDeploy -Root $ROOT
if ($env:GNOKEY_NAME) { $KeyName = $env:GNOKEY_NAME }
if ($env:BAZAAR_DEPLOYER) { $Address = $env:BAZAAR_DEPLOYER }
Assert-DeployKeyExists -KeyName $KeyName -ExpectedAddress $Address
$v3Path = "gno.land/r/$Address/bazaar/bazaarv3"
$genPath = "gno.land/r/$Address/bazaar/genesis"

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

function Wait-Enabled([string]$PkgPath, [string]$Expr) {
  for ($i = 0; $i -lt 80; $i++) {
    $out = Query-V15 "vm/qeval" "$PkgPath.$Expr"
    if ($out -match "call Init first" -or ($out -match '\(' -and $out -notmatch "invalid package|not enabled|inert|unknown")) {
      Write-Host "Enabled: $PkgPath"
      return
    }
    Write-Host "GPAO wait $PkgPath ($($i+1)/80)"
    Start-Sleep -Seconds 15
  }
  throw "still inert: $PkgPath"
}

function Add-IfMissing([string]$PkgPath, [string]$PkgDir, [string]$Step) {
  $q = Query-V15 "vm/qpaths" $PkgPath
  if ($q -match [regex]::Escape($PkgPath) -and $q -notmatch "unknown|not found|invalid") {
    Write-Host "Already on chain: $PkgPath"
    return
  }
  Invoke-V15 -Step $Step -Cmd @(
    "maketx", "addpkg",
    "-pkgpath", $PkgPath,
    "-pkgdir", $PkgDir,
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

Add-IfMissing $v3Path $v3Dir "addpkg bazaarv3"
Wait-Enabled $v3Path "LaunchFee()"
$feeOut = Query-V15 "vm/qeval" "$v3Path.LaunchFee()"
if ($feeOut -match "call Init first") {
  Invoke-V15 -Step "Init bazaarv3" -Cmd @(
    "maketx", "call",
    "-pkgpath", $v3Path,
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
  Write-Host "bazaarv3 Init already done"
}

Add-IfMissing $genPath $genDir "addpkg genesis"
Wait-Enabled $genPath "MaxSupply()"
$genOut = Query-V15 "vm/qeval" "$genPath.MaxSupply()"
# MaxSupply works pre-Init. Detect Init via Creator/Admin-like: TotalSupply panics requireInit
$ts = Query-V15 "vm/qeval" "$genPath.TotalSupply()"
if ($ts -match "call Init first" -or $ts -match "not initialized" -or $ts -match "requireInit" -or $ts -match "genesis:") {
  Invoke-V15 -Step "Init genesis" -Cmd @(
    "maketx", "call",
    "-pkgpath", $genPath,
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
  Write-Host "genesis Init already done or TotalSupply readable"
}

Write-Host "FACTORY_V3=$v3Path"
Write-Host "GENESIS=$genPath"
Write-Host "bazaarv2 untouched"
