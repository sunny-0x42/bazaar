# Trial edition stack on onyx-1 only: grc1155, efactory, edcol.
# Does not call bazaarv5, perk, perk2, or bazaargens. Does not print the key password.
param(
  [string]$KeyName = "deploykey",
  [string]$Address = "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt",
  [string]$Remote = "https://rpc.onyx.testnets.gno.land:443",
  [string]$ChainId = "onyx-1"
)
$ErrorActionPreference = "Stop"
if ($ChainId -ne "onyx-1") { throw "refusing chain $ChainId" }
if ($Remote -notmatch '^https://rpc\.onyx\.testnets\.gno\.land') { throw "refusing remote $Remote" }
if ($Address -ne "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt") { throw "refusing address" }

$ROOT = Split-Path $PSScriptRoot -Parent
Set-Location $ROOT
$gnokey = Join-Path $ROOT "deploy\mainnet\bin\gnokey.exe"
if (-not (Test-Path $gnokey)) { throw "missing gnokey" }

$utf8 = New-Object System.Text.UTF8Encoding $false
$stage = Join-Path $ROOT "deploy\mainnet\onyx-editions"
$grcPath = "gno.land/p/$Address/bazaar/grc1155/v0"
$feePath = "gno.land/p/$Address/bazaar/fee/v1"
$factoryPath = "gno.land/r/$Address/bazaar/efactory"
$edcolPath = "gno.land/r/$Address/bazaar/edcol"
$v5Path = "gno.land/r/$Address/bazaar/bazaarv5"
$cover = "https://nomaq.xyz/bazaar-mark.svg"

function Write-Pkg([string]$SrcDir, [string]$DstDir, [string]$Module, [scriptblock]$Rewrite) {
  if (Test-Path $DstDir) { Remove-Item -Recurse -Force $DstDir }
  New-Item -ItemType Directory -Force -Path $DstDir | Out-Null
  Get-ChildItem $SrcDir -File | Where-Object {
    $_.Extension -eq ".gno" -and $_.Name -notlike "*_test*"
  } | ForEach-Object {
    $raw = [IO.File]::ReadAllText($_.FullName)
    if ($Rewrite) { $raw = & $Rewrite $raw }
    [IO.File]::WriteAllText((Join-Path $DstDir $_.Name), $raw, $utf8)
  }
  $mod = "module = `"$Module`"`ngno = `"0.9`"`n"
  [IO.File]::WriteAllText((Join-Path $DstDir "gnomod.toml"), $mod, $utf8)
}

$grcDir = Join-Path $stage "p\$Address\bazaar\grc1155\v0"
$factoryDir = Join-Path $stage "r\$Address\bazaar\efactory"
$edcolDir = Join-Path $stage "r\$Address\bazaar\edcol"
Write-Pkg (Join-Path $ROOT "gno.land\p\bazaar\grc1155\v0") $grcDir $grcPath $null
Write-Pkg (Join-Path $ROOT "gno.land\r\bazaar\efactory") $factoryDir $factoryPath $null
Write-Pkg (Join-Path $ROOT "gno.land\r\bazaar\edcol") $edcolDir $edcolPath {
  param($raw)
  $raw = $raw.Replace("gno.land/p/bazaar/fee/v1", $feePath)
  $raw = $raw.Replace("gno.land/p/bazaar/grc1155/v0", $grcPath)
  $raw = $raw.Replace("gno.land/r/bazaar/efactory", $factoryPath)
  return $raw
}

$staged = [IO.File]::ReadAllText((Join-Path $edcolDir "edcol.gno"))
if ($staged -notmatch 'package edcol') { throw "staged package name" }
if ($staged -match 'gno\.land/[pr]/bazaar/') { throw "staged edcol still has a local bazaar import" }
if ($staged -notmatch [regex]::Escape($feePath)) { throw "staged fee import" }
if ($staged -notmatch [regex]::Escape($grcPath)) { throw "staged grc1155 import" }
if ($staged -notmatch [regex]::Escape($factoryPath)) { throw "staged efactory import" }
if ($staged -notmatch 'grc1155\.New') { throw "staged ledger call" }
if ($staged -notmatch 'efactory\.Register') { throw "staged register call" }
$tests = @(Get-ChildItem $stage -Recurse -Filter "*_test.gno" -ErrorAction SilentlyContinue)
if ($tests.Count -gt 0) { throw "staged tests" }
$facSrc = [IO.File]::ReadAllText((Join-Path $factoryDir "efactory.gno"))
if ($facSrc -notmatch 'package efactory') { throw "staged factory package" }
if ($facSrc -match '"gno\.land/r/[^"]*/bazaarv5"' -or $facSrc -match '"gno\.land/r/[^"]*/perk') {
  throw "staged factory imports the live book"
}

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

