@echo off
setlocal EnableExtensions
rem NSIS nsExec target. Real provisioner is provision-openxyos.ps1.
rem Hide PowerShell/Node stdout from the installer detail list: UTF-8
rem Chinese would mojibake as system ANSI (GBK on Chinese Windows).
rem Full logs: %LOCALAPPDATA%\FreeOS\openxyos\provision.log and start.log
rem Pass-through only. No cmd labels.
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0provision-openxyos.ps1" %* >nul 2>&1
exit /b %ERRORLEVEL%
