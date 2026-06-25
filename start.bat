@echo off
echo.
echo ╔══════════════════════════════════════════════════╗
echo ║   Nepal Property Valuation App — Localhost       ║
echo ╚══════════════════════════════════════════════════╝
echo.

:: Check .env exists
if not exist "backend\.env" (
  echo WARNING: backend\.env not found.
  echo Copying backend\.env.example to backend\.env
  echo Please edit backend\.env before running again.
  copy "backend\.env.example" "backend\.env"
  pause
  exit /b 1
)

:: Install backend deps if needed
if not exist "backend\node_modules" (
  echo Installing backend dependencies...
  cd backend
  npm install
  cd ..
)

:: Install frontend deps if needed
if not exist "frontend\node_modules" (
  echo Installing frontend dependencies...
  cd frontend
  npm install
  cd ..
)

echo.
echo Starting backend  on http://localhost:3001
echo Starting frontend on http://localhost:3000
echo.
echo Press Ctrl+C in each window to stop.
echo.

start "Valuation Backend"  cmd /k "cd backend && npm run dev"
start "Valuation Frontend" cmd /k "cd frontend && npm start"
