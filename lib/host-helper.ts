const endpoint='http://127.0.0.1:43871';
export const deviceTokenKey='songlist-helper-device-v1';

export class HelperConnectionError extends Error{
 constructor(message:string,public readonly reason:'offline'|'outdated'|'unpaired'){super(message);this.name='HelperConnectionError'}
}

export async function discoverHost(){
 let response:Response;
 try{response=await fetch(endpoint+'/discover',{method:'POST',signal:AbortSignal.timeout(3000)})}
 catch{throw new HelperConnectionError('播放助手未运行，请先双击启动播放助手','offline')}
 if(!response.ok)throw new HelperConnectionError('播放助手版本过旧，请安装最新版本','outdated');
 const data=await response.json().catch(()=>null) as {ok?:boolean;version?:string;pairingSupported?:boolean}|null;
 if(!data?.ok||!data.pairingSupported)throw new HelperConnectionError('播放助手版本过旧，请安装最新版本','outdated');
 return data.version||'未知版本';
}

export async function reconnectHost(deviceToken:string){
 if(!deviceToken)throw new HelperConnectionError('首次使用请在下方输入配对码','unpaired');
 let response:Response;
 try{response=await fetch(endpoint+'/reconnect',{method:'POST',headers:{'X-Device-Token':deviceToken},signal:AbortSignal.timeout(5000)})}
 catch{throw new HelperConnectionError('播放助手已断开，等待重新启动','offline')}
 if(response.status===401)throw new HelperConnectionError('配对已失效，请重新输入助手窗口的配对码','unpaired');
 const data=await response.json().catch(()=>null) as {ok?:boolean;error?:string;overlayToken?:string;version?:string}|null;
 if(!response.ok||!data?.ok||!data.overlayToken)throw new HelperConnectionError(data?.error||'播放助手版本过旧，请更新后重新配对','outdated');
 return {overlayToken:data.overlayToken,version:data.version||'未知版本'};
}

export async function unpairHost(deviceToken:string){
 const response=await fetch(endpoint+'/unpair',{method:'POST',headers:{'X-Device-Token':deviceToken},signal:AbortSignal.timeout(5000)});
 const data=await response.json().catch(()=>null) as {ok?:boolean;error?:string}|null;
 if(!response.ok||!data?.ok)throw Error(data?.error||'取消配对失败，请稍后重试');
}

export class PlaybackFailure extends Error{
 constructor(message:string,public readonly outcome:'unavailable'|'unknown'){super(message);this.name='PlaybackFailure'}
}

export async function pairWithHost(code:string){
 if(!code.trim())throw Error('请先输入助手窗口显示的配对码');
 await discoverHost();
 let response:Response;
 try{
  response=await fetch(endpoint+'/pair',{method:'POST',headers:{'X-Host-Code':code.trim()},signal:AbortSignal.timeout(5000)});
 }catch{throw Error('无法连接本机播放助手，请确认助手窗口保持打开')}
 const data=await response.json().catch(()=>({error:'本机助手返回内容无效'})) as {ok?:boolean;error?:string;overlayToken?:string;deviceToken?:string;version?:string};
 if(!response.ok||!data.ok)throw Error(data.error||'助手配对失败');
 if(!data.overlayToken||!data.deviceToken)throw Error('助手版本过旧，请安装最新的播放助手');
 return {overlayToken:data.overlayToken,deviceToken:data.deviceToken,version:data.version||'未知版本'};
}

export type LyricSnapshot={available:boolean;source:'playercap'|'web'|'none';player:string;title:string;artist:string;currentLine:string;nextLine:string;words:{text:string;startMs:number;durationMs:number}[];positionMs:number|null;playing:boolean;updatedAt:number};

export async function hostLyrics(token:string){
 if(!token)return null;
 const response=await fetch(endpoint+'/lyrics',{method:'POST',headers:{'X-Overlay-Token':token},signal:AbortSignal.timeout(2500)});
 const data=await response.json().catch(()=>({error:'歌词数据无效'})) as Partial<LyricSnapshot>&{ok?:boolean;error?:string};
 if(!response.ok||!data.ok)throw Error(data.error||'歌词暂不可用');
 return data as LyricSnapshot&{ok:true};
}

export async function playOnHost(requestId:string,title:string,deviceToken:string,artist=''){
 if(!deviceToken.trim())throw Error('请先连接本机播放助手');
 let response:Response;
 try{
  response=await fetch(endpoint+'/play',{method:'POST',headers:{'Content-Type':'application/json','X-Device-Token':deviceToken.trim()},body:JSON.stringify({requestId,title,artist}),signal:AbortSignal.timeout(90000)});
 }catch(error){throw new PlaybackFailure(error instanceof DOMException&&error.name==='TimeoutError'?'播放器搜索或切歌超时，请确认是否已经出声':'无法连接本机播放助手，请确认它已在主播电脑运行','unknown')}
 const data=await response.json().catch(()=>({error:'本机助手返回内容无效'})) as {ok?:boolean;error?:string;outcome?:'unavailable'|'unknown';matchedTitle?:string;artist?:string;album?:string;player?:'netease'|'qqmusic';durationMs?:number;ambiguous?:boolean};
 if(!response.ok||!data.ok)throw new PlaybackFailure(data.error||'音乐软件未能确认开始播放',data.outcome||'unknown');
 return data as {ok:true;matchedTitle:string;artist:string;album:string;player:'netease'|'qqmusic';durationMs:number;ambiguous?:boolean};
}

export async function hostPlaybackStatus(deviceToken:string){
 const response=await fetch(endpoint+'/status',{method:'POST',headers:{'X-Device-Token':deviceToken.trim()},signal:AbortSignal.timeout(5000)});
 const data=await response.json() as {ok?:boolean;error?:string;requestId?:string|null;ended?:boolean;playing?:boolean;interrupted?:boolean;estimated?:boolean;remainingMs?:number|null};
 if(!response.ok||!data.ok)throw Error(data.error||'无法读取本机助手播放状态');
 return data;
}

export async function stopHostPlayback(deviceToken:string){
 if(!deviceToken.trim())throw Error('请先连接本机播放助手');
 const response=await fetch(endpoint+'/stop',{method:'POST',headers:{'X-Device-Token':deviceToken.trim()},signal:AbortSignal.timeout(10000)});
 if(response.status===404)throw Error('播放助手版本过旧，请更新到 2026.09.23.4 后再切歌');
 const data=await response.json().catch(()=>({error:'播放器停止操作返回内容无效'})) as {ok?:boolean;error?:string;requestId?:string|null};
 if(!response.ok||!data.ok)throw Error(data.error||'无法停止上一首，请在播放器中手动停止');
 return data;
}

async function controlHostPlayback(action:'pause'|'resume',deviceToken:string){
 const response=await fetch(endpoint+'/'+action,{method:'POST',headers:{'X-Device-Token':deviceToken.trim()},signal:AbortSignal.timeout(5000)});
 const data=await response.json().catch(()=>({error:'播放器控制返回内容无效'})) as {ok?:boolean;error?:string;requestId?:string|null;requestActive?:boolean;interrupted?:boolean};
 if(!response.ok||!data.ok)throw Error(data.error||'播放器控制失败');
 return data;
}
export const pauseHostPlayback=(deviceToken:string)=>controlHostPlayback('pause',deviceToken);
export const resumeHostPlayback=(deviceToken:string)=>controlHostPlayback('resume',deviceToken);
