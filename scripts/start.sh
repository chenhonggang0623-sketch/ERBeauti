#!/usr/bin/env bash
# Start ERBeauti locally: backend + frontend + sample SQLite database.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PID_FILE="${PROJECT_ROOT}/.erbeauti.pid"
LOG_DIR="${PROJECT_ROOT}/data/logs"
mkdir -p "${LOG_DIR}"

cd "${PROJECT_ROOT}"

echo "🚀 Starting ERBeauti locally..."

# Check required tools
PYTHON_CMD=""
for cmd in python3 python; do
  if command -v "$cmd" &>/dev/null; then
    PYTHON_CMD="$cmd"
    break
  fi
done
if [[ -z "$PYTHON_CMD" ]]; then
  echo "❌ Python is not installed. Please install Python 3.10+ from https://www.python.org/downloads/"
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "❌ Node.js is not installed. Please install Node.js 20+ from https://nodejs.org/"
  exit 1
fi

if ! command -v npm &>/dev/null; then
  echo "❌ npm is not installed. Please install Node.js 20+ from https://nodejs.org/"
  exit 1
fi

if ! command -v npx &>/dev/null; then
  echo "❌ npx is not available. Please install Node.js 20+ from https://nodejs.org/"
  exit 1
fi

# Check Python version (no external deps like bc; use Python itself)
PY_MAJOR=$("$PYTHON_CMD" -c 'import sys; print(sys.version_info[0])')
PY_MINOR=$("$PYTHON_CMD" -c 'import sys; print(sys.version_info[1])')
if [[ "${PY_MAJOR}" -lt 3 ]] || { [[ "${PY_MAJOR}" -eq 3 ]] && [[ "${PY_MINOR}" -lt 10 ]]; }; then
  echo "❌ Python version ${PY_MAJOR}.${PY_MINOR} is too old. Python 3.10+ is required."
  echo "   Please upgrade Python from https://www.python.org/downloads/"
  exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version 2>&1 | grep -Eo '[0-9]+' | head -1)
if [[ "$NODE_VERSION" -lt 20 ]]; then
  echo "❌ Node.js version $(node --version) is too old. Node.js 20+ is required."
  echo "   Please upgrade Node.js from https://nodejs.org/"
  exit 1
fi

# Check Python virtual environment
if [[ ! -d "python_part/.venv" ]]; then
  echo "❌ Python virtual environment not found at python_part/.venv"
  echo "   Please run: cd python_part && ${PYTHON_CMD} -m venv .venv && source .venv/bin/activate && pip install -e ."
  exit 1
fi

# Check Node.js dependencies
if [[ ! -d "node_modules" ]]; then
  echo "❌ Node modules not found. Please run: npm install"
  exit 1
fi

# Stop any existing instances first
if [[ -f "${PID_FILE}" ]]; then
  echo "🛑 Found existing PID file, stopping previous instances..."
  bash "${SCRIPT_DIR}/end.sh" || true
fi

# Check backend port availability (uvicorn would fail silently otherwise)
if (exec 3<>/dev/tcp/127.0.0.1/8000) 2>/dev/null; then
  echo "❌ Port 8000 is already in use. Another instance may be running."
  echo "   Please run './scripts/end.sh' first, or free the port manually."
  exit 1
fi

# Initialize sample SQLite database
echo "🗄️  Initializing sample SQLite database..."
npx tsx "scripts/init-demo-db.ts"

# Start backend
echo "🔧 Starting backend on http://localhost:8000 ..."
nohup bash -c '
  cd "'"${PROJECT_ROOT}"'/python_part"
  # shellcheck disable=SC1091
  source .venv/bin/activate
  export ERBEAUTI_SQLITE_DATA_DIR="'"${PROJECT_ROOT}"'/data"
  exec uvicorn erbeauti.api:app --host 127.0.0.1 --port 8000
' > "${LOG_DIR}/backend.log" 2>&1 &
BACKEND_PID=$!
disown "${BACKEND_PID}" 2>/dev/null || true

# Start frontend
echo "🎨 Starting frontend dev server..."
nohup npm run dev > "${LOG_DIR}/frontend.log" 2>&1 &
FRONTEND_PID=$!
disown "${FRONTEND_PID}" 2>/dev/null || true

# Record PIDs
cat > "${PID_FILE}" <<EOF
BACKEND_PID=${BACKEND_PID}
FRONTEND_PID=${FRONTEND_PID}
EOF

echo "✅ ERBeauti is starting up!"
echo "   Backend PID:  ${BACKEND_PID}"
echo "   Frontend PID: ${FRONTEND_PID}"
echo ""
echo "   Backend:  http://localhost:8000"
echo "   Frontend: http://localhost:5173 (or the next available port shown above)"
echo "   Logs:     ${LOG_DIR}/"
echo ""
echo "   Run './scripts/end.sh' to stop."
