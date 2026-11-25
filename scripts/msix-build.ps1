<#
.SYNOPSIS
  Builds the MSIX of mallow's Microsoft Store variant (TASK-58, TASK-64).

.DESCRIPTION
  Run on Windows from any directory, with the Windows SDK installed (it carries
  makeappx.exe and signtool.exe) and the repository's usual toolchain.

  1. Refuses unless HEAD is the tag of tauri.conf.json's version (vX.Y.Z) and
     the working tree is clean; -AllowUntagged lifts both, for a package that
     is only installed locally.
  2. Builds the Store variant: MALLOW_STORE=1 pnpm tauri build --no-bundle.
  3. Lays out mallow.exe, THIRD-PARTY-NOTICES.md and the tile logos under
     src-tauri\target\msix\layout.
  4. Fills src-tauri\windows\msix\AppxManifest.xml, with the version from
     tauri.conf.json as X.Y.Z.0 and the identity Partner Center issued.
  5. Packs src-tauri\target\msix\mallow_<version>_x64.msix with makeappx and,
     given -Thumbprint, signs it with signtool.

  The Store re-signs a package it accepts, so the one uploaded to Partner
  Center is expected to need no signature of mallow's own; TASK-64 records
  whether the first upload bore that out.

  A package installs locally only when signed by a certificate the machine
  trusts whose subject is exactly the manifest's Publisher. Once:

    $cert = New-SelfSignedCertificate -Type Custom `
      -Subject 'CN=489A8945-B788-471B-A41E-79B040EEF003' `
      -KeyUsage DigitalSignature -FriendlyName 'mallow MSIX local' `
      -CertStoreLocation Cert:\CurrentUser\My `
      -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}')
    Export-Certificate -Cert $cert -FilePath mallow-local.cer
    # In an elevated shell:
    Import-Certificate -FilePath mallow-local.cer -CertStoreLocation Cert:\LocalMachine\TrustedPeople

  then pass $cert.Thumbprint as -Thumbprint, and install the result with
  Add-AppxPackage <path>. Remove it with
  Get-AppxPackage SerendpityNZ-SimpleBoxes.mallow | Remove-AppxPackage.

.PARAMETER Thumbprint
  A code-signing certificate in Cert:\CurrentUser\My. Without it the package is
  left unsigned, which makeappx allows and Add-AppxPackage refuses.

.PARAMETER AllowUntagged
  Builds from whatever is checked out, uncommitted changes included. Such a
  package is not a release and is never uploaded.

.PARAMETER Publisher
  The manifest's Publisher. Has to equal the signing certificate's subject.

.PARAMETER PublisherDisplayName
  The manifest's PublisherDisplayName. Partner Center refuses an upload whose
  value differs from the account's.

.PARAMETER IdentityName
  The manifest's identity name.
