@echo off
setlocal
cd /d "%~dp0"

echo Cleaning up any leftover server process...
for %%p in (3001 5173) do (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
  )
)

echo.
echo Starting server. Your browser will open automatically in a few seconds.
echo (The server keeps running in the "credit-checker-server" window. Close that window to stop it.)
echo.

start "credit-checker-server" cmd /k "npm run dev"

timeout /t 4 /nobreak >nul
start "" http://localhost:5173

echo You can close this window now.
pause
