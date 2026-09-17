@echo off
cd /d "%~dp0"
title Netease Play Helper
where node >nul 2>nul
if errorlevel 1 goto no_node
node server.mjs
echo.
echo Helper stopped or failed. Press any key to close.
pause >nul
exit /b
:no_node
echo Node.js was not found. Please install Node.js or add it to PATH.
pause >nul
