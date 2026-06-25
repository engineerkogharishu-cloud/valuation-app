#!/usr/bin/env bash
# ── Nepal Valuation App — one-command local start ────────────
set -e

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   Nepal Property Valuation App — Localhost       ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Check .env exists
if [ ! -f "backend/.env" ]; then
  echo "⚠  backend/.env not found."
  echo "   Copy backend/.env.example to backend/.env and fill in the values."
  echo ""
  cp backend/.env.example backend/.env
  echo "   Created backend/.env from example — please edit it before continuing."
  exit 1
fi

# Install dependencies if node_modules missing
if [ ! -d "backend/node_modules" ]; then
  echo "📦  Installing backend dependencies…"
  (cd backend && npm install)
fi

if [ ! -d "frontend/node_modules" ]; then
  echo "📦  Installing frontend dependencies…"
  (cd frontend && npm install)
fi

echo ""
echo "🚀  Backend  → http://localhost:3001"
echo "🌐  Frontend → http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers."
echo ""

# Start backend in background
(cd backend && npm run dev) &
BACKEND_PID=$!

# Start frontend
(cd frontend && npm start) &
FRONTEND_PID=$!

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'; exit" INT TERM
wait
