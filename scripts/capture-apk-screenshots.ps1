param(
  [string]$OutputDir = "screenshots\apk-layout",
  [string]$Label = "manual"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
  throw "adb was not found on PATH. Install Android platform-tools before running the screenshot matrix."
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$device = adb shell getprop ro.product.model
$size = adb shell wm size
$density = adb shell wm density
$fontScale = adb shell settings get system font_scale

$metaPath = Join-Path $OutputDir "$timestamp-$Label-meta.txt"
@(
  "Label: $Label"
  "Captured: $timestamp"
  "Device: $device"
  "Window: $size"
  "Density: $density"
  "Font scale: $fontScale"
) | Set-Content -Path $metaPath

$shotPath = Join-Path $OutputDir "$timestamp-$Label.png"
adb exec-out screencap -p > $shotPath

Write-Host "Saved $shotPath"
Write-Host "Saved $metaPath"
