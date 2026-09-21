'use client';
import {useEffect,useState} from 'react';
import {Copy,ExternalLink,MonitorPlay} from 'lucide-react';

const themes=[
 {id:'glass',name:'深色玻璃',hint:'清晰耐看'},
 {id:'minimal',name:'极简字幕',hint:'画面最轻'},
 {id:'neon',name:'霓虹蓝紫',hint:'游戏直播'},
 {id:'warm',name:'暖金电台',hint:'温暖醒目'},
] as const;

export function HostOverlayLinks({onMessage}:{onMessage:(message:string)=>void}){
 const [url,setUrl]=useState('');
 const [theme,setTheme]=useState<(typeof themes)[number]['id']>('glass');
 useEffect(()=>{const saved=localStorage.getItem('songlist-overlay-theme');if(themes.some(item=>item.id===saved))setTheme(saved as typeof theme)},[]);
 useEffect(()=>{const next=new URL('overlay/',window.location.href);next.searchParams.set('theme',theme);setUrl(next.href);localStorage.setItem('songlist-overlay-theme',theme)},[theme]);
 async function copy(){
  if(!url)return;
  try{await navigator.clipboard.writeText(url);onMessage('直播画面 URL 已复制')}
  catch{onMessage('复制失败，请从下方地址栏手动复制直播 URL')}
 }
 return <section className="host-overlay-links" aria-labelledby="host-overlay-title">
  <div className="host-overlay-icon"><MonitorPlay size={24}/></div>
  <div className="host-overlay-content"><p className="eyebrow">LIVE OVERLAY</p><h2 id="host-overlay-title">直播画面</h2><p>选择样式后复制对应透明页面，可添加到直播软件的浏览器来源。推荐尺寸 420 × 600。</p><div className="overlay-theme-picker" aria-label="直播画面样式">{themes.map(item=><button key={item.id} type="button" className={`overlay-theme-option overlay-theme-option-${item.id}`} aria-pressed={theme===item.id} onClick={()=>setTheme(item.id)}><i/><span><b>{item.name}</b><small>{item.hint}</small></span></button>)}</div><input aria-label="直播画面 URL" readOnly value={url} onFocus={event=>event.currentTarget.select()}/></div>
  <div className="host-overlay-actions"><button type="button" disabled={!url} onClick={()=>void copy()}><Copy size={16}/>复制直播 URL</button><a href={url||undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!url}><ExternalLink size={16}/>预览直播画面</a></div>
 </section>;
}
