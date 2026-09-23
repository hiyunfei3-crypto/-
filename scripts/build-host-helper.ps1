param(
  [string]$OutputRoot = (Join-Path $PSScriptRoot '..\outputs')
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$source = Join-Path $projectRoot 'tools\netease-helper'
$version = '2026.09.23.4'
$packageName = '主播播放助手-最新版-' + $version
$packageRoot = Join-Path $OutputRoot $packageName
$zipPath = Join-Path $OutputRoot ($packageName + '.zip')
$nodePath = (Get-Command node -ErrorAction Stop).Source
$nodeLicense = Join-Path (Split-Path $nodePath) 'LICENSE'
$playwright = Join-Path $projectRoot 'node_modules\playwright-core'

if (-not (Test-Path $playwright)) {
  throw '缺少 playwright-core，请先在项目中安装依赖。'
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
if (Test-Path $packageRoot) { Remove-Item -LiteralPath $packageRoot -Recurse -Force }
if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $packageRoot 'runtime') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $packageRoot 'node_modules') | Out-Null

$helperFiles = @(
  'server.mjs', 'play-routing.mjs', 'netease-adapter.mjs', 'qq-adapter.mjs',
  'web-browser.mjs', 'web-playback.mjs', 'lyric-bridge.mjs',
  'playercap-process.mjs', 'pairing-store.mjs', '启动播放助手.cmd'
)
foreach ($file in $helperFiles) {
  Copy-Item -LiteralPath (Join-Path $source $file) -Destination $packageRoot
}

Copy-Item -LiteralPath $nodePath -Destination (Join-Path $packageRoot 'runtime\node.exe')
if (Test-Path $nodeLicense) { Copy-Item -LiteralPath $nodeLicense -Destination (Join-Path $packageRoot 'runtime\NODE-LICENSE.txt') }
Copy-Item -LiteralPath $playwright -Destination (Join-Path $packageRoot 'node_modules\playwright-core') -Recurse

$playerCapSource = Join-Path $source 'playercap'
if (Test-Path (Join-Path $playerCapSource 'Metabox-Nexus-PlayerCap.exe')) {
  Copy-Item -LiteralPath $playerCapSource -Destination (Join-Path $packageRoot 'playercap') -Recurse
} else {
  New-Item -ItemType Directory -Force -Path (Join-Path $packageRoot 'playercap') | Out-Null
  Copy-Item -LiteralPath (Join-Path $playerCapSource 'README.txt') -Destination (Join-Path $packageRoot 'playercap\README.txt') -ErrorAction SilentlyContinue
}

@'
# 主播播放助手

版本：2026.09.23.4

1. 解压整个压缩包，不要只打开压缩包内的文件。
2. Windows 自带 Microsoft Edge 即可，也支持 Google Chrome；助手优先使用系统默认的这两种浏览器。
3. 双击“启动播放助手.cmd”。
4. 在助手打开的专用浏览器窗口中分别登录网易云音乐和 QQ 音乐。
5. 首次使用时，把助手窗口显示的 12 位配对码填入主播控制台。以后在同一浏览器打开在线歌单会自动识别并连接。
6. 结束直播时在助手窗口按 Ctrl+C，等待音乐网页自动关闭，这样登录状态会被保存。

助手仅监听本机 127.0.0.1:43871，设备配对凭证保存在当前 Windows 用户的 AppData 中，登录资料保存在当前文件夹的 .music-browser-profile 中。不要把已经登录过的助手文件夹转交给其他人；需要分享时请重新使用未运行过的原始压缩包。
'@ | Set-Content -LiteralPath (Join-Path $packageRoot '使用说明.md') -Encoding UTF8

@'
主播播放助手 2026.09.23.4

包含：
- Microsoft Edge / Google Chrome 自动选择
- 网易云与 QQ 音乐自动切换
- 播放、暂停和继续
- 自动续播与手动切歌识别
- 本地实时歌词接口
- 首次配对后自动发现与重连

启动窗口没有显示 2026.09.23.4 时，说明打开的不是本包。
'@ | Set-Content -LiteralPath (Join-Path $packageRoot '版本说明.txt') -Encoding UTF8

Compress-Archive -LiteralPath $packageRoot -DestinationPath $zipPath -CompressionLevel Optimal
Write-Output $zipPath
