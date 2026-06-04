$ErrorActionPreference = "Stop"

$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TargetDir = Join-Path (Join-Path (Join-Path $env:USERPROFILE ".config") "opencode") "agents"

New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
Copy-Item -Path (Join-Path $SourceDir "agents\*.md") -Destination $TargetDir -Force

Write-Host "Installed company-style role-based SDD agents to: $TargetDir"
Write-Host "Use: @flow-director Start company-style SDD flow from this idea: ..."
