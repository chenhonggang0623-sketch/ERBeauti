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

# Check Python virtual environment
if [[ ! -d "python_part/.venv" ]]; then
  echo "❌ Python virtual environment not found at python_part/.venv"
  echo "   Please run: cd python_part && python3 -m venv .venv && source .venv/bin/activate && pip install -e ."
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
