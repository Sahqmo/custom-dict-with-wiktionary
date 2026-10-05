@echo off
setlocal
cd /d "%~dp0"

echo [1/3] Building web UI...
pushd web
call npm run build
if errorlevel 1 (
  echo Build failed.
  popd
  pause
  exit /b 1
)
popd

echo [2/3] Opening browser...
start "" "http://127.0.0.1:3000"

echo [3/3] Starting server on http://127.0.0.1:3000  (Ctrl+C to stop)
cd server
call npm start
pause
