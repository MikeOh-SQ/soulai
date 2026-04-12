#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$ROOT_DIR/.server.pid"
DEFAULT_PORT=3333
TARGET_PORT="${PORT:-}"

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
  local port="$1"

  ss -ltnp 2>/dev/null | awk -v port=":${port}" '
    index($4, port) {
      while (match($0, /pid=[0-9]+/)) {
        pid = substr($0, RSTART + 4, RLENGTH - 4);
        print pid;
        $0 = substr($0, RSTART + RLENGTH);
      }
    }
  ' | sort -u
}

find_repo_server_pids() {
  local pid
  local proc_cwd
  local proc_cmdline

  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    [[ -d "/proc/$pid" ]] || continue

    proc_cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
    [[ "$proc_cwd" == "$ROOT_DIR" ]] || continue

    proc_cmdline="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)"
    [[ "$proc_cmdline" == *"node server.js"* ]] || continue

    echo "$pid"
  done < <(
    ss -ltnp 2>/dev/null | awk '
      {
        while (match($0, /pid=[0-9]+/)) {
          pid = substr($0, RSTART + 4, RLENGTH - 4);
          print pid;
          $0 = substr($0, RSTART + RLENGTH);
        }
      }
    ' | sort -u
  )
}

if [[ ! -f "$PID_FILE" ]]; then
  echo "No PID file found. Checking for running server processes instead."
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

if [[ -n "$TARGET_PORT" ]]; then
  PORT_PIDS="$(find_port_pids "$TARGET_PORT")"

  if [[ -z "$PORT_PIDS" ]]; then
    echo "No listening process found on port $TARGET_PORT."
    exit 0
  fi
else
  PORT_PIDS="$(find_repo_server_pids)"

  if [[ -z "$PORT_PIDS" ]]; then
    PORT_PIDS="$(find_port_pids "$DEFAULT_PORT")"
  fi

  if [[ -z "$PORT_PIDS" ]]; then
    echo "No listening process found for this project."
    exit 0
  fi
fi

STOPPED_PIDS=()

while IFS= read -r pid; do
  [[ -z "$pid" ]] && continue
  if terminate_pid "$pid"; then
    STOPPED_PIDS+=("$pid")
  fi
done <<< "$PORT_PIDS"

if [[ ${#STOPPED_PIDS[@]} -gt 0 ]]; then
  if [[ -n "$TARGET_PORT" ]]; then
    echo "Stopped port $TARGET_PORT process(es): ${STOPPED_PIDS[*]}"
  else
    echo "Stopped project server process(es): ${STOPPED_PIDS[*]}"
  fi
  exit 0
fi

if [[ -n "$TARGET_PORT" ]]; then
  echo "Failed to stop process(es) on port $TARGET_PORT: $PORT_PIDS"
else
  echo "Failed to stop project server process(es): $PORT_PIDS"
fi
exit 1
