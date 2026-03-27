@echo off
REM ScrapeDash Setup Script for Windows
REM This script installs all dependencies and sets up the environment

echo.
echo ========================================
echo   ScrapeDash - Setup & Installation
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python from https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [1/3] Installing Python packages...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install packages
    pause
    exit /b 1
)

echo.
echo [2/3] Installing Playwright browser...
python -m playwright install chromium
if errorlevel 1 (
    echo ERROR: Failed to install Playwright browser
    echo Try running manually: python -m playwright install chromium
    pause
    exit /b 1
)

echo.
echo [3/3] Verifying installation...
python -c "import flask, requests, bs4, pandas, playwright; print('✓ All packages installed successfully')"
if errorlevel 1 (
    echo ERROR: Verification failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo   ✅ Setup Complete!
echo ========================================
echo.
echo To run the Flask server:
echo   python app.py
echo.
echo To test the scraper directly:
echo   python scraper.py
echo.
echo To open the web interface:
echo   Start Flask server and open index.html in your browser
echo.
pause
