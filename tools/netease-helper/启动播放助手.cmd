@echo off
cd /d "%~dp0"
title Songlist Music Helper
where node >nul 2>nul
if errorlevel 1 goto no_node
echo Starting music helper...
echo Log in to Netease and QQ Music in the Chrome window opened by this helper.
echo Keep this window open and enter the pairing code in the host console.
echo Press Ctrl+C here to stop the helper safely.
echo.
node server.mjs
echo.
echo Helper stopped or failed. Press any key to close.
pause >nul
exit /b
:no_node
echo Node.js was not found in PATH.
pause >nul
