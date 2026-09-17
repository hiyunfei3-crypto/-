'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {loadRequests,type SongRequest} from '@/lib/request-demo';

const statusText={pending:'待审核',queued:'排队中',active:'进行中',paused:'已暂停'} as const;

export function LiveOverlay(){
 const [requests,setRequests]=useState<SongRequest[]>([]);
 const [loaded,setLoaded]=useState(false);
 const [syncError,setSyncError]=useState(false);
 const inFlight=useRef(false);
 useEffect(()=>{
  let mounted=true;
  const refresh=async()=>{
   if(document.hidden||inFlight.current)return;
   inFlight.current=true;
   try{const next=await loadRequests();if(mounted){setRequests(next);setLoaded(true);setSyncError(false)}}
   catch{if(mounted)setSyncError(true)}
   finally{inFlight.current=false}
  };
  const onVisible=()=>{if(!document.hidden)void refresh()};
  void refresh();
  const timer=window.setInterval(()=>void refresh(),15000);
  window.addEventListener('focus',onVisible);
  document.addEventListener('visibilitychange',onVisible);
  return()=>{mounted=false;window.clearInterval(timer);window.removeEventListener('focus',onVisible);document.removeEventListener('visibilitychange',onVisible)};
 },[]);
 const {current,upNext,waitingCount}=useMemo(()=>{
  const visible=requests.filter(item=>['pending','queued','active','paused'].includes(item.status));
  const current=visible.filter(item=>item.status==='active'||item.status==='paused').sort((a,b)=>a.createdAt-b.createdAt)[0];
  const waiting=visible.filter(item=>item.id!==current?.id&&['pending','queued'].includes(item.status)).sort((a,b)=>a.createdAt-b.createdAt);
  return {current,upNext:waiting.slice(0,4),waitingCount:waiting.length};
 },[requests]);
 return <div className="live-overlay"><section className="live-overlay-card" aria-label="直播间点歌记录">
  <header className="live-overlay-header"><span className="live-overlay-pulse"/><span>直播点歌</span><span className="live-overlay-count">{waitingCount?`${waitingCount} 首待播`:''}</span></header>
  {current?<div className="live-overlay-current"><span className="live-overlay-kicker">{current.status==='paused'?'已暂停':current.kind==='sing'?'正在演唱':'正在播放'}</span><strong title={current.songTitle}>{current.songTitle}</strong><span>{current.user} 点的 · {current.kind==='sing'?'点唱':'点放'}</span></div>:<div className="live-overlay-current live-overlay-idle"><span className="live-overlay-kicker">NOW PLAYING</span><strong>{!loaded&&!syncError?'正在同步…':upNext.length?'等待主播开始':'等待点歌'}</strong><span>{upNext.length?'下一首已经在队列中':'来点一首你想听的歌'}</span></div>}
  {!!upNext.length&&<div className="live-overlay-queue"><h2>接下来</h2><ol>{upNext.map((item,index)=><li key={item.id}><span className="live-overlay-index">{String(index+1).padStart(2,'0')}</span><div><strong title={item.songTitle}>{item.songTitle}</strong><small>{item.user} · {item.kind==='sing'?'点唱':'点放'}</small></div><em>{statusText[item.status as keyof typeof statusText]}</em></li>)}</ol></div>}
  {syncError&&<p className="live-overlay-sync" role="status">{loaded?'同步暂不可用 · 显示上次记录':'同步暂不可用 · 稍后自动重试'}</p>}
 </section></div>;
}
