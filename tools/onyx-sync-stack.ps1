# addpkg the live mainnet stack onto onyx-1 only: bazaarv5, gpushv2, perk.
# Refuses gnoland-1. Does not SetGenesis on mainnet. Does not print the key password.
param(
  [string]$KeyName = "deploykey",
  [string]$Address = "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt",
  [string]$Remote = "https://rpc.onyx.testnets.gno.land:443",
  [string]$ChainId = "onyx-1",
  [switch]$OnlyFee
)
$ErrorActionPreference = "Stop"
if ($ChainId -ne "onyx-1") { throw "refusing chain $ChainId" }
if ($Remote -notmatch '^https://rpc\.onyx\.testnets\.gno\.land') { throw "refusing remote $Remote" }
if ($Address -ne "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt") { throw "refusing address" }

$ROOT = Split-Path $PSScriptRoot -Parent
Set-Location $ROOT
$gnokey = Join-Path $ROOT "deploy\mainnet\bin\gnokey.exe"
if (-not (Test-Path $gnokey)) { throw "missing $gnokey" }

$srcRoot = Join-Path $ROOT "deploy\mainnet\r\$Address\bazaar"
$stageRoot = Join-Path $ROOT "deploy\mainnet\onyx-stack\r\$Address\bazaar"
$v5Path = "gno.land/r/$Address/bazaar/bazaarv5"
$pushPath = "gno.land/r/$Address/bazaar/gpushv2"
$perkPath = "gno.land/r/$Address/bazaar/perk"
$colPath = "gno.land/r/$Address/bazaar/c/bazaargens"

function Copy-LivePkg([string]$Name, [string]$GnoName) {
  $src = Join-Path $srcRoot $Name
  $dst = Join-Path $stageRoot $Name
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  Copy-Item -Force (Join-Path $src $GnoName) (Join-Path $dst $GnoName)
  $mod = "module = `"gno.land/r/$Address/bazaar/$Name`"`r`ngno = `"0.9`"`r`n"
  [IO.File]::WriteAllText((Join-Path $dst "gnomod.toml"), $mod)
}

Copy-LivePkg "bazaarv5" "bazaarv5.gno"
Copy-LivePkg "gpushv2" "gpushv2.gno"
Copy-LivePkg "perk" "perk.gno"

