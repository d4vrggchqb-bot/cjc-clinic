@echo off
title CJC Clinic Fast Testing Mode (Cloudflare Ready)
echo ====================================================
echo    CJC CLINIC - ULTRA-FAST TESTING / CLOUDFLARE MODE
echo ====================================================
echo.
echo 1. Starting multi-threaded PHP backend (16 workers)...
start "CJC Clinic Backend" cmd /k "set PHP_CLI_SERVER_WORKERS=16&& c:\xampp\php\php.exe -S 0.0.0.0:8000 -t backend\public"

echo 2. Ensuring latest production build...
cd frontend
call npm run build

echo 3. Starting high-performance frontend server on port 5173...
start "CJC Clinic Frontend (Testing)" cmd /k "npx vite preview --host --port 5173"

echo.
echo ====================================================
echo CJC Clinic is READY for Testing!
echo Access locally: http://localhost:5173
echo.
echo To share via Cloudflare Tunnel, run:
echo   cloudflared tunnel --url http://localhost:5173
echo ====================================================
pause
