#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$ROOT_DIR/.server.pid"
LOG_FILE="$ROOT_DIR/server.log"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-3333}"

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(cat "$PID_FILE")"
  if kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "Server already running with PID $EXISTING_PID"
    echo "Open: http://$(hostname -I | awk '{print $1}'):$PORT"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

cd "$ROOT_DIR"
HOST="$HOST" PORT="$PORT" npm start >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" >"$PID_FILE"

sleep 1

if kill -0 "$SERVER_PID" 2>/dev/null; then
  IP_ADDRESS="$(hostname -I | awk '{print $1}')"
  echo "Server started"
  echo "PID: $SERVER_PID"
  echo "Host: $HOST"
  echo "Port: $PORT"
  echo "Local: http://127.0.0.1:$PORT"
  if [[ -n "${IP_ADDRESS:-}" ]]; then
    echo "Network: http://$IP_ADDRESS:$PORT"
  fi
  echo "Log: $LOG_FILE"
else
  echo "Failed to start server. Check $LOG_FILE"
  rm -f "$PID_FILE"
  exit 1
fi
