@echo off
:: ===================================================================
:: FaceVoxAI v2 — Local Development Startup Script (Windows)
:: Starts all 3 services in separate windows:
::   1. Python AI Service (port 8000)
::   2. Node.js Backend  (port 4000)
::   3. React Frontend   (port 5173)
:: ===================================================================

echo.
echo ============================================================
echo   FaceVoxAI v2 Production — Local Development Startup
echo ============================================================
echo.

SET ROOT=%~dp0

:: ── 1. AI Service ─────────────────────────────────────────────
echo [1/3] Starting Python AI Service on port 8000...
start "FaceVoxAI AI Service" cmd /k "cd /d %ROOT%ai-service && pip install -r requirements.txt --quiet && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: Wait 2 seconds
timeout /t 2 /nobreak > nul

:: ── 2. Node.js Backend ────────────────────────────────────────
echo [2/3] Starting Node.js Backend on port 4000...
start "FaceVoxAI Backend" cmd /k "cd /d %ROOT%backend && npm install --silent && npm run dev"

:: Wait 2 seconds
timeout /t 2 /nobreak > nul

:: ── 3. React Frontend ────────────────────────────────────────
echo [3/3] Starting React Frontend on port 5173...
start "FaceVoxAI Frontend" cmd /k "cd /d %ROOT%frontend && npm install --silent && npm run dev"

echo.
echo ============================================================
echo   All services starting! Access:
echo     Frontend  →  http://localhost:5173
echo     Backend   →  http://localhost:4000/api/health
echo     AI Docs   →  http://localhost:8000/docs
echo ============================================================
echo.
echo Press any key to run integration tests (backend must be up)...
pause > nul

timeout /t 5 /nobreak > nul

echo.
echo Running backend tests...
node %ROOT%backend\tests\backend.test.js

echo.
echo Running AI service tests...
python %ROOT%ai-service\tests\test_ai_service.py

echo.
echo Done! Press any key to exit.
pause > nul
