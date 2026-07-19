#!/bin/bash
# Hugessen Incentive Plan Design Platform — Quick Start
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "======================================================"
echo "  Hugessen Incentive Plan Design Platform"
echo "======================================================"
echo ""

# --- Backend ---
echo "→ Starting FastAPI backend on http://localhost:8000 ..."
cd "$ROOT/backend"
pip3 install -r requirements.txt -q 2>/dev/null || true
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

sleep 2

# --- Frontend ---
echo ""
echo "→ Starting Vite frontend on http://localhost:5173 ..."
cd "$ROOT/frontend"
npm install -q 2>/dev/null || true
npm run dev &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

echo ""
echo "======================================================"
echo "  App running at: http://localhost:5173"
echo "  API docs at:    http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo "======================================================"
echo ""

# Wait and clean up on Ctrl+C
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
