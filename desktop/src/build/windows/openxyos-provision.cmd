@echo off
setlocal EnableExtensions
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0openxyos-provision.ps1" %*
exit /b %ERRORLEVEL%
