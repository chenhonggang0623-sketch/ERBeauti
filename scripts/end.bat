@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "PID_FILE=%PROJECT_ROOT%\.erbeauti.pid"

cd /d "%PROJECT_ROOT%"

if not exist "%PID_FILE%" (
  echo ⚠️  No PID file found at %PID_FILE%. ERBeauti does not appear to be running.
  exit /b 0
)

echo 🛑 Stopping ERBeauti...

for /f "tokens=1,2 delims==" %%a in (%PID_FILE%) do (
  if "%%a"=="BACKEND_PID" set "BACKEND_PID=%%b"
  if "%%a"=="FRONTEND_PID" set "FRONTEND_PID=%%b"
)

call :stop_process "%BACKEND_PID%" "backend"
call :stop_process "%FRONTEND_PID%" "frontend"

del /f /q "%PID_FILE%" >nul 2>&1
echo ✅ ERBeauti stopped.
endlocal
exit /b 0

:stop_process
set "PID=%~1"
set "NAME=%~2"
if "!PID!"=="" (
  echo    !NAME! PID not recorded.
  goto :eof
)
tasklist /FI "PID eq !PID!" 2>nul | find "!PID!" >nul
if !errorlevel! equ 0 (
  echo    Stopping !NAME! (PID !PID!)...
  taskkill /PID !PID! /T /F >nul 2>&1
  echo    Stopped !NAME! (PID !PID!)
) else (
  echo    !NAME! is not running.
)
goto :eof
