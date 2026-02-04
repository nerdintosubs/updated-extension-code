Param(
  [string]$AppPath = "ou-link-validator-A",
  [string]$OutDir = "dist",
  [string]$OutName = "ou-link-validator-A.zip"
)

$ErrorActionPreference = "Stop"
$repo = Split-Path $PSScriptRoot -Parent
$app = Join-Path $repo $AppPath
$dist = Join-Path $repo $OutDir
$stage = Join-Path $dist "ou-link-validator-A"

if (Test-Path $dist) { Remove-Item -Recurse -Force $dist }
New-Item -ItemType Directory -Path $stage | Out-Null

# Copy required extension files only
Copy-Item -Path (Join-Path $app 'manifest.json') -Destination $stage -Force
Copy-Item -Path (Join-Path $app 'bg.js') -Destination $stage -Force
Copy-Item -Path (Join-Path $app 'popup.html') -Destination $stage -Force
Copy-Item -Path (Join-Path $app 'popup.js') -Destination $stage -Force
Copy-Item -Path (Join-Path $app 'icon.png') -Destination $stage -Force

# Copy source used by background
Copy-Item -Recurse -Path (Join-Path $app 'src') -Destination (Join-Path $stage 'src') -Force

$zipPath = Join-Path $dist $OutName
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zipPath -Force

Write-Host "Packaged: $zipPath"
