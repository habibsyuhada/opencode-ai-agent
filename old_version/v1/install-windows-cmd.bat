@echo off
setlocal
set "SOURCE_DIR=%~dp0"
set "TARGET_DIR=%USERPROFILE%\.config\opencode\agents"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
copy /Y "%SOURCE_DIR%agents\*.md" "%TARGET_DIR%" >nul
echo Installed company-style role-based SDD agents to: %TARGET_DIR%
echo Use: @flow-director Start company-style SDD flow from this idea: ...
