#!/usr/bin/env bash
# Runs the Humfiverse backend (server/) and the Angular frontend (webapp/)
# together for local dev. Uses `ng serve` rather than serving the committed
# docs/ build: docs/ is baked with base href "/Humfiverse/" and the
# production API URL for GitHub Pages, so serving it locally would 404 on
# every asset and hit the live Render backend instead of your local one.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d server/node_modules ]; then
  echo "Installing backend dependencies ..."
  (cd server && npm install)
fi
if [ ! -d webapp/node_modules ]; then
  echo "Installing frontend dependencies (this can take a minute) ..."
  (cd webapp && npm install)
fi

echo "Starting backend on http://localhost:3001 ..."
(cd server && node server.js) &
BACKEND_PID=$!

echo "Starting frontend on http://localhost:4200 ..."
(cd webapp && npx ng serve --open) &
FRONTEND_PID=$!

trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null' EXIT INT TERM

wait
