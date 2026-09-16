@echo off
setlocal EnableExtensions
powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0start-sidecar.ps1"
exit /b %ERRORLEVEL%
