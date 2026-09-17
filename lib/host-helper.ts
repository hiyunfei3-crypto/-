const endpoint='http://127.0.0.1:43871';

export class PlaybackFailure extends Error{
 constructor(message:string,public readonly outcome:'unavailable'|'unknown'){super(message);this.name='PlaybackFailure'}
}

export async function pairWithHost(code:string){
 if(!code.trim())throw Error('请先输入助手窗口显示的配对码');
 let response:Response;
 try{
  response=await fetch(endpoint+'/pair',{method:'POST',headers:{'X-Host-Code':code.trim()},signal:AbortSignal.timeout(5000)});
 }catch{throw Error('无法连接本机播放助手，请确认助手窗口保持打开')}
 const data=await response.json().catch(()=>({error:'本机助手返回内容无效'})) as {ok?:boolean;error?:string};
 if(!response.ok||!data.ok)throw Error(data.error||'助手配对失败');
 return true;
}

export async function playOnHost(requestId:string,title:string,code:string,artist=''){
 if(!code.trim())throw Error('请先输入本机助手显示的配对码');
 let response:Response;
 try{
  response=await fetch(endpoint+'/play',{method:'POST',headers:{'Content-Type':'application/json','X-Host-Code':code.trim()},body:JSON.stringify({requestId,title,artist}),signal:AbortSignal.timeout(90000)});
 }catch(error){throw new PlaybackFailure(error instanceof DOMException&&error.name==='TimeoutError'?'播放器搜索或切歌超时，请确认是否已经出声':'无法连接本机播放助手，请确认它已在主播电脑运行','unknown')}
 const data=await response.json().catch(()=>({error:'本机助手返回内容无效'})) as {ok?:boolean;error?:string;outcome?:'unavailable'|'unknown';matchedTitle?:string;artist?:string;album?:string;player?:'netease'|'qqmusic';durationMs?:number;ambiguous?:boolean};
 if(!response.ok||!data.ok)throw new PlaybackFailure(data.error||'音乐软件未能确认开始播放',data.outcome||'unknown');
 return data as {ok:true;matchedTitle:string;artist:string;album:string;player:'netease'|'qqmusic';durationMs:number;ambiguous?:boolean};
}

export async function hostPlaybackStatus(code:string){
 const response=await fetch(endpoint+'/status',{method:'POST',headers:{'X-Host-Code':code.trim()},signal:AbortSignal.timeout(5000)});
 const data=await response.json() as {ok?:boolean;error?:string;requestId?:string|null;ended?:boolean;estimated?:boolean;remainingMs?:number|null};
 if(!response.ok||!data.ok)throw Error(data.error||'无法读取本机助手播放状态');
 return data;
}
