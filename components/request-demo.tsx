'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Mic2,Pause,Play,Radio} from 'lucide-react';
import {hostAuthenticate} from '@/lib/catalog';
import {deviceTokenKey,discoverHost,HelperConnectionError,hostPlaybackStatus,pairWithHost,pauseHostPlayback,playOnHost,PlaybackFailure,reconnectHost,resumeHostPlayback,unpairHost} from '@/lib/host-helper';
import {loadRequests,updateRequest,type RequestStatus,type SongRequest} from '@/lib/request-demo';
import {SongManager} from './song-manager';
import {HostOverlayLinks} from './host-overlay-links';
import {nextAutoPlayRequest} from '@/lib/auto-play-queue';

const labels:Record<RequestStatus,string>={pending:'待审核',queued:'排队中',active:'进行中',paused:'已暂停',needsAttention:'需主播处理',done:'已完成',rejected:'已拒绝'};
const activeStatuses:RequestStatus[]=['pending','queued','active','paused','needsAttention'];
const hostTokenKey='songlist-host-token-v1';
const autoPlayKey='songlist-auto-play-v1';
const autoReviewKey='songlist-auto-review-v1';
const autoPausedKey='songlist-auto-paused-v1';

function validHostToken(value:string){
 try{
  const payload=value.split('.')[0];
  if(!payload)return false;
  const normalized=payload.replace(/-/g,'+').replace(/_/g,'/');
  const padded=normalized+'='.repeat((4-normalized.length%4)%4);
  const data=JSON.parse(atob(padded)) as {exp?:number};
  return Number(data.exp)>Date.now()+30_000;
 }catch{return false}
}

