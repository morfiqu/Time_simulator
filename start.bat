@echo off
cd /d "%~dp0"
echo Starting Time Simulator Web Server...
python server.py
if %ERRORLEVEL% NEQ 0 (
    echo Python not found in PATH, trying common locations...
    "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" server.py
)
pause
