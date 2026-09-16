@echo off
setlocal EnableExtensions
rem NSIS nsExec/ExecWait target. Real provisioner is provision-openxyos.ps1.
rem Pass-through only. No cmd labels.
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0provision-openxyos.ps1" %*
exit /b %ERRORLEVEL%
