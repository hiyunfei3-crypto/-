param(
 [Parameter(Mandatory=$true)][ValidatePattern('^[0-9]+$')][string]$SongId,
 [Parameter(Mandatory=$true)][string]$Title
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
function Fail([string]$reason) { @{ok=$false;error=$reason}|ConvertTo-Json -Compress; exit 0 }
try {
 $player = Get-Process cloudmusic -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1
 if (!$player) { Fail '请先打开并登录网易云音乐 Windows 客户端' }
 $command = (Get-Item 'Registry::HKEY_CLASSES_ROOT\orpheus\shell\open\command').GetValue('')
 if ($command -notmatch '^"([^"]+cloudmusic\.exe)"') { Fail '找不到网易云音乐客户端播放协议' }
 $exe = $Matches[1]
 if (!(Test-Path -LiteralPath $exe)) { Fail '网易云音乐客户端路径不存在' }
 $payload = @{type='song';id=$SongId;cmd='play'} | ConvertTo-Json -Compress
 $uri = 'orpheus://' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($payload))
 & $exe "--webcmd=$uri"
 $confirmed = $false
 for ($i=0; $i -lt 16; $i++) {
  Start-Sleep -Milliseconds 350
  $player.Refresh()
  if ($player.MainWindowTitle.StartsWith(($Title + ' - '), [StringComparison]::Ordinal)) { $confirmed = $true; break }
 }
 if (!$confirmed) { Fail ('客户端未切到指定歌曲；当前窗口：' + $player.MainWindowTitle) }
 @{ok=$true;matchedTitle=$Title;songId=$SongId;verification='client-window-title'} | ConvertTo-Json -Compress
} catch {
 Fail ('网易云音乐操作失败：' + $_.Exception.Message)
}
