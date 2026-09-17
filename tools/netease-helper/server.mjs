import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {playAcrossPlayers} from './play-routing.mjs';

const port=43871;
const code=randomBytes(6).toString('hex');
const allowedOrigins=new Set(['http://localhost:5180','http://127.0.0.1:5180','http://localhost:5181','http://127.0.0.1:5181','https://hiyunfei3-crypto.github.io',process.env.SONGLIST_SITE_ORIGIN].filter(Boolean));
const completed=new Map();
let running=false;
let activePlayback=null;

function reply(res,status,value,origin=''){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',...(allowedOrigins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Private-Network':'true','Vary':'Origin'}:{})});
 res.end(JSON.stringify(value));
}
const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin||'';
 if(!allowedOrigins.has(origin)){reply(res,403,{error:'来源不受信任'});return}
 if(req.method==='OPTIONS'){
  res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Host-Code','Access-Control-Allow-Private-Network':'true','Vary':'Origin'});res.end();return;
 }
 if(req.method!=='POST'||!['/play','/pair','/status'].includes(req.url||'')){reply(res,404,{error:'未找到操作'},origin);return}
 if(req.headers['x-host-code']!==code){reply(res,401,{error:'配对码错误'},origin);return}
 if(req.url==='/pair'){reply(res,200,{ok:true,message:'本机播放助手已连接'},origin);return}
 if(req.url==='/status'){
  const elapsedMs=activePlayback?Date.now()-activePlayback.startedAt:0;
  // Catalog duration is an estimate, not evidence that the desktop client finished playback.
  reply(res,200,{ok:true,requestId:activePlayback?.requestId||null,ended:false,remainingMs:activePlayback?.durationMs?Math.max(0,activePlayback.durationMs-elapsedMs):null,estimated:true},origin);return;
 }
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048){reply(res,413,{error:'请求太大'},origin);return}}
 let body;try{body=JSON.parse(raw)}catch{reply(res,400,{error:'请求格式错误'},origin);return}
 const {requestId,title,artist=''}=body;
 if(typeof requestId!=='string'||!/^[a-f0-9-]{36}$/i.test(requestId)||typeof title!=='string'||!title.trim()||title.length>100||typeof artist!=='string'||artist.length>80){reply(res,400,{error:'歌曲、歌手或请求编号无效'},origin);return}
 if(completed.has(requestId)){reply(res,200,completed.get(requestId),origin);return}
 if(running){reply(res,409,{error:'另一首歌正在处理中'},origin);return}
 running=true;
 try{const result=await playAcrossPlayers(title.trim(),artist.trim());activePlayback={requestId,player:result.player,startedAt:Date.now(),durationMs:result.durationMs};completed.set(requestId,result);if(completed.size>200)completed.delete(completed.keys().next().value);reply(res,200,result,origin)}
 catch(err){reply(res,422,{error:err.message||'播放失败',outcome:err.outcome||'unknown'},origin)}finally{running=false}
});
server.on('error',error=>{
 if(error.code==='EADDRINUSE')console.error('播放助手已经在运行。请使用原窗口显示的配对码；若找不到原窗口，先关闭旧助手再启动。');
 else console.error('播放助手启动失败：'+error.message);
 process.exitCode=1;
});
server.listen(port,'127.0.0.1',()=>{
 console.log('双播放器助手仅在本机运行：127.0.0.1:'+port);
 console.log('配对码：'+code);
 console.log('保持此窗口打开，主播后台点击播放时会自动搜索网易云音乐。');
});
