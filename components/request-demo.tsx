'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Mic2,Play,Radio} from 'lucide-react';
import {hostAuthenticate} from '@/lib/catalog';
import {hostPlaybackStatus,pairWithHost,playOnHost} from '@/lib/host-helper';
import {loadRequests,updateRequest,type RequestStatus,type SongRequest} from '@/lib/request-demo';
import {SongManager} from './song-manager';

const labels:Record<RequestStatus,string>={pending:'待审核',queued:'排队中',active:'进行中',paused:'已暂停',done:'已完成',rejected:'已拒绝'};
const activeStatuses:RequestStatus[]=['pending','queued','active','paused'];

function useCloudQueue(token='',interval=30000,enabled=true,background=false){
 const [list,setList]=useState<SongRequest[]>([]),[error,setError]=useState('');
 const refresh=useCallback(async()=>{if(!enabled||(document.hidden&&!background))return;try{setList(await loadRequests(token));setError('')}catch(err){const detail=(err as Error).message;setError(detail.includes('未知操作')?'云端待播单接口尚未部署，暂时无法同步点歌请求':detail)}},[token,enabled,background]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),interval);const onVisible=()=>{if(!document.hidden)void refresh()};window.addEventListener('focus',onVisible);document.addEventListener('visibilitychange',onVisible);return()=>{clearInterval(timer);window.removeEventListener('focus',onVisible);document.removeEventListener('visibilitychange',onVisible)}},[refresh,interval]);
 return {list,error,refresh};
}
export function AudienceQueue({user}:{user:string}){
 const {list,error,refresh}=useCloudQueue('',30000);
 const queue=useMemo(()=>list.filter(item=>activeStatuses.includes(item.status)).sort((a,b)=>{
  const aNow=['active','paused'].includes(a.status)?0:1,bNow=['active','paused'].includes(b.status)?0:1;
  return aNow-bNow||a.createdAt-b.createdAt;
 }),[list]);
 const mine=queue.findIndex(item=>item.user===user);
 return <section className="audience-queue" aria-labelledby="audience-queue-title"><div className="audience-queue-heading"><div><p className="eyebrow">UP NEXT</p><h1 id="audience-queue-title">待播单</h1><p>点唱和点放按提交时间统一排队，主播处理后这里会更新。</p><button onClick={()=>void refresh()}>刷新待播单</button>{error&&<p role="alert">{error}</p>}</div><div className={'my-position '+(mine>=0?'has-position':'')}><span>{!user?'登录后查看自己的排位':mine>=0?'你的歌排在':'你还没有正在排队的歌'}</span>{user&&mine>=0&&<><strong>第 {mine+1} 位</strong><small>{mine===0?'马上轮到你':`前面还有 ${mine} 首`}</small></>}</div></div><div className="audience-queue-list">{queue.map((item,index)=><article key={item.id} className={'audience-queue-row '+item.status+(item.user===user&&user?' mine':'')}><b>{String(index+1).padStart(2,'0')}</b><span className={'queue-kind '+item.kind}>{item.kind==='sing'?<Mic2/>:<Play/>}{item.kind==='sing'?'点唱':'点放'}</span><div><strong>{item.songTitle||`歌曲 #${item.song}`}</strong><span>{item.user}{item.user===user&&user?'（我）':''} · {labels[item.status]}</span></div></article>)}{!queue.length&&<div className="audience-queue-empty"><Radio/><h2>待播单还是空的</h2><p>去歌曲列表选一首，提交点唱或点放吧。</p></div>}</div></section>;
}
export function HostConsole({onClose}:{onClose:()=>void}){
 const [token,setToken]=useState(''),[password,setPassword]=useState(''),[loginBusy,setLoginBusy]=useState(false),[busyId,setBusyId]=useState(''),[message,setMessage]=useState('');
 const [pairCode,setPairCode]=useState('');
 const [pairState,setPairState]=useState<'idle'|'checking'|'connected'>('idle');
 const [autoPlay,setAutoPlay]=useState(false);
 const autoBusy=useRef(false);
 const {list,error,refresh}=useCloudQueue(token,15000,!!token,autoPlay);
 const active=list.filter(item=>activeStatuses.includes(item.status)).sort((a,b)=>Number(b.status==='active')-Number(a.status==='active')||a.createdAt-b.createdAt);
 const history=list.filter(item=>['done','rejected'].includes(item.status));
 const now=active.find(item=>item.status==='active');
 async function login(){if(loginBusy)return;setLoginBusy(true);setMessage('');try{const result=await hostAuthenticate(password);setToken(result.token);setPassword('')}catch(err){setMessage((err as Error).message)}finally{setLoginBusy(false)}}
 async function connectHelper(){if(pairState==='checking')return;setPairState('checking');setMessage('');try{await pairWithHost(pairCode);setPairState('connected');setMessage('本机播放助手已连接，可以在点放请求中点击“播放”')}catch(err){setPairState('idle');setMessage((err as Error).message)}}
 async function update(item:SongRequest,status:RequestStatus){if(busyId)return;setBusyId(item.id);setMessage('');try{
  if(status==='active'&&active.some(other=>other.id!==item.id&&other.status==='active'))throw Error('请先完成正在进行的歌曲');
  const played=status==='active'&&item.kind==='play'?await playOnHost(item.id,item.songTitle,pairCode):null;
  await updateRequest(token,item.id,status);await refresh();
  setMessage(played?`${item.songTitle} 已在网易云开始播放${played.artist?` · ${played.artist}`:''}`:'待播单已更新');
 }catch(err){setMessage((err as Error).message)}finally{setBusyId('')}}
 useEffect(()=>{
  if(!autoPlay||!token||pairState!=='connected')return;
  const tick=async()=>{
   if(autoBusy.current||busyId)return;
   autoBusy.current=true;
   try{
    const playing=list.find(item=>item.status==='active'||item.status==='paused');
    if(playing){
     if(playing.status==='paused')return;
     if(playing.kind==='sing')return;
     const state=await hostPlaybackStatus(pairCode);
     if(state.requestId!==playing.id)throw Error('助手当前歌曲与待播单不一致，自动续播已暂停');
     if(state.remainingMs===null)throw Error('网易云未提供歌曲时长，自动续播已暂停');
     if(state.ended){await updateRequest(token,playing.id,'done');await refresh();setMessage(`${playing.songTitle} 已按预计曲长播放完毕`)}
     return;
    }
    const next=list.filter(item=>item.status==='pending'||item.status==='queued').sort((a,b)=>a.createdAt-b.createdAt)[0];
    if(!next||next.kind==='sing')return;
    if(next.status==='pending')await updateRequest(token,next.id,'queued');
    const played=await playOnHost(next.id,next.songTitle,pairCode);
    if(!played.durationMs)throw Error('这首歌没有可用时长，自动续播已暂停，请手动处理');
    await updateRequest(token,next.id,'active');await refresh();
    setMessage(`自动播放 ${next.songTitle}${played.artist?` · ${played.artist}`:''}`);
   }catch(err){setAutoPlay(false);setMessage((err as Error).message)}finally{autoBusy.current=false}
  };
  const timer=setInterval(()=>void tick(),5000);
  void tick();
  return()=>clearInterval(timer);
 },[autoPlay,token,pairState,pairCode,list,busyId,refresh]);
 if(!token)return <div className="host-shell"><div className="host-login"><Radio/><p className="eyebrow">HOST CONTROL</p><h1>主播控制台</h1><p>请输入云端配置的主播密码</p><input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void login()}} placeholder="输入主播密码"/><button disabled={loginBusy} onClick={()=>void login()}>{loginBusy?'验证中…':'进入后台'}</button>{message&&<span role="alert">{message}</span>}<button className="host-back" onClick={onClose}>返回歌单</button></div></div>;
 return <div className="host-shell"><header className="host-header"><div><p className="eyebrow">LIVE SONG DESK</p><h1>主播控制台</h1></div><div><span className="live-dot"/>云端已验证<button onClick={()=>void refresh()}>刷新</button><button onClick={onClose}>返回歌单</button></div></header><main className="host-main"><section className="now-playing"><div><p className="eyebrow">NOW HANDLING</p>{now?<><span>{now.kind==='sing'?'正在演唱':'正在播放'}</span><h2>{now.songTitle}</h2><p>{now.user} 点的 · {now.kind==='sing'?'点唱':'点放'}</p></>:<><span>当前空闲</span><h2>等待下一首</h2><p>从下面的队列选择开始</p></>}</div>{now&&<button onClick={()=>void update(now,'done')}>完成当前歌曲</button>}</section><div className="host-stats"><div><b>{active.filter(x=>x.status==='pending').length}</b><span>待审核</span></div><div><b>{active.filter(x=>x.kind==='play').length}</b><span>点放</span></div><div><b>{active.filter(x=>x.kind==='sing').length}</b><span>点唱</span></div></div><section className="queue-panel"><div className="queue-title"><div><p className="eyebrow">REQUEST QUEUE</p><h2>点歌队列</h2></div><span>云端同步 · 页面可见时每15秒刷新</span></div><div className="host-helper-pair"><label>本机助手配对码 <input type="password" value={pairCode} onChange={event=>{setPairCode(event.target.value);setPairState('idle');setAutoPlay(false)}} onKeyDown={event=>{if(event.key==='Enter')void connectHelper()}} placeholder="输入助手窗口显示的配对码" autoComplete="off"/></label><button type="button" disabled={pairState==='checking'} onClick={()=>void connectHelper()}>{pairState==='checking'?'连接中…':pairState==='connected'?'重新连接':'连接助手'}</button><span className={pairState==='connected'?'helper-connected':''}>{pairState==='connected'?'● 本机助手已连接':'运行助手后，输入配对码并点击“连接助手”'}</span></div><label className="host-auto-play"><input type="checkbox" checked={autoPlay} disabled={pairState!=="connected"} onChange={event=>setAutoPlay(event.target.checked)}/> 自动续播点放 <small>按预计曲长切歌；暂停或拖动网易云进度时请关闭</small></label>{(message||error)&&<p className="song-manager-message" role="status">{message||error}</p>}<div className="queue-list">{active.map((item,index)=><article key={item.id} className={'queue-row '+item.status}><b className="queue-position">{String(index+1).padStart(2,'0')}</b><div className={'queue-kind '+item.kind}>{item.kind==='sing'?<Mic2/>:<Play/>}{item.kind==='sing'?'点唱':'点放'}</div><div className="queue-song"><strong>{item.songTitle}</strong><span>{item.user} · {labels[item.status]}</span></div><div className="queue-actions">{item.status==='pending'?<><button className="accept" disabled={!!busyId} onClick={()=>void update(item,'queued')}>接受</button><button disabled={!!busyId} onClick={()=>void update(item,'rejected')}>拒绝</button></>:<><button className="accept" disabled={!!busyId||item.status==='active'} onClick={()=>void update(item,'active')}>{busyId===item.id?'处理中…':item.kind==='sing'?'开始唱':'播放'}</button><button disabled={!!busyId} onClick={()=>void update(item,'done')}>完成</button></>}</div></article>)}{!active.length&&<p className="queue-empty">目前没有等待中的点歌</p>}</div></section>{history.length>0&&<section className="history-panel"><h3>最近处理</h3>{history.slice(-5).reverse().map(item=><span key={item.id}>{item.songTitle} · {labels[item.status]}</span>)}</section>}<SongManager token={token}/></main></div>;
}
