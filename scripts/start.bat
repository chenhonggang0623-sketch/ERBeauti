@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "PID_FILE=%PROJECT_ROOT%\.erbeauti.pid"
set "LOG_DIR=%PROJECT_ROOT%\data\logs"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

cd /d "%PROJECT_ROOT%"

echo 🚀 Starting ERBeauti locally...

if not exist "python_part\.venv" (
  echo ❌ Python virtual environment not found at python_part\.venv
  echo    Please run: cd python_part ^&^& python -m venv .venv ^&^& .venv\Scripts\activate ^&^& pip install -e .
  exit /b 1
)

if not exist "node_modules" (
  echo ❌ Node modules not found. Please run: npm install
  exit /b 1
)

echo 🗄️  Initializing sample SQLite database...
npx tsx "scripts\init-demo-db.ts"

if exist "%PID_FILE%" (
  echo 🛑 Found existing PID file, stopping previous instances...
  call "%SCRIPT_DIR%end.bat"
)

echo 🔧 Starting backend on http://localhost:8000 ...
set "BACKEND_PID_FILE=%TEMP%\erbeauti_backend.pid"
powershell -NoProfile -Command ^
  "$p = Start-Process -NoNewWindow -PassThru -FilePath 'cmd' -ArgumentList '/c', 'cd /d \"%PROJECT_ROOT%\python_part\" && .venv\Scripts\activate && set ERBEAUTI_SQLITE_DATA_DIR=%PROJECT_ROOT%\data && uvicorn erbeauti.api:app --host 127.0.0.1 --port 8000 > \"%LOG_DIR%\backend.log\" 2>&1';" ^
  "$p.Id" > "%BACKEND_PID_FILE%"
set /p BACKEND_PID=<"%BACKEND_PID_FILE%"

echo 🎨 Starting frontend dev server...
set "FRONTEND_PID_FILE=%TEMP%\erbeauti_frontend.pid"
powershell -NoProfile -Command "$p = Start-Process -NoNewWindow -PassThru -FilePath 'cmd' -ArgumentList '/c', 'cd /d \"%PROJECT_ROOT%\" && npm run dev > \"%LOG_DIR%\frontend.log\" 2>&1'; $p.Id" > "%FRONTEND_PID_FILE%"
set /p FRONTEND_PID=<"%FRONTEND_PID_FILE%"

echo BACKEND_PID=%BACKEND_PID% > "%PID_FILE%"
echo FRONTEND_PID=%FRONTEND_PID% >> "%PID_FILE%"

echo ✅ ERBeauti is starting up!
echo    Backend PID:  %BACKEND_PID%
echo    Frontend PID: %FRONTEND_PID%
echo.
echo    Backend:  http://localhost:8000
echo    Frontend: http://localhost:5173
echo    Logs:     %LOG_DIR%\
echo.
echo    Run 'scripts\end.bat' to stop.

endlocal