function Hide-Pass([string]$Text, [string]$Pass) {
  if (-not $Text -or -not $Pass) { return $Text }
  return $Text.Replace($Pass, "***")
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
  $stdout = Hide-Pass ($p.StandardOutput.ReadToEnd()) $pass
  $stderr = Hide-Pass ($p.StandardError.ReadToEnd()) $pass
  $p.WaitForExit()
  if ($stdout) { Write-Host $stdout }
  if ($stderr) { Write-Host $stderr }
  if ($p.ExitCode -ne 0) { throw "Failed: $Step exit $($p.ExitCode) $stdout $stderr" }
  return "$stdout`n$stderr"
}

function Invoke-Abci([string]$Path, [string]$Data) {
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Data))
  $body = '{"jsonrpc":"2.0","id":"1","method":"abci_query","params":{"path":"' + $Path + '","data":"' + $b64 + '","prove":false}}'
  $resp = Invoke-RestMethod -Method Post -Uri $Remote -ContentType "application/json" -Body $body -TimeoutSec 40
  $base = $resp.result.response.ResponseBase
  if (-not $base) { throw "empty abci response" }
  $errText = ""
  if ($base.Error) {
    if ($base.Error.Value) { $errText = [string]$base.Error.Value }
    else { $errText = [string]($base.Error | ConvertTo-Json -Compress) }
  }
  $text = ""
  if ($base.Data) {
    $text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([string]$base.Data))
  }
  return [pscustomobject]@{ Error = $errText; Log = [string]$base.Log; Text = $text }
}

function Eval([string]$Expr) {
  $q = Invoke-Abci "vm/qeval" $Expr
  if ($q.Error) { return [pscustomobject]@{ Ok = $false; Text = ($q.Error + " " + $q.Log).Trim() } }
  return [pscustomobject]@{ Ok = $true; Text = $q.Text }
}

function Unwrap-Gno([string]$Text) {
  $t = $Text.Trim()
  if ($t -match '^\("([\s\S]*)"\s*\w*\s*\)$') {
    return $Matches[1].Replace('\n', "`n").Replace('\"', '"')
  }
  return $t
}

function Pkg-Status([string]$Path) {
  $q = Invoke-Abci "vm/qpkgmeta_json" $Path
  if ($q.Text -match '"status":"([^"]+)"') { return $Matches[1] }
  return "absent"
}

function Add-Pkg([string]$Path, [string]$Dir, [string]$Deposit, [string]$Step) {
  if ($Path -ne $grcPath -and $Path -ne $factoryPath -and $Path -ne $edcolPath) { throw "refusing addpkg $Path" }
  $status = Pkg-Status $Path
  if ($status -eq "live" -or $status -eq "inert") {
    Write-Host "Already submitted: $Path ($status)"
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
  ) | Out-Null
}

function Wait-Live([string]$Path) {
  for ($i = 0; $i -lt 90; $i++) {
    $status = Pkg-Status $Path
    if ($status -eq "live") {
      Write-Host "Enabled: $Path"
      return
    }
    if ($status -match 'error|reject|fail') { throw "GPAO $Path $status" }
    Write-Host "GPAO wait $Path $status $($i + 1)/90"
    Start-Sleep -Seconds 8
  }
  throw "still not live: $Path"
}

function Invoke-Call([string]$Step, [string]$Path, [string]$Func, [string[]]$CallArgs) {
  if ($Path -ne $factoryPath -and $Path -ne $edcolPath) { throw "refusing call $Path" }
  if ($Func -match 'Settle|Sync|Claim|Record|SetGenesis|SetDiscount|Withdraw') { throw "refusing $Func" }
  if ($Func -eq "SetLaunchFee" -and $Path -ne $factoryPath) { throw "refusing fee on $Path" }
  $cmd = @("maketx", "call", "-pkgpath", $Path, "-func", $Func)
  foreach ($a in $CallArgs) { $cmd += @("-args", $a) }
  $cmd += @(
    "-gas-fee", "1000000ugnot",
    "-gas-wanted", "80000000",
    "-chainid", $ChainId,
    "-remote", $Remote,
    "-broadcast",
    "-insecure-password-stdin=true",
    $KeyName
  )
  return Invoke-Onyx $Step $cmd
}

$v5 = Eval "$v5Path.LaunchFee()"
if (-not $v5.Ok -or $v5.Text -notmatch '\(10000000 int64\)') { throw "bazaarv5 LaunchFee moved: $($v5.Text)" }
Write-Host "bazaarv5 LaunchFee still 10 GNOT"

$feeLive = Pkg-Status $feePath
if ($feeLive -ne "live") { throw "fee/v1 is $feeLive" }
Write-Host "fee/v1 live"

Add-Pkg $grcPath $grcDir "20000000ugnot" "addpkg grc1155"
Wait-Live $grcPath
Add-Pkg $factoryPath $factoryDir "40000000ugnot" "addpkg efactory"
Wait-Live $factoryPath
Add-Pkg $edcolPath $edcolDir "40000000ugnot" "addpkg edcol"
Wait-Live $edcolPath

