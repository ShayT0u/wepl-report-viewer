@echo off
REM Double-click this file to run the WEPL Report Viewer.
REM Keep this window open while using the app.

cd /d "%~dp0"

echo ============================================
echo   WEPL Report Viewer
echo ============================================
echo.

if not exist config.txt (
    if exist config.example.txt (
        copy /Y config.example.txt config.txt >nul
        echo Created config.txt from config.example.txt
        echo Please edit config.txt with your WEPL output folder path, then run again.
        notepad config.txt
        pause
        exit /b 1
    )
    echo ERROR: config.txt is missing.
    echo Create config.txt with one line: your WEPL output folder path.
    pause
    exit /b 1
)

python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed.
    echo Install from https://www.python.org/downloads/
    echo During install, check "Add python.exe to PATH".
    pause
    exit /b 1
)

if not exist .venv (
    echo First-time setup on this computer...
    echo Creating Python environment...
    python -m venv .venv
    if errorlevel 1 (
        echo ERROR: Could not create .venv
        pause
        exit /b 1
    )
)

call .venv\Scripts\activate.bat
pip install -q -r requirements.txt

echo.
echo Reports folder (from config.txt):
type config.txt
echo.
echo Opening browser: http://localhost:5000
echo.
echo KEEP THIS WINDOW OPEN while using the viewer.
echo To stop: close this window or press Ctrl+C
echo.

start http://localhost:5000
python app.py
pause
