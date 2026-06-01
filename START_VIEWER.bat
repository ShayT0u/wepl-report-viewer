@echo off
REM Double-click this file to run the WEPL Report Viewer desktop app.

cd /d "%~dp0"

echo ============================================
echo   WEPL Report Viewer
echo ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed.
    echo Install from https://nodejs.org/
    pause
    exit /b 1
)

if not exist node_modules (
    echo First-time setup: installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed.
        pause
        exit /b 1
    )
)

call npm start
pause
