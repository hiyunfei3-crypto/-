import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {playAcrossPlayers} from './play-routing.mjs';
import {MusicBrowser} from './web-browser.mjs';
import {WebPlayback} from './web-playback.mjs';
import {LyricBridge} from './lyric-bridge.mjs';
import {startPlayerCap} from './playercap-process.mjs';
import {PairingStore} from './pairing-store.mjs';

const port=43871;
const helperVersion='2026.09.23.4';
const code=randomBytes(6).toString('hex');
const pairing=new PairingStore();
const overlayTokenFile=join(import.meta.dirname,'.overlay-read-token');
function loadOverlayToken(){
 try{
  if(existsSync(overlayTokenFile)){
   const saved=readFileSync(overlayTokenFile,'utf8').trim();
   if(/^[a-f0-9]{36}$/.test(saved))return saved;
  }
 }catch{}
 const created=randomBytes(18).toString('hex');
 try{writeFileSync(overlayTokenFile,created,{encoding:'utf8',mode:0o600})}catch{}
 return created;
}
const overlayToken=loadOverlayToken();
const allowedOrigins=new Set(['http://localhost:5180','http://127.0.0.1:5180','http://localhost:5181','http://127.0.0.1:5181','https://hiyunfei3-crypto.github.io',process.env.SONGLIST_SITE_ORIGIN].filter(Boolean));
const completed=new Map();
let running=false;
let activePlayback=null;
const musicBrowser=new MusicBrowser();
const playback=new WebPlayback(musicBrowser);
const lyrics=new LyricBridge(musicBrowser,playback);
let playerCap=null;
const runtimeFile=join(import.meta.dirname,'.helper-runtime.json');
let runtimeWritten=false;