#>
[CmdletBinding()]
param(
  [string]$Thumbprint,
  [switch]$AllowUntagged,
  # Issued by Partner Center for the reserved name (Product identity). The
  # misspelt "Serendpity" is how the account was created; correcting the
  # account's display name did not change what the product page issues.
  [string]$Publisher = 'CN=489A8945-B788-471B-A41E-79B040EEF003',
  [string]$PublisherDisplayName = 'SerendpityNZ - SimpleBoxes',
  [string]$IdentityName = 'SerendpityNZ-SimpleBoxes.mallow'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$tauri = Join-Path $root 'src-tauri'

function Find-SdkTool([string]$name) {
  $onPath = Get-Command $name -ErrorAction SilentlyContinue
  if ($onPath) {
    return $onPath.Source
  }
  $kits = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
  $found = Get-ChildItem $kits -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^10\.\d+\.\d+\.\d+$' } |
    Sort-Object { [version]$_.Name } -Descending |
    ForEach-Object { Join-Path $_.FullName "x64\$name" } |
    Where-Object { Test-Path $_ } |
    Select-Object -First 1
  if (-not $found) {
    throw "$name was not found on PATH or under $kits; install the Windows SDK."
  }
  return $found
}

# Everything that can be refused is checked before the build, which takes
# minutes, rather than after it.
$makeappx = Find-SdkTool 'makeappx.exe'
$signtool = if ($Thumbprint) { Find-SdkTool 'signtool.exe' } else { $null }
if ($Thumbprint) {
  $cert = Get-Item "Cert:\CurrentUser\My\$Thumbprint" -ErrorAction SilentlyContinue
  if (-not $cert) {
    throw "No certificate $Thumbprint in Cert:\CurrentUser\My."
  }
  # A mismatch packs and signs without complaint and fails only at install.
  if ($cert.Subject -ne $Publisher) {
    throw "The certificate's subject '$($cert.Subject)' is not -Publisher '$Publisher'; the package would not install."
  }
}

# The Store wants four parts with the last one 0. A pre-release suffix has no
# place in an MSIX version, so it stops here rather than being dropped.
$conf = Get-Content (Join-Path $tauri 'tauri.conf.json') -Raw | ConvertFrom-Json
if ($conf.version -notmatch '^\d+\.\d+\.\d+$') {
  throw "tauri.conf.json's version '$($conf.version)' is not X.Y.Z."
}
$version = "$($conf.version).0"

# A package carries no record of the commit it came from, so what was built is
# settled here: the release's tag, with nothing on top of it.
if (-not $AllowUntagged) {
  $tag = "v$($conf.version)"
  $tagsAtHead = git -C $root tag --points-at HEAD
  if ($LASTEXITCODE -ne 0) {
    throw "git tag failed with exit code $LASTEXITCODE."
  }
  if ($tagsAtHead -notcontains $tag) {
    throw "HEAD is not $tag. Check out the release's tag, or pass -AllowUntagged for a local package."
  }
  $changes = git -C $root status --porcelain
  if ($LASTEXITCODE -ne 0) {
    throw "git status failed with exit code $LASTEXITCODE."
  }
  if ($changes) {
    throw "The working tree has changes on top of $tag; commit or stash them, or pass -AllowUntagged."
  }
}

# --no-bundle because the package is assembled here, not by tauri's bundler;
# --no-sign as the paper job builds, so no updater key is asked for. The build
# is never skipped: a mallow.exe left in target\release by an ordinary build
# carries the updater, and nothing in the binary tells the two apart.
$env:MALLOW_STORE = '1'
try {
  Push-Location $root
  pnpm tauri build --no-bundle --no-sign
  if ($LASTEXITCODE -ne 0) {
    throw "pnpm tauri build failed with exit code $LASTEXITCODE."
  }
} finally {
  Pop-Location
  Remove-Item Env:MALLOW_STORE
}

$out = Join-Path $tauri 'target\msix'
$layout = Join-Path $out 'layout'
if (Test-Path $layout) {
  Remove-Item $layout -Recurse -Force
}
$assets = Join-Path $layout 'Assets'
New-Item -ItemType Directory -Path $assets -Force | Out-Null

Copy-Item (Join-Path $tauri 'target\release\mallow.exe') $layout
# MIT and the other bundled licences require the notices to travel with the
# binary, as bundle.resources makes them for the other installers.
Copy-Item (Join-Path $root 'THIRD-PARTY-NOTICES.md') $layout
foreach ($logo in 'Square44x44Logo.png', 'Square150x150Logo.png', 'StoreLogo.png') {
  Copy-Item (Join-Path $tauri "icons\$logo") $assets
}

$manifest = Get-Content (Join-Path $tauri 'windows\msix\AppxManifest.xml') -Raw
$values = @{
  IDENTITY_NAME          = $IdentityName
  PUBLISHER              = $Publisher
  PUBLISHER_DISPLAY_NAME = $PublisherDisplayName
  VERSION                = $version
}
foreach ($key in $values.Keys) {
  $manifest = $manifest.Replace("{{$key}}", [Security.SecurityElement]::Escape($values[$key]))
}
if ($manifest -match '\{\{\w+\}\}') {
  throw "The manifest still carries $($Matches[0])."
}
# Without a BOM: Windows PowerShell's UTF8 encoding writes one.
[IO.File]::WriteAllText((Join-Path $layout 'AppxManifest.xml'), $manifest, (New-Object Text.UTF8Encoding $false))

$msix = Join-Path $out "mallow_${version}_x64.msix"
& $makeappx pack /d $layout /p $msix /o
if ($LASTEXITCODE -ne 0) {
  throw "makeappx failed with exit code $LASTEXITCODE."
}

if ($Thumbprint) {
  & $signtool sign /fd SHA256 /sha1 $Thumbprint $msix
  if ($LASTEXITCODE -ne 0) {
    throw "signtool failed with exit code $LASTEXITCODE."
  }
  Write-Host "Signed package: $msix"
} else {
  Write-Warning "Unsigned package: $msix. Add-AppxPackage refuses it; pass -Thumbprint to sign."
}
