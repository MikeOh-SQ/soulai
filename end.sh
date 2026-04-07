#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$ROOT_DIR/.server.pid"
PORT="${PORT:-3333}"

terminate_pid() {
  local pid="$1"

  if ! kill -0 "$pid" 2>/dev/null; then
    return 1
  fi

  kill "$pid" 2>/dev/null || true

  for _ in {1..10}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    sleep 0.2
  done

  kill -9 "$pid" 2>/dev/null || true

  for _ in {1..10}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    sleep 0.1
  done

  return 1
}

find_port_pids() {
  ss -ltnp 2>/dev/null | awk -v port=":${PORT}" '
    index($4, port) {
      while (match($0, /pid=[0-9]+/)) {
        pid = substr($0, RSTART + 4, RLENGTH - 4);
        print pid;
        $0 = substr($0, RSTART + RLENGTH);
      }
    }
  ' | sort -u
}

if [[ ! -f "$PID_FILE" ]]; then
  echo "No PID file found. Checking port $PORT instead."
else
  SERVER_PID="$(cat "$PID_FILE")"

  if terminate_pid "$SERVER_PID"; then
    rm -f "$PID_FILE"
    echo "Stopped server PID $SERVER_PID"
    exit 0
  fi

  rm -f "$PID_FILE"
  echo "PID $SERVER_PID was not running or could not be stopped via PID file."
fi

PORT_PIDS="$(find_port_pids)"

if [[ -z "$PORT_PIDS" ]]; then
  echo "No listening process found on port $PORT."
  exit 0
fi

STOPPED_PIDS=()

while IFS= read -r pid; do
  [[ -z "$pid" ]] && continue
  if terminate_pid "$pid"; then
    STOPPED_PIDS+=("$pid")
  fi
done <<< "$PORT_PIDS"

if [[ ${#STOPPED_PIDS[@]} -gt 0 ]]; then
  echo "Stopped port $PORT process(es): ${STOPPED_PIDS[*]}"
  exit 0
fi

echo "Failed to stop process(es) on port $PORT: $PORT_PIDS"
exit 1