$v5 = Get-Content (Join-Path $stageRoot "bazaarv5\bazaarv5.gno") -Raw -Encoding UTF8
if ($v5 -notmatch 'package bazaarv5') { throw "staged factory package name" }
if ($v5 -notmatch 'defaultLaunchFee = int64\(1_000_000_000\)') { throw "staged LaunchFee is not 1000 GNOT" }
if ($v5 -match '10_000_000') { throw "staged factory was rewritten to 10 GNOT" }
$push = Get-Content (Join-Path $stageRoot "gpushv2\gpushv2.gno") -Raw -Encoding UTF8
if ($push -notmatch 'package gpushv2') { throw "staged pusher package name" }
if ($push -notmatch [regex]::Escape("factory `"$v5Path`"")) { throw "pusher must import bazaarv5 as factory" }
if ($push -notmatch 'factory\.NoteHolderDiscount') { throw "pusher call" }
$perk = Get-Content (Join-Path $stageRoot "perk\perk.gno") -Raw -Encoding UTF8
if ($perk -notmatch 'package perk') { throw "staged perk package name" }
if ($perk -notmatch [regex]::Escape("col `"$colPath`"")) { throw "perk must count c/bazaargens" }
if ($perk -notmatch [regex]::Escape("factory `"$v5Path`"")) { throw "perk must import bazaarv5 as factory" }
if ($perk -notmatch [regex]::Escape("pkgPath   = `"$perkPath`"")) { throw "perk pkgPath" }
if ($perk -match 'gno\.land/r/bazaar/') { throw "perk still has an unstaged bazaar import" }

function Read-DeployPass {
  $path = "C:\Users\Hi\gnomemepad\.env.deploy"
  if (-not (Test-Path $path)) { throw "missing deploy env" }
  foreach ($line in [IO.File]::ReadAllLines($path)) {
    $trim = $line.Trim()
    if ($trim -match '^GNOKEY_PASS\s*=\s*(.*)$') {
      $v = $Matches[1].Trim().TrimEnd("`r")
      if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
        $v = $v.Substring(1, $v.Length - 2)
      }
      if (-not $v) { throw "empty deploy password" }
      return $v
    }
  }
  throw "GNOKEY_PASS missing"
}

function Invoke-Onyx([string]$Step, [string[]]$Cmd) {
  Write-Host ">> $Step"
  $pass = Read-DeployPass
  $argLine = ($Cmd | ForEach-Object {
    if ($_ -match '[\s"]') { '"{0}"' -f ($_ -replace '"', '\"') } else { $_ }
  }) -join " "
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
  $p.StandardInput.Write($pass.TrimEnd("`r", "`n"))
  $p.StandardInput.Write("`n")
  $p.StandardInput.Close()
  $stdout = $p.StandardOutput.ReadToEnd()
  $stderr = $p.StandardError.ReadToEnd()
  $p.WaitForExit()
  if ($stdout) { Write-Host $stdout }
  if ($stderr) { Write-Host $stderr }
  if ($p.ExitCode -ne 0) { throw "Failed: $Step exit $($p.ExitCode)" }
}

function Query-Onyx([string]$AbciPath, [string]$Data) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    return (& $gnokey query $AbciPath -data $Data -remote $Remote 2>&1 | Out-String)
  } finally {
    $ErrorActionPreference = $prev
  }
}

function Add-Pkg([string]$Path, [string]$Dir, [string]$Deposit, [string]$Step) {
  $meta = Query-Onyx "vm/qpkgmeta_json" $Path
  if ($meta -match '"status":"live"' -or $meta -match '"status":"inert"') {
    Write-Host "Already submitted: $Path"
    return
  }
  Invoke-Onyx $Step @(
    "maketx", "addpkg",
    "-pkgpath", $Path,
    "-pkgdir", $Dir,
    "-gas-fee", "1000000ugnot",
    "-gas-wanted", "250000000",
    "-max-deposit", $Deposit,
    "-chainid", $ChainId,
    "-remote", $Remote,
    "-broadcast",
    "-insecure-password-stdin=true",
    $KeyName
  )
}

function Wait-Live([string]$Path) {
  for ($i = 0; $i -lt 90; $i++) {
    $meta = Query-Onyx "vm/qpkgmeta_json" $Path
    if ($meta -match '"status":"live"') {
      Write-Host "Enabled: $Path"
      return
    }
    $status = "unknown"
    if ($meta -match '"status":"([^"]+)"') { $status = $Matches[1] }
    Write-Host "GPAO wait $Path $status $($i + 1)/90"
    Start-Sleep -Seconds 8
  }
  throw "still not live: $Path"
}

function Invoke-Call([string]$Step, [string]$Path, [string]$Func, [string[]]$CallArgs) {
  $cmd = @(
    "maketx", "call",
    "-pkgpath", $Path,
    "-func", $Func
  )
  foreach ($a in $CallArgs) {
    $cmd += @("-args", $a)
  }
  $cmd += @(
    "-gas-fee", "1000000ugnot",
    "-gas-wanted", "80000000",
    "-chainid", $ChainId,
    "-remote", $Remote,
    "-broadcast",
    "-insecure-password-stdin=true",
    $KeyName
  )
  Invoke-Onyx $Step $cmd
}

Add-Pkg $v5Path (Join-Path $stageRoot "bazaarv5") "50000000ugnot" "addpkg bazaarv5"
Wait-Live $v5Path
$fee = Query-Onyx "vm/qeval" "$v5Path.LaunchFee()"
if ($fee -match "call Init first") {
  Invoke-Call "Init bazaarv5" $v5Path "Init" @()
  Start-Sleep -Seconds 6
  $fee = Query-Onyx "vm/qeval" "$v5Path.LaunchFee()"
}
if ($fee -notmatch "10000000" -or $fee -match "1000000000") {
  Invoke-Call "SetLaunchFee 10 GNOT" $v5Path "SetLaunchFee" @("10000000")
  Start-Sleep -Seconds 6
  $fee = Query-Onyx "vm/qeval" "$v5Path.LaunchFee()"
}
if ($fee -match "1000000000") { throw "LaunchFee still 1000 GNOT: $fee" }
if ($fee -notmatch "10000000") { throw "LaunchFee is not 10 GNOT: $fee" }
Write-Host "LaunchFee 10 GNOT"
if ($OnlyFee) {
  Write-Host "ONYX_FEE_OK"
  exit 0
}

Add-Pkg $pushPath (Join-Path $stageRoot "gpushv2") "50000000ugnot" "addpkg gpushv2"
Wait-Live $pushPath

Add-Pkg $perkPath (Join-Path $stageRoot "perk") "20000000ugnot" "addpkg perk"
Wait-Live $perkPath

$pusher = Query-Onyx "vm/qeval" "$v5Path.DiscountPusher()"
if ($pusher -match '""') {
  Invoke-Call "SetDiscountPusher" $v5Path "SetDiscountPusher" @($pushPath)
  Start-Sleep -Seconds 6
  $pusher = Query-Onyx "vm/qeval" "$v5Path.DiscountPusher()"
}
if ($pusher -notmatch [regex]::Escape($pushPath)) { throw "DiscountPusher: $pusher" }

$genesis = Query-Onyx "vm/qeval" "$v5Path.GenesisPkg()"
if ($genesis -match '""') {
  Invoke-Call "SetGenesis perk" $v5Path "SetGenesis" @($perkPath)
  Start-Sleep -Seconds 6
  $genesis = Query-Onyx "vm/qeval" "$v5Path.GenesisPkg()"
}
if ($genesis -notmatch [regex]::Escape($perkPath)) { throw "GenesisPkg: $genesis" }

$share = Query-Onyx "vm/qeval" "$v5Path.GenesisShareBps()"
$bps = Query-Onyx "vm/qeval" "$v5Path.ProtocolBps()"
$sink = Query-Onyx "vm/qeval" "$v5Path.GenesisSink()"
Write-Host "ONYX_FACTORY=$v5Path"
Write-Host "DiscountPusher=$pusher"
Write-Host "GenesisPkg=$genesis"
Write-Host "GenesisShareBps=$share"
Write-Host "ProtocolBps=$bps"
Write-Host "GenesisSink=$sink"
if ($share -notmatch "1100") { throw "GenesisShareBps is not 1100" }
if ($bps -notmatch "200") { throw "ProtocolBps is not 200" }
Write-Host "ONYX_STACK_OK"
