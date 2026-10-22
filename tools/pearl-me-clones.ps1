# Clone tffoxes/ffoxes/madlads on factoryv3 from me-pearl-clones.json.
# Signs with deploykey via gnokey-common. Password never printed.
param()
$ErrorActionPreference = "Stop"
$ROOT = Split-Path $PSScriptRoot -Parent
Set-Location $ROOT
$env:PATH = "C:\Users\Hi\tools;$env:PATH"

$common = "C:\Users\Hi\gnomemepad\scripts\gnokey-common.ps1"
if (-not (Test-Path $common)) { throw "gnokey-common.ps1 missing" }
. $common
Initialize-GnokeyPath
Import-DotEnvDeploy -Root "C:\Users\Hi\gnomemepad"
Import-DotEnvDeploy -Root $ROOT

$KeyName = "deploykey"
$Address = "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt"
Assert-DeployKeyExists -KeyName $KeyName -ExpectedAddress $Address
$pass = Get-GnokeyPassword
if (-not $pass) { throw "GNOKEY_PASS missing" }
$env:GNOKEY_PASS = $pass

$Py = Join-Path $ROOT "tools\pearl-me-clones.py"
& python $Py
if ($LASTEXITCODE -ne 0) { throw "me clones failed (exit $LASTEXITCODE)" }
