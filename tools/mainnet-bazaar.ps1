# Shared staging for gnoland-1. Does not print key material.
# Deployer namespace: gno.land/{p,r}/$Address/bazaar/...

function Get-BazaarMainnetRoots {
  param(
    [string]$Root,
    [string]$Address = "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt"
  )
  $feePath = "gno.land/p/$Address/bazaar/fee/v1"
  $grc721 = "gno.land/p/$Address/bazaar/grc721/v0"
  $meta = "gno.land/p/$Address/bazaar/grc721/metadata/v0"
  $factoryPath = "gno.land/r/$Address/bazaar/factory"
  $factoryV1Path = "gno.land/r/$Address/bazaar/bazaarv1"
  $factoryV2Path = "gno.land/r/$Address/bazaar/bazaarv2"
  $stage = Join-Path $Root "deploy\mainnet"
  [pscustomobject]@{
    Address        = $Address
    FeePath        = $feePath
    Grc721Path     = $grc721
    MetaPath       = $meta
    FactoryPath    = $factoryPath
    FactoryV1Path  = $factoryV1Path
    FactoryV2Path  = $factoryV2Path
    FactoryV3Path  = "gno.land/r/$Address/bazaar/bazaarv3"
    FactoryV4Path  = "gno.land/r/$Address/bazaar/bazaarv4"
    FactoryV5Path  = "gno.land/r/$Address/bazaar/bazaarv5"
    GpushPath      = "gno.land/r/$Address/bazaar/gpush"
    GpushV2Path    = "gno.land/r/$Address/bazaar/gpushv2"
    Gcol2Path      = "gno.land/r/$Address/bazaar/gcol2"
    GenesisPath    = "gno.land/r/$Address/bazaar/genesis"
    StageRoot      = $stage
    FeeDir         = Join-Path $stage "p\$Address\bazaar\fee\v1"
    Grc721Dir      = Join-Path $stage "p\$Address\bazaar\grc721\v0"
    MetaDir        = Join-Path $stage "p\$Address\bazaar\grc721\metadata\v0"
    FactoryDir     = Join-Path $stage "r\$Address\bazaar\factory"
    FactoryV1Dir   = Join-Path $stage "r\$Address\bazaar\bazaarv1"
    FactoryV2Dir   = Join-Path $stage "r\$Address\bazaar\bazaarv2"
    FactoryV3Dir   = Join-Path $stage "r\$Address\bazaar\bazaarv3"
    FactoryV4Dir   = Join-Path $stage "r\$Address\bazaar\bazaarv4"
    FactoryV5Dir   = Join-Path $stage "r\$Address\bazaar\bazaarv5"
    GpushDir       = Join-Path $stage "r\$Address\bazaar\gpush"
    GpushV2Dir     = Join-Path $stage "r\$Address\bazaar\gpushv2"
    Gcol2Dir       = Join-Path $stage "r\$Address\bazaar\gcol2"
    GenesisDir     = Join-Path $stage "r\$Address\bazaar\genesis"
    ColTplDir      = Join-Path $stage "col-template"
  }
}

function Rewrite-BazaarSource {
  param(
    [string]$Raw,
    [string]$Address,
    [string]$FactoryPath
  )
  $p = "gno.land/p/$Address/bazaar"
  $s = $Raw
  # Mainnet Adena only indexes genesis gno.land/p/nt/grc721/v0. Leave those imports.
  $s = $s.Replace("gno.land/p/bazaar/grc721", "$p/grc721")
  $s = $s.Replace("gno.land/p/bazaar/fee/v1", "$p/fee/v1")
  $s = $s.Replace("gno.land/r/bazaar/factory", $FactoryPath)
  $s = $s.Replace("gno.land/r/bazaar/gpush", "gno.land/r/$Address/bazaar/gpush")
  $s = $s.Replace("gno.land/r/bazaar/genesis", "gno.land/r/$Address/bazaar/genesis")
  $s = $s.Replace("gno.land/p/bazaar/dropstd/v1", "$p/dropstd/v1")
  return $s
}

function Copy-GnoPkg {
  param(
    [string]$SrcDir,
    [string]$DstDir,
    [string]$Module,
    [string]$Address,
    [string]$FactoryPath,
    [string]$PackageRename = "",
    [scriptblock]$ExtraRewrite = $null
  )
  New-Item -ItemType Directory -Force -Path $DstDir | Out-Null
  Get-ChildItem $SrcDir -File | Where-Object {
    $_.Name -eq "gnomod.toml" -or ($_.Extension -eq ".gno" -and $_.Name -notlike "*_test*")
  } | ForEach-Object {
    $raw = Get-Content $_.FullName -Raw -Encoding UTF8
    $raw = Rewrite-BazaarSource -Raw $raw -Address $Address -FactoryPath $FactoryPath
    if ($FactoryPath -match '/bazaarv\d+$') {
      $bare = '"' + $FactoryPath + '"'
      $alias = 'factory ' + $bare
      $raw = $raw.Replace("import $bare", "import $alias")
      $raw = [regex]::Replace($raw, '(?m)^([ \t]*)' + [regex]::Escape($bare) + '[ \t]*$', '${1}' + $alias)
    }
    if ($PackageRename) {
      $raw = $raw.Replace("package col", "package $PackageRename")
    }
    if ($ExtraRewrite) { $raw = & $ExtraRewrite $raw }
    $name = $_.Name
    if ($PackageRename -and $name -eq "col.gno") { $name = "$PackageRename.gno" }
    if ($name -eq "gnomod.toml") {
      $raw = "module = `"$Module`"`ngno = `"0.9`"`n"
    }
    [IO.File]::WriteAllText((Join-Path $DstDir $name), $raw)
  }
}

