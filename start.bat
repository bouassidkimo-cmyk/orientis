@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed or not on PATH.
  echo   Install it from https://nodejs.org  then double-click this file again.
  echo.
  pause
  exit /b 1
)
node serve.mjs
pause
