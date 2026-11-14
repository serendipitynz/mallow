# Adds or removes one directory on the current user's PATH, for the NSIS
# installer's hooks (TASK-62).
#
# PowerShell rather than NSIS's own registry calls because NSIS strings stop at
# a fixed length, so a long PATH would be read truncated and written back that
# way. The value is read unexpanded and written back with the registry kind it
# had, so entries such as %USERPROFILE%\bin survive the edit.
param(
  [Parameter(Mandatory = $true)] [string] $Dir,
  [switch] $Remove
)
$ErrorActionPreference = 'Stop'

$key = Get-Item -LiteralPath 'HKCU:\Environment'
$raw = $key.GetValue('Path', '', 'DoNotExpandEnvironmentNames')
$kind = if ($key.GetValueNames() -contains 'Path') { $key.GetValueKind('Path') } else { 'ExpandString' }

$wanted = $Dir.TrimEnd('\')
$entries = @($raw -split ';' | Where-Object { $_ -ne '' })
# -eq / -ne compare case-insensitively, as Windows compares paths.
$isOurs = { param($entry) $entry.Trim().TrimEnd('\') -eq $wanted }

$present = @($entries | Where-Object { & $isOurs $_ }).Count -gt 0
if ($Remove) {
  if (-not $present) { exit 0 }
  $next = @($entries | Where-Object { -not (& $isOurs $_) })
} else {
  if ($present) { exit 0 }
  $next = $entries + $wanted
}
[Microsoft.Win32.Registry]::SetValue('HKEY_CURRENT_USER\Environment', 'Path', ($next -join ';'), $kind)
