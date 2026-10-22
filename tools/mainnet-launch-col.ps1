# Stage + addpkg + Reserve + Init + mint one factory collection on gnoland-1.
# Uses col template (Adena string TokenID + List/Buy). gnokey v1.5 for --send.
param(
  [string]$Slug = "stdcol",
  [string]$Name = "StdCol",
  [string]$Symbol = "STDCOL",
  [string]$Cover = "https://bazaar-gno.vercel.app/gnomies.png",
  [int]$MaxSupply = 1,
  [int64]$MintPrice = 0,
  [int64]$RoyaltyBps = 500,
  [string]$ItemName = "Std Gnomie",
  [string]$ItemImage = "https://bazaar-gno.vercel.app/gnomies.png",
  [string]$ItemRarity = "Legendary",
  [string]$ItemTraits = "Kind:Adena;Surface:GRC721",
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

$Slug = $Slug.Trim().ToLowerInvariant()
$col = Stage-BazaarMainnetCol -Root $ROOT -Slug $Slug -Address $Address
$pkgPath = $col.Path
$factoryPath = "gno.land/r/$Address/bazaar/bazaarv4"

$common = "C:\Users\Hi\gnomemepad\scripts\gnokey-common.ps1"
. $common
Import-DotEnvDeploy -Root "C:\Users\Hi\gnomemepad"
Import-DotEnvDeploy -Root $ROOT
if ($env:GNOKEY_NAME) { $KeyName = $env:GNOKEY_NAME }
if ($env:BAZAAR_DEPLOYER) { $Address = $env:BAZAAR_DEPLOYER }
$col = Stage-BazaarMainnetCol -Root $ROOT -Slug $Slug -Address $Address
$pkgPath = $col.Path
$factoryPath = "gno.land/r/$Address/bazaar/bazaarv4"
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
  Invoke-V15 -Step "addpkg $pkgPath" -Cmd @(
    "maketx", "addpkg",
    "-pkgpath", $pkgPath,
    "-pkgdir", $col.Dir,
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
  $out = Query-V15 "vm/qeval" "$pkgPath.Name()"
  if ($out -match "call Init first" -or ($out -match '\(".*" string\)' -and $out -notmatch "invalid package|not enabled|inert")) {
    Write-Host "Enabled: $pkgPath"
    $enabled = $true
    break
  }
  Write-Host "GPAO wait $Slug ($($i+1)/80)"
  Start-Sleep -Seconds 15
}
if (-not $enabled) { throw "$pkgPath still inert after GPAO wait" }

$nameOut = Query-V15 "vm/qeval" "$pkgPath.Name()"
if ($nameOut -match "call Init first") {
  $reserved = Query-V15 "vm/qeval" "$factoryPath.ReservedCreator(`"$Slug`")"
  $reservedOk = $reserved -match ('\("' + [regex]::Escape($Address) + '"\s+string\)')
  if (-not $reservedOk) {
    Invoke-V15 -Step "Reserve $Slug" -Cmd @(
      "maketx", "call",
      "-pkgpath", $factoryPath,
      "-func", "Reserve",
      "-args", $Slug,
      "-send", "1000000000ugnot",
      "-gas-fee", $GasFee,
      "-gas-wanted", "80000000",
      "-chainid", $ChainId,
      "-remote", $Remote,
      "-broadcast",
      "-insecure-password-stdin=true",
      $KeyName
    )
  } else {
    Write-Host "Slug already reserved"
  }
  Invoke-V15 -Step "Init $Slug" -Cmd @(
    "maketx", "call",
    "-pkgpath", $pkgPath,
    "-func", "Init",
    "-args", $Name,
    "-args", $Symbol,
    "-args", $Cover,
    "-args", "$MaxSupply",
    "-args", "$MintPrice",
    "-args", "$RoyaltyBps",
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

$supply = Query-V15 "vm/qeval" "$pkgPath.TotalSupply()"
if ($supply -notmatch '\(1 int64\)') {
  $drop = "$ItemName|$ItemImage|$ItemRarity|$ItemTraits"
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
  Write-Host "Token 1 already minted"
}

Write-Host "COL_PKG=$pkgPath"
Write-Host "Adena Manage Collectables (gnoland-1): $pkgPath"
Write-Host "Leave unlisted so the wallet still owns token 1."
