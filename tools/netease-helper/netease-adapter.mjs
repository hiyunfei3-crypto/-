import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(new URL('./play.ps1',import.meta.url));
export class PlaybackAttemptError extends Error{
 constructor(message,outcome='unknown'){super(message);this.outcome=outcome}
}
const normalize=value=>String(value||'').normalize('NFKC').trim().toLocaleLowerCase();

async function findSong(title,artist,cover){
 for(let offset=0;offset<1000;offset+=100){
  const url=new URL('https://music.163.com/api/search/get');
  url.search=new URLSearchParams({s:artist&&!cover?`${title} ${artist}`:title,type:'1',limit:'100',offset:String(offset)}).toString();
  let response;
  try{response=await fetch(url,{signal:AbortSignal.timeout(12000)})}catch{throw new PlaybackAttemptError('网易云搜索暂时不可用','unknown')}
  if(!response.ok)throw new PlaybackAttemptError('网易云搜索暂时不可用','unknown');
  const data=await response.json().catch(()=>null);
  if(data?.code!==200||!Array.isArray(data.result?.songs))throw new PlaybackAttemptError('网易云搜索结果无效','unknown');
  const matches=data.result.songs.filter(item=>normalize(item.name)===normalize(title)&&Number.isSafeInteger(item.id));
  const song=matches.find(item=>artist?cover?!((item.artists||[]).some(a=>normalize(a.name)===normalize(artist))):(item.artists||[]).some(a=>normalize(a.name)===normalize(artist)):true);
  if(song)return {...song,ambiguous:!artist&&matches.length>1};
  if(!data.result.hasMore)break;
 }
 throw new PlaybackAttemptError(`网易云未找到${cover?'同名翻唱':artist?'指定歌手的原唱':'完整歌名匹配'}「${title}」`,'unavailable');
}
function launch(song){return new Promise((resolve,reject)=>{
 execFile('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-SongId',String(song.id),'-Title',song.name],{windowsHide:true,timeout:18000,maxBuffer:1024*1024},(error,stdout,stderr)=>{
  if(error){reject(new PlaybackAttemptError((stderr||stdout||error.message).trim(),'unknown'));return}
  try{
   const result=JSON.parse(stdout.trim());
   if(!result.ok)throw new PlaybackAttemptError(result.error||'网易云未确认开始播放',result.outcome||'unknown');
   resolve({...result,player:'netease',artist:(song.artists||[]).map(item=>item.name).filter(Boolean).join(' / '),album:song.album?.name||'',durationMs:Number(song.duration||song.dt)||0,ambiguous:!!song.ambiguous});
  }catch(err){reject(err instanceof PlaybackAttemptError?err:new PlaybackAttemptError('网易云播放结果无效','unknown'))}
 });
})}
export async function playNetease(title,artist='',cover=false){return launch(await findSong(title,artist,cover))}