function Stage-BazaarMainnet {
  param(
    [string]$Root,
    [string]$Address = "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt"
  )
  $m = Get-BazaarMainnetRoots -Root $Root -Address $Address
  if (Test-Path $m.StageRoot) {
    Remove-Item -Recurse -Force $m.StageRoot
  }
  Copy-GnoPkg -SrcDir (Join-Path $Root "gno.land\p\bazaar\fee\v1") -DstDir $m.FeeDir -Module $m.FeePath -Address $Address -FactoryPath $m.FactoryPath
  Copy-GnoPkg -SrcDir (Join-Path $Root "gno.land\p\bazaar\grc721\v0") -DstDir $m.Grc721Dir -Module $m.Grc721Path -Address $Address -FactoryPath $m.FactoryPath
  Copy-GnoPkg -SrcDir (Join-Path $Root "gno.land\p\bazaar\grc721\metadata\v0") -DstDir $m.MetaDir -Module $m.MetaPath -Address $Address -FactoryPath $m.FactoryPath
  Copy-GnoPkg -SrcDir (Join-Path $Root "gno.land\r\bazaar\factory") -DstDir $m.FactoryDir -Module $m.FactoryPath -Address $Address -FactoryPath $m.FactoryPath -ExtraRewrite {
    param($raw)
    $raw = $raw.Replace("defaultLaunchFee = int64(1_000_000_000) // 1000 GNOT", "defaultLaunchFee = int64(10_000_000) // 10 GNOT")
    $raw = $raw.Replace("defaultLaunchFee = int64(1_000_000_000)", "defaultLaunchFee = int64(10_000_000)")
    return $raw
  }
  Copy-GnoPkg -SrcDir (Join-Path $Root "gno.land\r\bazaar\col") -DstDir $m.ColTplDir -Module "gno.land/r/$Address/bazaar/col" -Address $Address -FactoryPath $m.FactoryPath

  $manifest = @"
# Bazaar gnoland-1 staged packages
# Generated. Do not addpkg until GPAO order is respected.
# Chain: gnoland-1  RPC: https://rpc.gno.land:443
# Deployer: $Address
# LaunchFee in staged factory: 10 GNOT (10e6 ugnot)

1. $($m.FeePath)
   dir $($m.FeeDir)
2. $($m.Grc721Path)
   dir $($m.Grc721Dir)
3. $($m.MetaPath)   (needs #2 enabled)
   dir $($m.MetaDir)
4. $($m.FactoryPath)   (needs p/nt/avl/v0 genesis)
   dir $($m.FactoryDir)
5. After GPAO enables #4: gnokey call Init (EOA)
6. Optional collection: tools/mainnet-new-col.ps1 -Slug NAME
   template $($m.ColTplDir)

Not staged (not required for factory+col): nftv7, hub, market, dropstd, enumerable, royalty.
"@
  [IO.File]::WriteAllText((Join-Path $m.StageRoot "MANIFEST.md"), $manifest)
  Write-Host $manifest
  return $m
}

function Stage-BazaarMainnetCol {
  param(
    [string]$Root,
    [string]$Slug,
    [string]$Address = "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt"
  )
  $Slug = $Slug.Trim().ToLowerInvariant()
  if ($Slug -notmatch '^[a-z][a-z0-9]{1,10}$') {
    throw "slug must be [a-z][a-z0-9]{1,10} (package name, no hyphen)"
  }
  $m = Get-BazaarMainnetRoots -Root $Root -Address $Address
  $srcCol = Join-Path $Root "gno.land\r\bazaar\col\col.gno"
  $src = Get-Content $srcCol -Raw -Encoding UTF8
  if ($src -notmatch 'gno\.land/p/nt/grc721/v0') {
    throw "mainnet col must import genesis gno.land/p/nt/grc721/v0 (Adena event filter)"
  }
  if ($src -notmatch 'func OwnerOf\(tid string\) \(address, error\)') {
    throw "mainnet col must export OwnerOf(tid string) (address, error) (Adena IIFE)"
  }
  if ($src -match 'gno\.land/p/bazaar/grc721') {
    throw "mainnet col must not import p/bazaar/grc721 (Adena ignores those Transfer events)"
  }
  $colPath = "gno.land/r/$Address/bazaar/c/$Slug"
  $dst = Join-Path $m.StageRoot "r\$Address\bazaar\c\$Slug"
  Copy-GnoPkg -SrcDir (Join-Path $Root "gno.land\r\bazaar\col") -DstDir $dst -Module $colPath -Address $Address -FactoryPath $m.FactoryV5Path -PackageRename $Slug
  $staged = Get-Content (Join-Path $dst "$Slug.gno") -Raw -Encoding UTF8
  if ($staged -notmatch 'gno\.land/p/nt/grc721/v0') {
    throw "staged $Slug lost genesis p/nt/grc721 import"
  }
  Write-Host "COL_PKG=$colPath"
  Write-Host "COL_DIR=$dst"
  Write-Host "Adena GRC721=gno.land/p/nt/grc721/v0"
  return [pscustomobject]@{ Path = $colPath; Dir = $dst }
}
