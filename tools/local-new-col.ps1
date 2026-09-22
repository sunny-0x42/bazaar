# Copy the local collection template to gno.land/r/bazaar/c/<slug>.
# Local / gnodev only. Does not Pearl addpkg.
param(
  [Parameter(Mandatory = $true)]
  [string]$Slug
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$Slug = $Slug.Trim().ToLowerInvariant()
if ($Slug.Length -lt 2 -or $Slug.Length -gt 11) {
  throw "slug must be 2-11 chars (GRC721 symbol max 11)"
}
if ($Slug -notmatch '^[a-z0-9-]+$') {
  throw "slug must match [a-z0-9-]{2,11}"
}
if ($Slug -notmatch '^[a-z][a-z0-9]*$') {
  throw "slug must be a Gno package name: [a-z][a-z0-9]{1,10} (no hyphen, no leading digit)"
}

$src = Join-Path $root "gno.land\r\bazaar\col"
$dst = Join-Path $root "gno.land\r\bazaar\c\$Slug"
if (-not (Test-Path $src)) { throw "template missing: $src" }
if (Test-Path $dst) { throw "already exists: $dst" }

New-Item -ItemType Directory -Force -Path $dst | Out-Null
Get-ChildItem $src -File | Where-Object { $_.Name -eq "gnomod.toml" -or $_.Extension -eq ".gno" } | ForEach-Object {
  $raw = Get-Content $_.FullName -Raw -Encoding UTF8
  if ($null -eq $raw) { $raw = "" }
  $raw = $raw.Replace("package col", "package $Slug")
  $raw = $raw.Replace('module = "gno.land/r/bazaar/col"', "module = `"gno.land/r/bazaar/c/$Slug`"")
  $name = $_.Name
  if ($name -eq "col.gno") { $name = "$Slug.gno" }
  if ($name -eq "col_test.gno") { $name = "${Slug}_test.gno" }
  [IO.File]::WriteAllText((Join-Path $dst $name), $raw)
}

Write-Host "wrote gno.land/r/bazaar/c/$Slug"
Write-Host "next: gnodev extra-root, then Init factory, then $Slug.Init (LaunchFee ugnot)"
