'use client';
import {useEffect,useState} from 'react';
import {Copy,ExternalLink,MonitorPlay} from 'lucide-react';

const themes=[
 {id:'liquid',name:'液态玻璃',hint:'通透悬浮'},
 {id:'ancient',name:'古风卷轴',hint:'雅致国风'},
 {id:'modern',name:'现代信息板',hint:'利落科技'},
 {id:'minimal',name:'极简字幕',hint:'画面最轻'},
] as const;
const colors=[
 {id:'lime',name:'青柠',hex:'#d1fc72'},
 {id:'blue',name:'月蓝',hex:'#62dcff'},
 {id:'violet',name:'紫晶',hex:'#c093ff'},
 {id:'red',name:'朱砂',hex:'#ff806f'},
 {id:'gold',name:'鎏金',hex:'#e9c477'},
] as const;

export function HostOverlayLinks({onMessage}:{onMessage:(message:string)=>void}){
 const [url,setUrl]=useState('');
 const [theme,setTheme]=useState<(typeof themes)[number]['id']>('liquid');
 const [color,setColor]=useState<(typeof colors)[number]['id']>('lime');
 useEffect(()=>{const saved=localStorage.getItem('songlist-overlay-theme');const savedColor=localStorage.getItem('songlist-overlay-color');if(themes.some(item=>item.id===saved))setTheme(saved as typeof theme);if(colors.some(item=>item.id===savedColor))setColor(savedColor as typeof color)},[]);
 useEffect(()=>{const next=new URL('overlay/',window.location.href);next.searchParams.set('theme',theme);next.searchParams.set('color',color);setUrl(next.href);localStorage.setItem('songlist-overlay-theme',theme);localStorage.setItem('songlist-overlay-color',color)},[theme,color]);
 async function copy(){
  if(!url)return;
  try{await navigator.clipboard.writeText(url);onMessage('直播画面 URL 已复制')}
  catch{onMessage('复制失败，请从下方地址栏手动复制直播 URL')}
 }
 return <section className="host-overlay-links" aria-labelledby="host-overlay-title">
  <div className="host-overlay-icon"><MonitorPlay size={24}/></div>
  <div className="host-overlay-content"><p className="eyebrow">LIVE OVERLAY</p><h2 id="host-overlay-title">直播画面</h2><p>先选版式，再搭配颜色；复制后可添加到直播软件的浏览器来源。推荐尺寸 420 × 600。</p><span className="overlay-picker-label">版式</span><div className="overlay-theme-picker" aria-label="直播画面版式">{themes.map(item=><button key={item.id} type="button" className={`overlay-theme-option overlay-theme-option-${item.id}`} aria-pressed={theme===item.id} onClick={()=>setTheme(item.id)}><i/><span><b>{item.name}</b><small>{item.hint}</small></span></button>)}</div><span className="overlay-picker-label">颜色</span><div className="overlay-color-picker" aria-label="直播画面颜色">{colors.map(item=><button key={item.id} type="button" aria-label={item.name} title={item.name} aria-pressed={color===item.id} onClick={()=>setColor(item.id)}><i style={{background:item.hex}}/><span>{item.name}</span></button>)}</div><input aria-label="直播画面 URL" readOnly value={url} onFocus={event=>event.currentTarget.select()}/></div>
  <div className="host-overlay-actions"><button type="button" disabled={!url} onClick={()=>void copy()}><Copy size={16}/>复制直播 URL</button><a href={url||undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!url}><ExternalLink size={16}/>预览直播画面</a></div>
 </section>;
}
