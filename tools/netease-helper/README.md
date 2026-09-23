# 双音乐网页播放助手（本地测试版）

在主播 Windows 电脑双击 `tools/netease-helper/启动播放助手.cmd`。也可以从项目根目录运行：

```powershell
node tools/netease-helper/server.mjs
```

交给其他主播使用时，运行 `pwsh -NoProfile -File scripts/build-host-helper.ps1` 生成带版本号的 `outputs/主播播放助手-最新版-*.zip`。便携包自带 Node.js 运行环境，主播解压后直接双击启动脚本即可；Windows 自带 Edge 即可。生成包不会包含音乐网站登录资料、设备凭证、配对码或运行日志。

助手会优先使用 Windows 当前默认的 Microsoft Edge 或 Google Chrome；默认浏览器不支持自动控制时使用系统自带 Edge。它会打开独立的音乐浏览器窗口，分别进入网易云音乐与 QQ 音乐。请在**助手打开的窗口**手动登录两个账号；普通浏览器或 Codex 内的网页标签不会共享登录。保持音乐浏览器和显示配对码的助手终端运行。结束时在助手终端按 `Ctrl+C`，让浏览器正常关闭并保存会话。登录资料保存在 `tools/netease-helper/.music-browser-profile/`；首次配对生成的设备凭证保存在当前 Windows 用户的 `%LOCALAPPDATA%\SonglistMusicHelper\paired-devices.json`，同一浏览器后续自动重连。助手只监听本机 `127.0.0.1:43871`。本地预览与在线网站各需配对一次。

连接后，主播后台会生成“点歌队列”“纯歌词”和“歌词＋队列”三个直播地址。歌词只在主播电脑本地读取，不上传到云端。若要使用 PlayerCap，将官方 `Metabox-Nexus-PlayerCap.exe` 和 `LICENSE` 放入 `tools/netease-helper/playercap/`；助手会限制其监听 `127.0.0.1:8765` 并随助手启停。没有 PlayerCap 时会自动尝试从助手控制的音乐网页读取歌词，失败只会隐藏歌词，不影响点歌和播放。

可用以下命令先做本机试播：

```powershell
node tools/netease-helper/test-play.mjs <配对码> "歌曲名" "可选歌手"
```

助手先尝试网易云网页，再尝试 QQ 音乐网页。提供歌手时，先按歌名和歌手找两站的版本，均明确不可播后再找同名翻唱。只有网页音频元素确实开始推进，助手才报告成功；若网页没有暴露可验证的播放状态，会返回“状态不明”，后台暂停自动续播，由主播核对，避免两站同时出声。只有收到网页音频的 `ended` 事件，才会自动完成并继续下一首；不会按估计曲长切歌。

网页结构、登录方式及平台权限可能变化。上线前必须在主播电脑上分别验证网易云可播、网易云受限后 QQ 可播、两边都受限、同名不同歌手、播完续播、暂停及会员限制。若无法稳定读取网页音频状态，保留手动处理，不将该分支发布到正式直播环境。助手不会下载音频或绕过版权、会员限制。

远程队列和歌手字段的云端改动见 `integrations/unicloud/`。部署时需同步更新数据库 schema、云函数和网页；本地版本与现有线上接口不一定兼容。