$bps = Eval "$factoryPath.ProtocolBps()"
if (-not $bps.Ok) {
  Invoke-Call "Init efactory" $factoryPath "Init" @() | Out-Null
  Start-Sleep -Seconds 6
  $bps = Eval "$factoryPath.ProtocolBps()"
}
if (-not $bps.Ok -or $bps.Text -notmatch '\(200 int64\)') { throw "ProtocolBps: $($bps.Text)" }

$feeNow = Eval "$factoryPath.LaunchFee()"
if (-not $feeNow.Ok) { throw "LaunchFee: $($feeNow.Text)" }
if ($feeNow.Text -notmatch '\(0 int64\)') {
  Invoke-Call "SetLaunchFee 0" $factoryPath "SetLaunchFee" @("0") | Out-Null
  Start-Sleep -Seconds 6
  $feeNow = Eval "$factoryPath.LaunchFee()"
}
if (-not $feeNow.Ok -or $feeNow.Text -notmatch '\(0 int64\)') { throw "efactory LaunchFee: $($feeNow.Text)" }

$name = Eval "$edcolPath.Name()"
$named = $name.Ok -and ((Unwrap-Gno $name.Text) -eq "Prints")
if (-not $named) {
  $reserved = $false
  try {
    Invoke-Call "Reserve edcol" $factoryPath "Reserve" @("edcol") | Out-Null
    $reserved = $true
  } catch {
    $msg = $_.Exception.Message
    if ($msg -notmatch 'slug taken') { throw }
    Write-Host "slug edcol already reserved"
    $reserved = $true
  }
  if (-not $reserved) { throw "reserve did not land" }
  Start-Sleep -Seconds 6
  try {
    Invoke-Call "Init edcol" $edcolPath "Init" @("Prints", "PRINT", $cover, "500") | Out-Null
  } catch {
    if ($_.Exception.Message -notmatch 'already') { throw }
    Write-Host "edcol already inited"
  }
  Start-Sleep -Seconds 6
  $name = Eval "$edcolPath.Name()"
}
if (-not $name.Ok -or (Unwrap-Gno $name.Text) -ne "Prints") { throw "Name: $($name.Text)" }

$eds = Eval "$edcolPath.Editions()"
if (-not $eds.Ok) { throw "Editions: $($eds.Text)" }
$edText = Unwrap-Gno $eds.Text
if ($edText -notmatch '(?m)^print\|Trial Print\|') {
  Invoke-Call "Create print" $edcolPath "Create" @("print", "Trial Print", $cover, "20", "1000000") | Out-Null
  Start-Sleep -Seconds 6
  $eds = Eval "$edcolPath.Editions()"
  if (-not $eds.Ok) { throw "Editions after create: $($eds.Text)" }
  $edText = Unwrap-Gno $eds.Text
}
$minted = 0
foreach ($line in ($edText -split "`n")) {
  if ($line -match '^print\|[^|]*\|[^|]*\|\d+\|(\d+)\|') { $minted = [int]$Matches[1] }
}
if ($minted -lt 4) {
  $need = 4 - $minted
  Invoke-Call "Mint print" $edcolPath "Mint" @("print", $Address, "$need") | Out-Null
  Start-Sleep -Seconds 6
}

$openQ = Eval "$edcolPath.OpenListings()"
if (-not $openQ.Ok) { throw "OpenListings: $($openQ.Text)" }
$open = Unwrap-Gno $openQ.Text
$want = "$Address|print|2|2000000"
if ($open -notmatch [regex]::Escape($want)) {
  if ($open -match [regex]::Escape("$Address|print|")) {
    Write-Host "seller already has another print listing; leaving it"
  } else {
    Invoke-Call "List print" $edcolPath "List" @("print", "2", "2000000") | Out-Null
    Start-Sleep -Seconds 6
    $openQ = Eval "$edcolPath.OpenListings()"
    $open = Unwrap-Gno $openQ.Text
  }
}

$eds = Eval "$edcolPath.Editions()"
if ($eds.Ok) { $edText = Unwrap-Gno $eds.Text }
$balExpr = $edcolPath + '.BalanceOf("' + $Address + '","print")'
$bal = Eval $balExpr
$books = Eval "$factoryPath.ListEditions()"
$v5b = Eval "$v5Path.LaunchFee()"
Write-Host "ONYX_GRC=$grcPath"
Write-Host "ONYX_EFACTORY=$factoryPath"
Write-Host "ONYX_EDCOL=$edcolPath"
Write-Host "NAME=$($name.Text)"
Write-Host "EDITIONS=$edText"
Write-Host "OPEN=$open"
Write-Host "BALANCE=$($bal.Text)"
Write-Host "LISTED=$($books.Text)"
Write-Host "V5_FEE=$($v5b.Text)"
if ($v5b.Text -notmatch '\(10000000 int64\)') { throw "bazaarv5 LaunchFee changed" }
if ($open -notmatch [regex]::Escape($want)) { throw "listing missing: $open" }
if ($edText -notmatch '(?m)^print\|Trial Print\|') { throw "edition missing" }
Write-Host "ONYX_EDITIONS_OK"
