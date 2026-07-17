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

# Check Python version
PYTHON_VERSION=$("$PYTHON_CMD" --version 2>&1 | grep -oP '\d+\.\d+')
if [[ "$(echo "$PYTHON_VERSION < 3.10" | bc -l)" -eq 1 ]]; then
  echo "❌ Python version $PYTHON_VERSION is too old. Python 3.10+ is required."
  echo "   Please upgrade Python from https://www.python.org/downloads/"
  exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version 2>&1 | grep -oP '\d+' | head -1)
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

# Initialize sample SQLite database
echo "🗄️  Initializing sample SQLite database..."
npx tsx "scripts/init-demo-db.ts"

# Stop any existing instances
if [[ -f "${PID_FILE}" ]]; then
  echo "🛑 Found existing PID file, stopping previous instances..."
  bash "${SCRIPT_DIR}/end.sh" || true
fi

# Start backend
echo "🔧 Starting backend on http://localhost:8000 ..."
(
  cd "python_part"
  # shellcheck disable=SC1091
  source .venv/bin/activate
  export ERBEAUTI_SQLITE_DATA_DIR="${PROJECT_ROOT}/data"
  exec uvicorn erbeauti.api:app --host 127.0.0.1 --port 8000
) > "${LOG_DIR}/backend.log" 2>&1 &
BACKEND_PID=$!

# Start frontend
echo "🎨 Starting frontend dev server..."
(
  exec npm run dev
) > "${LOG_DIR}/frontend.log" 2>&1 &
FRONTEND_PID=$!

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
