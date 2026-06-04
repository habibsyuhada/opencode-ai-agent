$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
Write-Host "Installing armiai globally from: $Root"
npm install -g .
Write-Host "Done. Try: armiai doctor"
