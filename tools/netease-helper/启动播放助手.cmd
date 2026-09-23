@echo off
chcp 65001 >nul
set DEBUG=
set DEBUG_FILE=
cd /d "%~dp0"
title Songlist Music Helper 2026.09.23.4
echo ========================================
echo   Songlist Music Helper 2026.09.23.4
echo ========================================
echo.
if exist "%~dp0runtime\node.exe" goto bundled_node
where node >nul 2>nul
if errorlevel 1 goto no_node
echo Starting music helper...
echo Log in to Netease and QQ Music in the browser window opened by this helper.
echo Keep this window open and enter the pairing code in the host console.
echo Press Ctrl+C here to stop the helper safely.
echo.
node server.mjs
goto stopped
:bundled_node
echo Starting music helper...
echo Log in to Netease and QQ Music in the browser window opened by this helper.
echo Keep this window open and enter the pairing code in the host console.
echo Press Ctrl+C here to stop the helper safely.
echo.
"%~dp0runtime\node.exe" server.mjs
:stopped
echo.
echo Helper stopped or failed. Press any key to close.
pause >nul
exit /b
:no_node
echo Node.js was not found in PATH.
pause >nul
