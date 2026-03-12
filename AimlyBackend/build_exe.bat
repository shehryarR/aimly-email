@echo off
echo ======================================================
echo AI Email Outreach Pro - Windows EXE Builder
echo ======================================================
@REM Before running the build script, you must prepare the environment:

@REM     Frontend Build: In your React project folder, run npm run build. This generates the dist folder.

@REM     Folder Structure: Copy that dist folder into your backend directory (where main.py or outreach_agent/main.py is located) so the pathing matches.

@REM     Virtual Environment: It is highly recommended to use a virtual environment to keep the EXE size small.

:: 1. Install Dependencies
echo [*] Installing requirements...
pip install -r requirements.txt
pip install pyinstaller

:: 2. Clean previous builds
echo [*] Cleaning old build folders...
if exist build rmdir /s /q build
if exist dist/*.exe del /q dist/*.exe

:: 3. Run PyInstaller
echo [*] Starting PyInstaller...
python -m PyInstaller --name="EmailOutreachPro" ^
 --onefile ^
 --console ^
 --add-data "dist;dist" ^
 --add-data "env.json;." ^
 --add-data=".env:." ^
 --paths=. ^
 --hidden-import=uvicorn.logging ^
 --hidden-import=uvicorn.loops ^
 --hidden-import=uvicorn.loops.auto ^
 --hidden-import=uvicorn.protocols ^
 --hidden-import=uvicorn.protocols.http ^
 --hidden-import=uvicorn.protocols.http.auto ^
 --hidden-import=uvicorn.lifespan ^
 --hidden-import=uvicorn.lifespan.on ^
 --collect-all fastapi ^
 --collect-all email_validator ^
 outreach_agent/main_demo.py

echo ======================================================
echo DONE! Your EXE is in the 'dist' folder.
echo ======================================================
pause