function useCloudQueue(token='',interval=30000,enabled=true,background=false){
 const [list,setList]=useState<SongRequest[]>([]),[error,setError]=useState('');
 const refresh=useCallback(async()=>{if(!enabled||(document.hidden&&!background))return;try{setList(await loadRequests(token));setError('')}catch(err){const detail=(err as Error).message;setError(detail.includes('未知操作')?'云端待播单接口尚未部署，暂时无法同步点歌请求':detail)}},[token,enabled,background]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),interval);const onVisible=()=>{if(!document.hidden)void refresh()};window.addEventListener('focus',onVisible);document.addEventListener('visibilitychange',onVisible);return()=>{clearInterval(timer);window.removeEventListener('focus',onVisible);document.removeEventListener('visibilitychange',onVisible)}},[refresh,interval]);
 return {list,error,refresh};
}
export function AudienceQueue({user}:{user:string}){
 const {list,error,refresh}=useCloudQueue('',30000);
 const queue=useMemo(()=>list.filter(item=>activeStatuses.includes(item.status)).sort((a,b)=>{
  const aNow=['active','paused'].includes(a.status)?0:a.status==='needsAttention'?2:1,bNow=['active','paused'].includes(b.status)?0:b.status==='needsAttention'?2:1;
  return aNow-bNow||a.createdAt-b.createdAt;
 }),[list]);
 const mine=queue.findIndex(item=>item.user===user&&item.status!=='needsAttention');
 const blockedMine=queue.some(item=>item.user===user&&item.status==='needsAttention');
 return <section className="audience-queue" aria-labelledby="audience-queue-title"><div className="audience-queue-heading"><div><p className="eyebrow">UP NEXT</p><h1 id="audience-queue-title">待播单</h1><p>点唱和点放按提交时间统一排队，主播处理后这里会更新。</p><button onClick={()=>void refresh()}>刷新待播单</button>{error&&<p role="alert">{error}</p>}</div><div className={'my-position '+(mine>=0?'has-position':'')}><span>{!user?'登录后查看自己的排位':mine>=0?'你的歌排在':blockedMine?'你的歌需要主播处理':'你还没有正在排队的歌'}</span>{user&&mine>=0&&<><strong>第 {mine+1} 位</strong><small>{mine===0?'马上轮到你':`前面还有 ${mine} 首`}</small></>}</div></div><div className="audience-queue-list">{queue.map((item,index)=><article key={item.id} className={'audience-queue-row '+item.status+(item.user===user&&user?' mine':'')}><b>{String(index+1).padStart(2,'0')}</b><span className={'queue-kind '+item.kind}>{item.kind==='sing'?<Mic2/>:<Play/>}{item.kind==='sing'?'点唱':'点放'}</span><div><strong>{item.songTitle||`歌曲 #${item.song}`}</strong><span>{item.artist?`${item.artist} · `:''}{item.user}{item.user===user&&user?'（我）':''} · {labels[item.status]}</span></div></article>)}{!queue.length&&<div className="audience-queue-empty"><Radio/><h2>待播单还是空的</h2><p>去歌曲列表选一首，提交点唱或点放吧。</p></div>}</div></section>;
}
export function HostConsole({onClose}:{onClose:()=>void}){
 const [token,setToken]=useState(''),[password,setPassword]=useState(''),[loginBusy,setLoginBusy]=useState(false),[busyId,setBusyId]=useState(''),[message,setMessage]=useState('');
 const [pairCode,setPairCode]=useState('');
 const [deviceToken,setDeviceToken]=useState('');
 const [pairState,setPairState]=useState<'idle'|'checking'|'connected'>('idle');
 const [pairHint,setPairHint]=useState('正在查找本机播放助手…');
 const [helperVersion,setHelperVersion]=useState('');
 const [overlayToken,setOverlayToken]=useState('');
 const [autoPlay,setAutoPlay]=useState(false);
 const [autoReview,setAutoReview]=useState(false);
 const [autoPaused,setAutoPaused]=useState(false);
 const [restored,setRestored]=useState(false);
 const autoBusy=useRef(false);
 const {list,error,refresh}=useCloudQueue(token,15000,!!token,autoPlay);
 const active=list.filter(item=>activeStatuses.includes(item.status)).sort((a,b)=>Number(b.status==='active')-Number(a.status==='active')||a.createdAt-b.createdAt);
 const history=list.filter(item=>['done','rejected'].includes(item.status));
 const now=active.find(item=>item.status==='active');
 useEffect(()=>{
  try{
   const savedToken=localStorage.getItem(hostTokenKey)||'';
   if(validHostToken(savedToken))setToken(savedToken);else localStorage.removeItem(hostTokenKey);
   sessionStorage.removeItem('songlist-helper-pair-v1');
   setDeviceToken(localStorage.getItem(deviceTokenKey)||'');
   const savedAutoPlay=sessionStorage.getItem(autoPlayKey)==='1';
   setAutoPlay(savedAutoPlay);
   setAutoReview(sessionStorage.getItem(autoReviewKey)==='1');
   setAutoPaused(savedAutoPlay||sessionStorage.getItem(autoPausedKey)==='1');
  }catch{}
  setRestored(true);
 },[]);
 useEffect(()=>{
  if(!restored)return;
  try{
   sessionStorage.setItem(autoPlayKey,autoPlay?'1':'0');
   sessionStorage.setItem(autoReviewKey,autoReview?'1':'0');
   sessionStorage.setItem(autoPausedKey,autoPaused?'1':'0');
  }catch{}
 },[restored,autoPlay,autoReview,autoPaused]);
 useEffect(()=>{
  if(!restored||!token)return;
  let active=true;
  const check=async()=>{
   if(document.hidden)return;
   try{
    const version=await discoverHost();
    if(!active)return;
    setHelperVersion(version);
    if(!deviceToken){setPairState('idle');setPairHint('找到本机助手 · 首次使用请输入一次配对码');return}
    const connection=await reconnectHost(deviceToken);
    if(!active)return;
    setOverlayToken(connection.overlayToken);setHelperVersion(connection.version);setPairState('connected');setPairHint('本机播放助手已连接');
   }catch(err){
    if(!active)return;
    setPairState('idle');setOverlayToken('');setPairHint((err as Error).message);
    if(autoPlay)setAutoPaused(true);
    if(err instanceof HelperConnectionError&&err.reason==='unpaired'){
     try{localStorage.removeItem(deviceTokenKey)}catch{}
     setDeviceToken('');
    }
   }
  };
  void check();
  const timer=setInterval(()=>void check(),15000);
  const onVisible=()=>{if(!document.hidden)void check()};
  document.addEventListener('visibilitychange',onVisible);
  window.addEventListener('focus',onVisible);
  return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('focus',onVisible)};
 },[restored,token,deviceToken,autoPlay]);
 useEffect(()=>{
  if(!token||!error)return;
  if(/过期|未登录|凭证|token/i.test(error)){
   try{localStorage.removeItem(hostTokenKey)}catch{}
   setToken('');setMessage('主播登录已过期，请重新输入密码');
  }
 },[token,error]);
 async function login(){if(loginBusy)return;setLoginBusy(true);setMessage('');try{const result=await hostAuthenticate(password);setToken(result.token);try{localStorage.setItem(hostTokenKey,result.token)}catch{}setPassword('')}catch(err){setMessage((err as Error).message)}finally{setLoginBusy(false)}}
 async function connectHelper(){if(pairState==='checking')return;setPairState('checking');setMessage('');try{const connection=await pairWithHost(pairCode);localStorage.setItem(deviceTokenKey,connection.deviceToken);setDeviceToken(connection.deviceToken);setOverlayToken(connection.overlayToken);setHelperVersion(connection.version);setPairState('connected');setPairCode('');setPairHint('本机播放助手已连接');if(autoPlay)setAutoPaused(true);setMessage('本机播放助手已连接，今后会自动识别并连接')}catch(err){setOverlayToken('');setPairState('idle');setPairHint((err as Error).message);setMessage((err as Error).message)}}
 async function disconnectHelper(){if(!deviceToken)return;try{await unpairHost(deviceToken);localStorage.removeItem(deviceTokenKey);setDeviceToken('');setPairState('idle');setOverlayToken('');setAutoPlay(false);setAutoReview(false);setAutoPaused(false);setPairHint('已取消配对，重新连接需要输入新配对码');setMessage('这台浏览器已取消配对')}catch(err){setMessage((err as Error).message)}}
 async function update(item:SongRequest,status:RequestStatus){if(busyId)return;setBusyId(item.id);setMessage('');try{
  if(status==='active'&&active.some(other=>other.id!==item.id&&other.status==='active'))throw Error('请先完成正在进行的歌曲');
  const played=status==='active'&&item.kind==='play'?await playOnHost(item.id,item.songTitle,deviceToken,item.artist):null;
  await updateRequest(token,item.id,status);await refresh();
  setAutoPaused(false);setMessage(played?`${item.songTitle} 已在${played.player==='qqmusic'?'QQ 音乐':'网易云'}开始播放${played.artist?` · ${played.artist}`:''}${played.ambiguous?'；同名版本较多，请主播核对':''}`:'待播单已更新');
 }catch(err){
  if(status==='active'&&item.kind==='play'&&err instanceof PlaybackFailure&&err.outcome==='unavailable'){
   try{await updateRequest(token,item.id,'needsAttention',err.message.slice(0,120));await refresh()}catch{}
  }
  setMessage((err as Error).message);
  }finally{setBusyId('')}}
 async function pauseAutomation(){
  if(autoBusy.current)return;autoBusy.current=true;setMessage('');
  try{const playing=list.find(item=>item.status==='active'&&item.kind==='play');if(playing){await pauseHostPlayback(deviceToken);await updateRequest(token,playing.id,'paused');await refresh()}setAutoPaused(true);setMessage(playing?'播放器和自动队列已暂停':'自动队列已暂停')}
  catch(err){setMessage((err as Error).message)}finally{autoBusy.current=false}
 }
 async function resumeAutomation(){
  if(autoBusy.current)return;autoBusy.current=true;setMessage('');
  try{
   const paused=list.find(item=>item.status==='paused'&&item.kind==='play');
   const playing=list.find(item=>item.status==='active'&&item.kind==='play');
   if(paused){
    const state=await hostPlaybackStatus(deviceToken);
    if(state.requestId===paused.id&&!state.interrupted)await resumeHostPlayback(deviceToken);
    else await playOnHost(paused.id,paused.songTitle,deviceToken,paused.artist);
    await updateRequest(token,paused.id,'active');
   }
   else if(playing){const state=await hostPlaybackStatus(deviceToken);if(state.requestId!==playing.id||state.interrupted||(!state.playing&&!state.ended)){await updateRequest(token,playing.id,'paused');setAutoPaused(true);throw Error('原点歌仍保留在暂停队列，请点击继续播放重试')}}
   await refresh();setAutoPaused(false);setMessage(paused?'已继续播放并恢复自动队列':'自动队列已恢复，正在检查下一首…');
  }catch(err){setMessage((err as Error).message)}finally{autoBusy.current=false}
 }
 useEffect(()=>{
  if(!autoPlay||autoPaused||!token||pairState!=='connected')return;
  const tick=async()=>{
   if(autoBusy.current||busyId)return;
   autoBusy.current=true;
   try{
    const playing=list.find(item=>item.status==='active'||item.status==='paused');
    if(playing){
     if(playing.status==='paused')return;
     if(playing.kind==='sing')return;
     const state=await hostPlaybackStatus(deviceToken);
     if(state.requestId!==playing.id||state.interrupted){await updateRequest(token,playing.id,'paused');await refresh();setAutoPaused(true);setMessage('检测到主播手动切歌，原点歌已保留在暂停队列；当前歌曲和歌词继续保留');return}
     if(!state.playing&&!state.ended){await updateRequest(token,playing.id,'paused');await refresh();setAutoPaused(true);setMessage('检测到播放器已暂停，自动队列也已暂停');return}
     if(state.estimated&&state.remainingMs===0)throw Error('预计曲长已到，但播放器未确认歌曲结束。自动续播已暂停，请主播确认后点击“完成”');
     if(state.remainingMs===null)throw Error('播放器未提供歌曲时长，自动续播已暂停');
     if(state.ended&&!state.estimated){await updateRequest(token,playing.id,'done');await refresh();setMessage(`${playing.songTitle} 已播放完毕`)}
     return;
    }
    const next=nextAutoPlayRequest(list,autoReview);
    if(!next)return;
    if(next.status==='pending')await updateRequest(token,next.id,'queued');
    let played;
    try{played=await playOnHost(next.id,next.songTitle,deviceToken,next.artist)}
    catch(err){
     if(err instanceof PlaybackFailure&&err.outcome==='unavailable'){
      await updateRequest(token,next.id,'needsAttention','两款播放器均无法自动播放');await refresh();
      setMessage(`${next.songTitle} 暂时无法自动播放：${err.message}。已留给主播处理，继续下一首`);return;
     }
     throw err;
    }
    if(!played.durationMs)throw Error('这首歌没有可用时长，自动续播已暂停，请手动处理');
    await updateRequest(token,next.id,'active');await refresh();
    setMessage(`自动播放 ${next.songTitle} · ${played.player==='qqmusic'?'QQ 音乐':'网易云'}${played.artist?` · ${played.artist}`:''}${played.ambiguous?'；同名版本较多，请核对':''}`);
   }catch(err){setAutoPaused(true);setMessage(`自动播放已暂停：${(err as Error).message}`)}finally{autoBusy.current=false}
  };
  const timer=setInterval(()=>void tick(),5000);
  void tick();
  return()=>clearInterval(timer);
 },[autoPlay,autoReview,autoPaused,token,pairState,deviceToken,list,busyId,refresh]);
 if(!token)return <div className="host-shell"><div className="host-login"><Radio/><p className="eyebrow">HOST CONTROL</p><h1>主播控制台</h1><p>请输入云端配置的主播密码</p><input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void login()}} placeholder="输入主播密码"/><button disabled={loginBusy} onClick={()=>void login()}>{loginBusy?'验证中…':'进入后台'}</button>{message&&<span role="alert">{message}</span>}<button className="host-back" onClick={onClose}>返回歌单</button></div></div>;
 return <div className="host-shell"><header className="host-header"><div><p className="eyebrow">LIVE SONG DESK</p><h1>主播控制台</h1></div><div><span className="live-dot"/>云端已验证<button onClick={()=>void refresh()}>刷新</button><button onClick={onClose}>返回歌单</button></div></header><main className="host-main"><section className="now-playing"><div><p className="eyebrow">NOW HANDLING</p>{now?<><span>{now.kind==='sing'?'正在演唱':'正在播放'}</span><h2>{now.songTitle}</h2><p>{now.user} 点的 · {now.kind==='sing'?'点唱':'点放'}</p></>:<><span>当前空闲</span><h2>等待下一首</h2><p>从下面的队列选择开始</p></>}</div>{now&&<button onClick={()=>void update(now,'done')}>完成当前歌曲</button>}</section><div className="host-stats"><div><b>{active.filter(x=>x.status==='pending').length}</b><span>待审核</span></div><div><b>{active.filter(x=>x.kind==='play').length}</b><span>点放</span></div><div><b>{active.filter(x=>x.kind==='sing').length}</b><span>点唱</span></div></div><HostOverlayLinks onMessage={setMessage} overlayToken={overlayToken}/><section className="queue-panel"><div className="queue-title"><div><p className="eyebrow">REQUEST QUEUE</p><h2>点歌队列</h2></div><span>云端同步 · 页面可见时每15秒刷新</span></div><div className="host-helper-pair"><label>首次连接配对码 <input type="password" value={pairCode} onChange={event=>setPairCode(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')void connectHelper()}} placeholder="仅首次输入助手窗口的 12 位配对码" autoComplete="off"/></label><button type="button" disabled={pairState==='checking'||!pairCode.trim()} onClick={()=>void connectHelper()}>{pairState==='checking'?'连接中…':'连接助手'}</button><span className={pairState==='connected'?'helper-connected':''}>{pairState==='connected'?`● 本机助手已连接 · ${helperVersion}`:pairHint}</span>{pairState==='connected'&&<button type="button" onClick={()=>void disconnectHelper()}>取消配对</button>}</div><label className="host-auto-play"><input type="checkbox" checked={autoPlay} disabled={pairState!=="connected"} onChange={event=>{setAutoPlay(event.target.checked);setAutoPaused(false);if(!event.target.checked)setAutoReview(false)}}/> 自动续播点放 <small>只播放主播已接受的请求；无法确认播完时暂停</small></label><label className="host-auto-play host-auto-review"><input type="checkbox" checked={autoReview} disabled={pairState!=="connected"} onChange={event=>{setAutoReview(event.target.checked);setAutoPaused(false);if(event.target.checked)setAutoPlay(true)}}/> 自动审核并播放点放 <small>跳过点唱，按提交顺序播放后面的点放；点唱仍等主播审核</small></label>{autoPlay&&<div className="host-auto-controls"><button type="button" onClick={()=>void (autoPaused?resumeAutomation():pauseAutomation())}>{autoPaused?<><Play/>继续播放</>:<><Pause/>暂停播放</>}</button><span>{autoPaused?'播放器和自动队列已暂停':'需要暂时停止放歌时，可在这里暂停'}</span></div>}{autoPaused&&<div className="host-auto-paused"><span>自动流程保持开启，目前已暂停</span><button type="button" onClick={()=>void resumeAutomation()}>继续自动播放</button></div>}{(message||error)&&<p className="song-manager-message" role="status">{message||error}</p>}<div className="queue-list">{active.map((item,index)=><article key={item.id} className={'queue-row '+item.status}><b className="queue-position">{String(index+1).padStart(2,'0')}</b><div className={'queue-kind '+item.kind}>{item.kind==='sing'?<Mic2/>:<Play/>}{item.kind==='sing'?'点唱':'点放'}</div><div className="queue-song"><strong>{item.songTitle}</strong><span>{item.artist?`${item.artist} · `:''}{item.user} · {labels[item.status]}{item.attentionReason?` · ${item.attentionReason}`:''}</span></div><div className="queue-actions">{item.status==='pending'?<><button className="accept" disabled={!!busyId} onClick={()=>void update(item,'queued')}>接受</button><button disabled={!!busyId} onClick={()=>void update(item,'rejected')}>拒绝</button></>:item.status==='needsAttention'?<><button className="accept" disabled={!!busyId} onClick={()=>void update(item,'queued')}>重新加入</button><button disabled={!!busyId} onClick={()=>void update(item,'done')}>手动完成</button><button disabled={!!busyId} onClick={()=>void update(item,'rejected')}>拒绝</button></>:<><button className="accept" disabled={!!busyId||item.status==='active'} onClick={()=>void update(item,'active')}>{busyId===item.id?'处理中…':item.kind==='sing'?'开始唱':'播放'}</button><button disabled={!!busyId} onClick={()=>void update(item,'done')}>完成</button></>}</div></article>)}{!active.length&&<p className="queue-empty">目前没有等待中的点歌</p>}</div></section>{history.length>0&&<section className="history-panel"><h3>最近处理</h3>{history.slice(-5).reverse().map(item=><span key={item.id}>{item.songTitle} · {labels[item.status]}<button type="button" disabled={!!busyId} onClick={()=>void update(item,'queued')}>重新加入</button></span>)}</section>}<SongManager token={token}/></main></div>;
}
