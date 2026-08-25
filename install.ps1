# codebreak installer untuk Windows.
# Usage (PowerShell): irm https://raw.githubusercontent.com/dwitatwa/codebreak/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'
$repo = 'dwitatwa/codebreak'
$installDir = "$env:LOCALAPPDATA\Programs\codebreak"

Write-Host "-> Mencari rilis terbaru dari github.com/$repo ..."
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest"
$asset = $release.assets | Where-Object { $_.name -eq 'codebreak-windows-x64.exe' } | Select-Object -First 1
if (-not $asset) {
    Write-Error "Tidak menemukan codebreak-windows-x64.exe di rilis terbaru. Cek https://github.com/$repo/releases"
}

New-Item -ItemType Directory -Force -Path $installDir | Out-Null
$target = Join-Path $installDir 'codebreak.exe'

Write-Host "-> Mengunduh $($asset.name) ..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $target

if ($env:PATH -notlike "*$installDir*") {
    Write-Host ""
    Write-Warning "$installDir belum ada di PATH. Tambahkan manual:"
    Write-Host "    [Environment]::SetEnvironmentVariable('Path', `$env:Path + ';$installDir', 'User')"
}

Write-Host ""
Write-Host "OK: codebreak terpasang di $target" -ForegroundColor Green
Write-Host "   Coba: codebreak doctor"
