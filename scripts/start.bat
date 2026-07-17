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

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
  echo ❌ Python is not installed. Please install Python 3.10+ from https://www.python.org/downloads/
  exit /b 1
)

:: Check Python version
for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set PY_VER=%%v
for /f "tokens=1 delims=." %%m in ("%PY_VER%") do set PY_MAJOR=%%m
for /f "tokens=2 delims=." %%m in ("%PY_VER%") do set PY_MINOR=%%m
if %PY_MAJOR% lss 3 (
  echo ❌ Python version %PY_VER% is too old. Python 3.10+ is required.
  exit /b 1
)
if %PY_MAJOR% equ 3 if %PY_MINOR% lss 10 (
  echo ❌ Python version %PY_VER% is too old. Python 3.10+ is required.
  exit /b 1
)

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
  echo ❌ Node.js is not installed. Please install Node.js 20+ from https://nodejs.org/
  exit /b 1
)

:: Check Node.js version
for /f "tokens=1 delims=v" %%v in ('node --version') do set NODE_VER=%%v
for /f "tokens=1 delims=." %%m in ("%NODE_VER%") do set NODE_MAJOR=%%m
if %NODE_MAJOR% lss 20 (
  echo ❌ Node.js version %NODE_VER% is too old. Node.js 20+ is required.
  echo    Please upgrade Node.js from https://nodejs.org/
  exit /b 1
)

:: Check npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
  echo ❌ npm is not available. Please install Node.js 20+ from https://nodejs.org/
  exit /b 1
)

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
