<#
Clean development-only caches safely (Windows PowerShell)
This script removes Python caches within the current working tree only:
- __pycache__ directories
- .pytest_cache directories
- *.pyc files

Safety:
- Dry-run by default: shows what would be removed.
- Use -Confirm:$true to prompt before deletion.
- Use -Execute to actually perform deletions.

Example:
  # Dry-run
  pwsh -File scripts/clean_dev_caches.ps1
  # Execute with confirmation prompts
  pwsh -File scripts/clean_dev_caches.ps1 -Execute -Confirm:$true
  # Execute without prompts
  pwsh -File scripts/clean_dev_caches.ps1 -Execute -Confirm:$false
#>
[CmdletBinding(SupportsShouldProcess=$true, ConfirmImpact='Medium')]
param(
  [switch]$Execute
)

$root = Get-Location
Write-Host "Scanning for dev caches under: $root" -ForegroundColor Cyan

$targets = @()
# __pycache__ directories
$targets += Get-ChildItem -Path . -Recurse -Directory -Force -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -eq "__pycache__" -and $_.FullName -notmatch "\\(\.venv|venv|node_modules|\.git|\.hg|\.svn)\\" }
# .pytest_cache directories
$targets += Get-ChildItem -Path . -Recurse -Directory -Force -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -eq ".pytest_cache" -and $_.FullName -notmatch "\\(\.venv|venv|node_modules|\.git|\.hg|\.svn)\\" }
# *.pyc files
$pycFiles = Get-ChildItem -Path . -Recurse -File -Include *.pyc -Force -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch "\\(\.venv|venv|node_modules|\.git|\.hg|\.svn)\\" }

$sizeBytes = 0
foreach ($f in $pycFiles) { $sizeBytes += ($f.Length) }
foreach ($d in $targets) {
  try {
    $sizeBytes += (Get-ChildItem -Path $d.FullName -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
  } catch {}
}
$sizeMB = [Math]::Round($sizeBytes/1MB, 2)
Write-Host ("Estimated cleanup size: {0} MB" -f $sizeMB) -ForegroundColor Yellow

Write-Host "Targets:" -ForegroundColor Green
foreach ($d in $targets) { Write-Host ("  [dir]  {0}" -f $d.FullName) }
foreach ($f in $pycFiles) { Write-Host ("  [file] {0}" -f $f.FullName) }

if (-not $Execute) {
  Write-Host "Dry-run complete. Re-run with -Execute to delete." -ForegroundColor Cyan
  exit 0
}

# Execute deletions
foreach ($d in $targets) {
  if ($PSCmdlet.ShouldProcess($d.FullName, "Remove-Item -Recurse -Force")) {
    Remove-Item -LiteralPath $d.FullName -Recurse -Force -ErrorAction SilentlyContinue
  }
}
foreach ($f in $pycFiles) {
  if ($PSCmdlet.ShouldProcess($f.FullName, "Remove-Item -Force")) {
    Remove-Item -LiteralPath $f.FullName -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Cleanup complete." -ForegroundColor Cyan
