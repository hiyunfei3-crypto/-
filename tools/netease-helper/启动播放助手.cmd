@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 点歌播放助手
where node >nul 2>nul
if errorlevel 1 goto no_node
echo 正在启动点歌播放助手，请稍候...
echo 启动后请在自动打开的 Chrome 窗口分别登录网易云音乐和 QQ 音乐。
echo 普通 Chrome 或 Codex 内的登录不会同步到助手窗口。
echo 请保持此窗口开启，并将下方配对码填入主播控制台。
echo.
node server.mjs
echo.
echo 助手已停止或启动失败。按任意键关闭窗口。
pause >nul
exit /b
:no_node
echo 未找到 Node.js，请先安装 Node.js 或将它加入 PATH。
pause >nul
