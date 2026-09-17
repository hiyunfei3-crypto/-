'use client';
import {useEffect,useState} from 'react';
import {Copy,ExternalLink,MonitorPlay} from 'lucide-react';

export function HostOverlayLinks({onMessage}:{onMessage:(message:string)=>void}){
 const [url,setUrl]=useState('');
 useEffect(()=>{setUrl(new URL('overlay/',window.location.href).href)},[]);
 async function copy(){
  if(!url)return;
  try{await navigator.clipboard.writeText(url);onMessage('直播画面 URL 已复制')}
  catch{onMessage('复制失败，请从下方地址栏手动复制直播 URL')}
 }
 return <section className="host-overlay-links" aria-labelledby="host-overlay-title">
  <div className="host-overlay-icon"><MonitorPlay size={24}/></div>
  <div className="host-overlay-content"><p className="eyebrow">LIVE OVERLAY</p><h2 id="host-overlay-title">直播画面</h2><p>透明底点歌展示页，可添加到直播软件的浏览器来源。推荐尺寸 420 × 600。</p><input aria-label="直播画面 URL" readOnly value={url} onFocus={event=>event.currentTarget.select()}/></div>
  <div className="host-overlay-actions"><button type="button" disabled={!url} onClick={()=>void copy()}><Copy size={16}/>复制直播 URL</button><a href={url||undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!url}><ExternalLink size={16}/>预览直播画面</a></div>
 </section>;
}
