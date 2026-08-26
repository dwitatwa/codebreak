# codebreak installer for Windows.
# Usage (PowerShell): irm https://raw.githubusercontent.com/dwitatwa/codebreak/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'
$repo = 'dwitatwa/codebreak'
$installDir = "$env:LOCALAPPDATA\Programs\codebreak"

Write-Host "-> Looking up the latest release from github.com/$repo ..."
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest"
$asset = $release.assets | Where-Object { $_.name -eq 'codebreak-windows-x64.exe' } | Select-Object -First 1
if (-not $asset) {
    Write-Error "Could not find codebreak-windows-x64.exe in the latest release. Check https://github.com/$repo/releases"
}

New-Item -ItemType Directory -Force -Path $installDir | Out-Null
$target = Join-Path $installDir 'codebreak.exe'

Write-Host "-> Downloading $($asset.name) ..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $target

if ($env:PATH -notlike "*$installDir*") {
    Write-Host ""
    Write-Warning "$installDir is not in PATH yet. Add it manually:"
    Write-Host "    [Environment]::SetEnvironmentVariable('Path', `$env:Path + ';$installDir', 'User')"
}

Write-Host ""
Write-Host "OK: codebreak installed at $target" -ForegroundColor Green
Write-Host "   Try: codebreak doctor"
