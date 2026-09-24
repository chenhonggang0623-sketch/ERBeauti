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

# Recursively collect all descendant PIDs of a process (e.g. vite under npm)
collect_descendants() {
  local pid=$1
  local children child
  children=$(pgrep -P "${pid}" 2>/dev/null || true)
  for child in ${children}; do
    echo "${child}"
    collect_descendants "${child}"
  done
}

stop_process() {
  local pid=$1
  local name=$2
  if [[ -z "${pid}" ]] || ! kill -0 "${pid}" 2>/dev/null; then
    echo "   ${name} is not running."
    return 0
  fi

  echo "   Stopping ${name} (PID ${pid})..."

  # Collect descendants BEFORE killing the parent, so orphaned children
  # (e.g. the vite dev server under `npm run dev`) can be cleaned up too.
  local descendants
  descendants=$(collect_descendants "${pid}")

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

  # Clean up any surviving descendants
  local d
  for d in ${descendants}; do
    if kill -0 "${d}" 2>/dev/null; then
      kill -9 "${d}" 2>/dev/null || true
    fi
  done
}

stop_process "${BACKEND_PID:-}" "backend"
stop_process "${FRONTEND_PID:-}" "frontend"

rm -f "${PID_FILE}"
echo "✅ ERBeauti stopped."
