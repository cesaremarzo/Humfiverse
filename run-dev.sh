#!/usr/bin/env bash
# Runs the Humfiverse backend (server/) and the frontend (docs/) together for local dev.
set -euo pipefail
cd "$(dirname "$0")"

echo "Starting backend on http://localhost:3001 ..."
(cd server && node --experimental-sqlite server.js) &
BACKEND_PID=$!

echo "Starting frontend on http://localhost:8080 ..."
(cd docs && python3 -m http.server 8080) &
FRONTEND_PID=$!

trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null' EXIT INT TERM

sleep 1
open "http://localhost:8080/index.html" 2>/dev/null || true

wait
