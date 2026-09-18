@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem FreeOS green portable launcher (Windows)
rem Usage:
rem   start.bat
rem   start.bat --home D:\freeos-data
rem   start.bat --home .\data --host 0.0.0.0 --port 8088

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

if not defined FREEOS_HOME if defined OCTOP_HOME set "FREEOS_HOME=%OCTOP_HOME%"
if not defined FREEOS_HOME set "FREEOS_HOME=%ROOT%\data"
set "OCTOP_HOME=%FREEOS_HOME%"
set "HOST=127.0.0.1"
set "PORT=8088"
set "EXTRA="

:parse
if "%~1"=="" goto run
if /I "%~1"=="--home" (
  if "%~2"=="" (
    echo start.bat: --home requires a path
    exit /b 1
  )
  set "FREEOS_HOME=%~2"
  set "OCTOP_HOME=%~2"
  shift
  shift
  goto parse
)
if /I "%~1"=="--host" (
  if "%~2"=="" (
    echo start.bat: --host requires a value
    exit /b 1
  )
  set "HOST=%~2"
  shift
  shift
  goto parse
)
if /I "%~1"=="--port" (
  if "%~2"=="" (
    echo start.bat: --port requires a value
    exit /b 1
  )
  set "PORT=%~2"
  shift
  shift
  goto parse
)
if /I "%~1"=="-h" goto help
if /I "%~1"=="--help" goto help
set "EXTRA=!EXTRA! %~1"
shift
goto parse

:help
echo FreeOS green portable launcher
echo.
echo Usage: start.bat [--home DIR] [--host HOST] [--port PORT] [freeos run args...]
echo.
echo Defaults:
echo   FREEOS_HOME / --home   %%ROOT%%\data
echo   --host                 127.0.0.1
echo   --port                 8088
exit /b 0

:run
if not defined FREEOS_ORG_ENABLE set "FREEOS_ORG_ENABLE=1"
if not exist "%FREEOS_HOME%" mkdir "%FREEOS_HOME%"

set "PY=%ROOT%\runtime\python.exe"
if not exist "%PY%" (
  echo start.bat: portable Python not found at %PY%
  exit /b 1
)

if not exist "%ROOT%\launch.py" (
  echo start.bat: launch.py missing — rebuild the green package
  exit /b 1
)

rem Prefer launch.py (site.addsitedir + pywin32 DLL path). Do not set PYTHONPATH.
set "PYTHONNOUSERSITE=1"
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"
set "PYTHONPATH="

if /I "%FREEOS_ORG_SIDECAR%"=="1" goto startSidecar
if /I "%FREEOS_ORG_SIDECAR%"=="true" goto startSidecar
if /I "%FREEOS_ORG_SIDECAR%"=="yes" goto startSidecar
if /I "%FREEOS_ORG_SIDECAR%"=="on" goto startSidecar
echo [freeos] organization is in-host (set FREEOS_ORG_SIDECAR=1 for the Node sidecar)
goto afterSidecar
:startSidecar
if not defined FREEOS_ORG_SIDECAR_URL set "FREEOS_ORG_SIDECAR_URL=http://127.0.0.1:3780"
if not defined OPENXYOS_BASE_URL set "OPENXYOS_BASE_URL=%FREEOS_ORG_SIDECAR_URL%"
if exist "%ROOT%\org-sidecar\start-sidecar.bat" (
  echo [freeos] optional organization sidecar → %FREEOS_ORG_SIDECAR_URL%
  start "" /B "%ROOT%\org-sidecar\start-sidecar.bat"
)
:afterSidecar

echo [freeos] home=%FREEOS_HOME%
echo [freeos] http://%HOST%:%PORT%
"%PY%" "%ROOT%\launch.py" run --host %HOST% --port %PORT% %EXTRA%
exit /b %ERRORLEVEL%
