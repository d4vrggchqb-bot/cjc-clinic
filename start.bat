@echo off
title CJC Clinic Server Launcher
echo ====================================================
echo         CJC CLINIC SYSTEM LAUNCHER
echo ====================================================
echo.
echo Select running mode:
echo   [1] Testing / Remote Cloudflare Mode (RECOMMENDED for multi-device testing)
echo       - Bundled production build (Ultra-fast, 1s load time over internet)
echo       - Multi-threaded backend (16 worker threads)
echo.
echo   [2] Developer Mode (For local coding only)
echo       - Live code reloading (Vite Dev Server)
echo       - Slower over remote tunnels due to unbundled files
echo.
set /p mode="Enter choice [1 or 2] (Default is 1): "

if "%mode%"=="" set mode=1

echo.
echo Starting CJC Multi-threaded Backend Server (16 workers)...
start "CJC Clinic Backend" cmd /k "set PHP_CLI_SERVER_WORKERS=16&& c:\xampp\php\php.exe -S 0.0.0.0:8000 -t backend\public"

if "%mode%"=="2" (
    echo Starting Frontend Developer Server (Vite Dev)...
    cd frontend
    start "CJC Clinic Frontend (Dev)" cmd /k "npm run dev -- --host"
) else (
    echo Building & Starting Ultra-fast Testing Server (Vite Preview)...
    cd frontend
    call npm run build
    start "CJC Clinic Frontend (Fast Testing)" cmd /k "npx vite preview --host --port 5173"
)

echo.
echo ====================================================
echo System is running!
echo Local: http://localhost:5173
echo If using Cloudflare Tunnel:
echo Run: cloudflared tunnel --url http://localhost:5173
echo ====================================================
