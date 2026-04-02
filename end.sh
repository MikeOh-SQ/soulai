#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$ROOT_DIR/.server.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "No PID file found. Server may already be stopped."
  exit 0
fi

SERVER_PID="$(cat "$PID_FILE")"

if kill -0 "$SERVER_PID" 2>/dev/null; then
  kill "$SERVER_PID"
  rm -f "$PID_FILE"
  echo "Stopped server PID $SERVER_PID"
else
  rm -f "$PID_FILE"
  echo "PID $SERVER_PID is not running. Removed stale PID file."
fi
