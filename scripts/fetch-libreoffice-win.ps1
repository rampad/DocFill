<#
  fetch-libreoffice-win.ps1 — Ejecutar EN WINDOWS (PowerShell).

  Descarga LibreOffice (Windows x86-64), extrae su contenido SIN instalarlo
  (instalación administrativa de MSI) y lo copia a resources\libreoffice-win\
  para que electron-builder lo empaquete (PDF offline en el .exe).

  Uso:
    powershell -ExecutionPolicy Bypass -File scripts\fetch-libreoffice-win.ps1
    powershell -ExecutionPolicy Bypass -File scripts\fetch-libreoffice-win.ps1 -Version 26.2.3

  Después:  pnpm build:win
#>
param(
  [string]$Version = "26.2.3"
)
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root "resources\libreoffice-win"
$url  = "https://download.documentfoundation.org/libreoffice/stable/$Version/win/x86_64/LibreOffice_${Version}_Win_x86-64.msi"
$msi  = Join-Path $env:TEMP "LibreOffice_$Version.msi"
$adm  = Join-Path $env:TEMP "lo_admin_$Version"

Write-Host "Descargando LibreOffice $Version (Win x86-64)..."
Invoke-WebRequest -Uri $url -OutFile $msi

Write-Host "Extrayendo (instalación administrativa, sin instalar)..."
if (Test-Path $adm) { Remove-Item $adm -Recurse -Force }
New-Item -ItemType Directory -Path $adm | Out-Null
# /a = administrative install: descomprime los archivos a TARGETDIR sin tocar el sistema.
Start-Process msiexec.exe -ArgumentList "/a `"$msi`" /qn TARGETDIR=`"$adm`"" -Wait

$soffice = Get-ChildItem -Path $adm -Recurse -Filter "soffice.exe" | Select-Object -First 1
if (-not $soffice) { throw "No se encontró soffice.exe tras la extracción." }
$loRoot = Split-Path -Parent (Split-Path -Parent $soffice.FullName)  # carpeta que contiene program\ y share\

Write-Host "Copiando a $dest ..."
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Path $dest | Out-Null
Copy-Item -Path (Join-Path $loRoot "*") -Destination $dest -Recurse -Force

Remove-Item $msi -Force
Remove-Item $adm -Recurse -Force

$check = Join-Path $dest "program\soffice.exe"
if (Test-Path $check) { Write-Host "OK: $check" } else { throw "Falta program\soffice.exe en $dest" }
