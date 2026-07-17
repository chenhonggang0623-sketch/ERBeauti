#!/usr/bin/env bash
# Stop a locally running ERBeauti instance.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PID_FILE="${PROJECT_ROOT}/.erbeauti.pid"

cd "${PROJECT_ROOT}"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "⚠️  No PID file found at ${PID_FILE}. ERBeauti does not appear to be running."
  exit 0
fi

echo "🛑 Stopping ERBeauti..."

# shellcheck source=/dev/null
source "${PID_FILE}"

stop_process() {
  local pid=$1
  local name=$2
  if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
    echo "   Stopping ${name} (PID ${pid})..."
    kill "${pid}" 2>/dev/null || true
    # Wait up to 5 seconds for graceful shutdown
    for _ in {1..10}; do
      if ! kill -0 "${pid}" 2>/dev/null; then
        break
      fi
      sleep 0.5
    done
    # Force kill if still running
    if kill -0 "${pid}" 2>/dev/null; then
      echo "   Force stopping ${name} (PID ${pid})..."
      kill -9 "${pid}" 2>/dev/null || true
    fi
  else
    echo "   ${name} is not running."
  fi
}

stop_process "${BACKEND_PID:-}" "backend"
stop_process "${FRONTEND_PID:-}" "frontend"

rm -f "${PID_FILE}"
echo "✅ ERBeauti stopped."
