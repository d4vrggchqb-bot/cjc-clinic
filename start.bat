@echo off
echo Starting CJC Clinic Backend Server...
start cmd /k "c:\xampp\php\php.exe -S localhost:8000 -t backend\public"

echo Starting CJC Clinic Frontend Server...
cd frontend
start cmd /k "npm run dev"