function reply(res,status,value,origin=''){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',...(allowedOrigins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Private-Network':'true','Vary':'Origin'}:{})});
 res.end(JSON.stringify(value));
}
const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin||'';
 if(!allowedOrigins.has(origin)){reply(res,403,{error:'来源不受信任'});return}
 if(req.method==='OPTIONS'){
  res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Host-Code, X-Device-Token, X-Overlay-Token','Access-Control-Allow-Private-Network':'true','Vary':'Origin'});res.end();return;
 }
 if(req.method!=='POST'||!['/discover','/reconnect','/unpair','/play','/pause','/resume','/stop','/pair','/status','/diagnostics','/lyrics'].includes(req.url||'')){reply(res,404,{error:'未找到操作'},origin);return}
 if(req.url==='/discover'){reply(res,200,{ok:true,version:helperVersion,pairingSupported:true},origin);return}
 if(req.url==='/lyrics'){
  if(req.headers['x-overlay-token']!==overlayToken){reply(res,401,{error:'直播歌词令牌无效'},origin);return}
  try{reply(res,200,{ok:true,...await lyrics.snapshot()},origin)}catch(error){reply(res,503,{error:error.message||'歌词暂不可用'},origin)}
  return;
 }
 if(req.url==='/pair'){
  if(req.headers['x-host-code']!==code){reply(res,401,{error:'配对码错误'},origin);return}
  try{const deviceToken=pairing.issue(origin);reply(res,200,{ok:true,message:'本机播放助手已连接',deviceToken,overlayToken,version:helperVersion},origin)}
  catch{reply(res,500,{error:'无法在本机保存配对，请检查用户目录权限'},origin)}
  return;
 }
 const deviceToken=req.headers['x-device-token'];
 if(!pairing.valid(origin,deviceToken)){reply(res,401,{error:'设备凭证无效，请重新输入配对码'},origin);return}
 if(req.url==='/reconnect'){reply(res,200,{ok:true,version:helperVersion,overlayToken},origin);return}
 if(req.url==='/unpair'){
  try{pairing.revoke(origin,deviceToken);reply(res,200,{ok:true},origin)}
  catch{reply(res,500,{error:'无法取消配对，请检查用户目录权限'},origin)}
  return;
 }
 if(req.url==='/diagnostics'){reply(res,200,{ok:true,...playback.diagnostics(),lyrics:await lyrics.snapshot().catch(()=>null),neteaseControls:await playback.neteaseDiagnostics().catch(()=>null),qqPage:await playback.qqDiagnostics().catch(()=>null),tabs:await musicBrowser.state()},origin);return}
 if(req.url==='/status'){
  try{reply(res,200,{ok:true,requestId:activePlayback?.requestId||null,...await playback.status()},origin)}
  catch(error){reply(res,503,{error:error.message||'无法读取网页播放状态'},origin)}
  return;
 }
 if(req.url==='/pause'||req.url==='/resume'){
  try{const result=req.url==='/pause'?await playback.pause():await playback.resume();reply(res,200,{...result,requestId:activePlayback?.requestId||null},origin)}
  catch(error){reply(res,409,{error:error.message||'播放器控制失败'},origin)}
  return;
 }
 if(req.url==='/stop'){
  if(running){reply(res,409,{error:'播放器正在处理另一首歌曲，请稍后重试'},origin);return}
  running=true;
  try{const requestId=activePlayback?.requestId||null;await playback.stopAll();if(requestId)completed.delete(requestId);activePlayback=null;reply(res,200,{ok:true,requestId},origin)}
  catch(error){reply(res,409,{error:error.message||'无法确认上一首已停止'},origin)}
  finally{running=false}
  return;
 }
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048){reply(res,413,{error:'请求太大'},origin);return}}
 let body;try{body=JSON.parse(raw)}catch{reply(res,400,{error:'请求格式错误'},origin);return}
 const {requestId,title,artist=''}=body;
 if(typeof requestId!=='string'||!/^[a-f0-9-]{36}$/i.test(requestId)||typeof title!=='string'||!title.trim()||title.length>100||typeof artist!=='string'||artist.length>80){reply(res,400,{error:'歌曲、歌手或请求编号无效'},origin);return}
 if(completed.has(requestId)){reply(res,200,completed.get(requestId),origin);return}
 if(running){reply(res,409,{error:'另一首歌正在处理中'},origin);return}
 if(activePlayback){
  const state=await playback.status().catch(()=>({playing:true}));
  if(state.playing&&!state.ended){reply(res,409,{error:'上一首仍在播放，请先完成或停止播放',outcome:'unknown'},origin);return}
 }
 running=true;
 try{await playback.stopAll();if(activePlayback)completed.delete(activePlayback.requestId);activePlayback=null;const result=await playAcrossPlayers(title.trim(),artist.trim(),{netease:playback.netease.bind(playback),qq:playback.qq.bind(playback)});activePlayback={requestId,player:result.player,startedAt:Date.now(),durationMs:result.durationMs};completed.set(requestId,result);if(completed.size>200)completed.delete(completed.keys().next().value);reply(res,200,result,origin)}
 catch(err){reply(res,422,{error:err.message||'播放失败',outcome:err.outcome||'unknown'},origin)}finally{running=false}
});
server.on('error',async error=>{
 if(error.code==='EADDRINUSE')console.error('播放助手已经在运行。请使用原窗口显示的配对码；若找不到原窗口，先关闭旧助手再启动。');
 else console.error('播放助手启动失败：'+error.message);
 process.exitCode=1;
 await musicBrowser.close().catch(()=>{});
 await playerCap?.stop().catch(()=>{});
});
async function shutdown(){
 server.close();
 await musicBrowser.close().catch(()=>{});
 await playerCap?.stop().catch(()=>{});
 if(runtimeWritten)try{unlinkSync(runtimeFile)}catch{}
 process.exit();
}
process.once('SIGINT',shutdown);
process.once('SIGTERM',shutdown);
try{
 playerCap=await startPlayerCap();
 await musicBrowser.start();
 server.listen(port,'127.0.0.1',()=>{
  writeFileSync(runtimeFile,JSON.stringify({pid:process.pid,code,startedAt:Date.now()},null,2));
 runtimeWritten=true;
  console.log('主播播放助手版本：'+helperVersion);
  console.log('双网页播放器助手仅在本机运行：127.0.0.1:'+port);
  console.log('配对码：'+code);
  console.log(playerCap?.running?'歌词采集：PlayerCap 已启动；网页歌词回退已启用':'歌词采集：网页回退已启用（未找到 PlayerCap 也可继续使用）');
  console.log('音乐浏览器：'+musicBrowser.label());
  console.log('请在打开的浏览器中分别登录网易云与 QQ 音乐，并保持浏览器及助手窗口打开。');
 });
}catch(error){
 await playerCap?.stop().catch(()=>{});
 if(runtimeWritten)try{unlinkSync(runtimeFile)}catch{}
 const detail=String(error?.message||error);
 if(/ProcessSingleton|profile directory|Lock file/i.test(detail))console.error('音乐网页未能启动：上次助手打开的专用 Chrome 仍在运行。请关闭包含网易云和 QQ 音乐的那个 Chrome 窗口，再重新启动助手。');
 else console.error('音乐网页未能启动：'+detail);
 process.exitCode=1;
}
