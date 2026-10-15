@echo off
rem Double-click this file to start the AI Fortune Receipt server.
title AI Fortune Receipt
if not exist "%~dp0app\start.ps1" (
  echo.
  echo [!] Program files not found.
  echo     Please right-click the zip file and choose "Extract All", then run this file again from the extracted folder.
  echo.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0app\start.ps1"
if errorlevel 1 pause
