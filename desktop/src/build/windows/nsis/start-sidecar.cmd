@echo off
setlocal EnableExtensions
rem Thin launcher for start-sidecar.ps1. No goto labels.
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0start-sidecar.ps1"
exit /b %ERRORLEVEL%
