@echo off
setlocal
cd /d "%~dp0"

echo Starting dev servers (auto-reload on save)...
echo   API server : http://127.0.0.1:3000  (restarts when server code changes)
echo   Web UI     : http://127.0.0.1:5173  (hot reload when web code changes)
echo Close both windows to stop.

start "Wiktionary API (watch)" /d "%~dp0server" cmd /k npm run dev
start "Wiktionary Web (vite)" /d "%~dp0web" cmd /k npm run dev

timeout /t 4 /nobreak >nul
start "" "http://127.0.0.1:5173"
