# Fund a throwaway key and Buy listing 1 on Pearl. Proves realm Buy is not UnauthorizedError.
param(
  [string]$SellerKey = "deploykey",
  [string]$BuyerKey = "bazaar-buyer",
  [string]$NftPath = "gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/nft",
  [string]$Remote = "https://rpc.pearl.testnets.gno.land:443",
  [string]$ChainId = "pearl-1",
  [int]$ItemId = 1,
  [string]$Send = "1000000ugnot"
)
$ErrorActionPreference = "Stop"
$env:PATH = "C:\Users\Hi\tools;$env:PATH"
$common = "C:\Users\Hi\gnomemepad\scripts\gnokey-common.ps1"
. $common
Initialize-GnokeyPath
Import-DotEnvDeploy -Root "C:\Users\Hi\gnomemepad"

$pass = Get-GnokeyPassword
if (-not $pass) { throw "GNOKEY_PASS missing" }

function Invoke-PipeGnokey([string[]]$GnokeyArgs, [string]$Password, [string]$Step, [int]$PasswordLines = 1) {
  Write-Host ">> $Step"
  $exe = (Get-Command gnokey).Source
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $exe
  $psi.Arguments = (($GnokeyArgs + @("-insecure-password-stdin")) | ForEach-Object {
    if ($_ -match '[\s"]') { '"{0}"' -f ($_ -replace '"', '\"') } else { $_ }
  }) -join " "
  $psi.UseShellExecute = $false
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()
  for ($i = 0; $i -lt $PasswordLines; $i++) {
    $p.StandardInput.Write($Password)
    if (-not $Password.EndsWith("`n")) { $p.StandardInput.Write("`n") }
  }
  $p.StandardInput.Close()
  $stdout = $p.StandardOutput.ReadToEnd()
  $stderr = $p.StandardError.ReadToEnd()
  $p.WaitForExit()
  $combined = $stdout + "`n" + $stderr
  $safe = [regex]::Replace($combined, "(?i)(mnemonic|seed phrase|secret)[^\n]*", "[redacted]")
  Write-Host $safe
  if ($p.ExitCode -ne 0) { throw "Failed: $Step exit $($p.ExitCode)" }
  return $combined
}

$addOut = ""
try {
  $addOut = Invoke-PipeGnokey @(
    "add", $BuyerKey, "-nobackup", "-force"
  ) $pass "add buyer key" 2
} catch {
  Write-Host "add buyer (may already exist): $($_.Exception.Message)"
}

$addrMatch = [regex]::Match($addOut, "g1[0-9a-z]{38,}")
if (-not $addrMatch.Success) {
  # query via maketx is hard; parse list with password
  $list = Invoke-PipeGnokey @("list") $pass "list keys"
  $addrMatch = [regex]::Match($list, "(?s)$BuyerKey.*?g1[0-9a-z]{38,}")
}
if (-not $addrMatch.Success) { throw "Could not parse buyer g1 address (not printed)." }
$buyer = $addrMatch.Value
Write-Host "BUYER=$buyer"

Invoke-Gnokey -StepName "bank send to buyer" -Args @(
  "maketx", "send", $SellerKey,
  "-to", $buyer,
  "-send", "5000000ugnot",
  "-gas-fee", "1000000ugnot",
  "-gas-wanted", "20000000",
  "-chainid", $ChainId,
  "-remote", $Remote,
  "-broadcast"
)

Invoke-PipeGnokey @(
  "maketx", "call", $BuyerKey,
  "--pkgpath", $NftPath,
  "--func", "Buy",
  "--args", "$ItemId",
  "--send", $Send,
  "--gas-fee", "1000000ugnot",
  "--gas-wanted", "80000000",
  "--chainid", $ChainId,
  "--remote", $Remote,
  "--broadcast"
) $pass "Buy item $ItemId as second wallet"

Write-Host "SMOKE_OK buyer=$buyer item=$ItemId"
