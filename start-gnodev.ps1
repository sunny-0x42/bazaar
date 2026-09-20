# Windows: do not run gnodev from the repo root (WalkDir + gnowork.toml
# scans web/node_modules). Nested ws + extra-root, dedicated chain home
# (do not share AppData\Roaming\gno with Zdex).
param(
  [string]$DeployKey = "gnodevlocal"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$gnoRoot = "C:\Users\Hi\tools\gno"
$gnodev = "C:\Users\Hi\tools\gnodev.exe"
$ws = Join-Path $root "dev\ws"
$ws = [IO.Path]::GetFullPath($ws)
$gnoHome = Join-Path $env:USERPROFILE "AppData\Roaming\gno-bazaar"
New-Item -ItemType Directory -Force -Path $ws | Out-Null
New-Item -ItemType Directory -Force -Path $gnoHome | Out-Null
if (-not (Test-Path (Join-Path $ws "gnowork.toml"))) {
  Set-Content -Path (Join-Path $ws "gnowork.toml") -Value "" -Encoding ascii
}
$env:GNOROOT = $gnoRoot
Set-Location $ws
Write-Host "gnoweb  http://127.0.0.1:8888/r/bazaar/nft  deploy-key=$DeployKey  home=$gnoHome"
& $gnodev local `
  -no-examples -no-watch -web-with-html `
  -empty-blocks `
  -home $gnoHome `
  -deploy-key $DeployKey `
  -web-home /r/bazaar/nft `
  -extra-root (Join-Path $root "gno.land")
