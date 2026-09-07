'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, AudioLines, Check, Disc3, Heart, Search, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
type Playlist = { id: string; title: string; subtitle: string; category: string; tags: string[]; cover: string; label: string; description: string; tracks: { title: string; artist: string }[] };
const playlists: Playlist[] = [
 {id:'night',title:'夜行电台',subtitle:'把白天的喧闹，留在车窗外。',category:'夜晚',tags:['华语','独立','夜晚'],cover:'night',label:'AFTER\nHOURS',description:'城市渐渐安静，耳机里的故事还没有结束。这几首歌，留给不急着入睡的夜晚。',tracks:[{title:'夜曲',artist:'周杰伦'},{title:'晚安',artist:'颜人中'},{title:'安和桥',artist:'宋冬野'},{title:'如常',artist:'草东没有派对'}]},
 {id:'morning',title:'日光慢慢',subtitle:'从一首轻快的歌开始今天。',category:'放松',tags:['华语','放松'],cover:'morning',label:'SLOW\nMORNING',description:'拉开窗帘，给咖啡一点时间，也给自己一点时间。今天可以慢慢来。',tracks:[{title:'稻香',artist:'周杰伦'},{title:'小情歌',artist:'苏打绿'},{title:'简单爱',artist:'周杰伦'},{title:'旅行的意义',artist:'陈绮贞'}]},
 {id:'weekend',title:'把周末调成慢速',subtitle:'散步、发呆，或者什么也不做。',category:'放松',tags:['独立','民谣','放松'],cover:'weekend',label:'OFF\nTHE CLOCK',description:'不安排目的地，也不着急到达。陪你走一段路，或者在沙发上度过一个下午。',tracks:[{title:'想去海边',artist:'夏日入侵企画'},{title:'夏夜晚风',artist:'伍佰'},{title:'平凡之路',artist:'朴树'},{title:'在木星',artist:'朴树'}]},
 {id:'focus',title:'留一点空白',subtitle:'关掉杂念，进入自己的节奏。',category:'专注',tags:['纯音乐','专注'],cover:'focus',label:'LESS\nIS MORE',description:'没有歌词来打断思路，让钢琴和旋律陪着你。适合阅读、写字，以及需要专心的时刻。',tracks:[{title:'River Flows in You',artist:'Yiruma'},{title:'One Summer’s Day',artist:'久石让'},{title:'Kiss the Rain',artist:'Yiruma'},{title:'Merry Christmas Mr. Lawrence',artist:'坂本龙一'}]},
 {id:'run',title:'心跳加速',subtitle:'再多跑一首歌的距离。',category:'运动',tags:['摇滚','运动'],cover:'run',label:'KEEP\nMOVING',description:'把音量调到舒服的位置，让节奏陪你向前。为出发准备，也为再坚持一会儿准备。',tracks:[{title:'倔强',artist:'五月天'},{title:'追梦赤子心',artist:'GALA'},{title:'蓝莲花',artist:'许巍'},{title:'海阔天空',artist:'Beyond'}]},
 {id:'memories',title:'记忆里的那一首',subtitle:'前奏响起，回到那个夏天。',category:'怀旧',tags:['华语','经典','怀旧'],cover:'memories',label:'ONCE\nAGAIN',description:'有些歌不需要看歌词。从校园广播到回家路上，熟悉的旋律总能把记忆带回来。',tracks:[{title:'晴天',artist:'周杰伦'},{title:'后来',artist:'刘若英'},{title:'十年',artist:'陈奕迅'},{title:'遇见',artist:'孙燕姿'}]}
];
const categories = ['全部','放松','夜晚','专注','运动','怀旧'];
const storageKey = 'on-repeat-playlist-favorites-v1';
function Cover({playlist,hero=false}:{playlist:Playlist;hero?:boolean}) {
 return <div className={'cover cover-'+playlist.cover+(hero?' cover-hero':'')} aria-hidden="true">
 {playlist.cover==='night' && <img src="/night-city.png" alt="" />}
 <div className="cover-top"><span>ON REPEAT</span><AudioLines size={18}/></div><span className="cover-title">{playlist.label}</span>
 <div className="cover-bottom"><span>VOL. {String(playlists.indexOf(playlist)+1).padStart(2,'0')}</span><span>↗</span></div></div>;
}
export default function Home(){
 const [view,setView]=useState('discover');
 const [category,setCategory]=useState('全部');
 const [query,setQuery]=useState('');
 const [favorites,setFavorites]=useState<string[]>([]);
 const [ready,setReady]=useState(false);
 const [storageError,setStorageError]=useState(false);
 const [selected,setSelected]=useState<Playlist|null>(null);
 const [announcement,setAnnouncement]=useState('');
 useEffect(()=>{try{const saved:unknown=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))setFavorites(saved.filter((id):id is string=>typeof id==='string'&&playlists.some(p=>p.id===id)));}catch{setStorageError(true);}setReady(true);},[]);
 function toggleFavorite(p:Playlist){
  if(!ready)return;
  const exists=favorites.includes(p.id);const next=exists?favorites.filter(id=>id!==p.id):[...favorites,p.id];
  setFavorites(next);try{localStorage.setItem(storageKey,JSON.stringify(next));setStorageError(false);}catch{setStorageError(true);}
  setAnnouncement(p.title+(exists?'已取消收藏':'已加入收藏'));
 }
 const search=query.trim().toLocaleLowerCase();
 const visible=playlists.filter(p=>(view==='discover'||favorites.includes(p.id))&&(category==='全部'||p.category===category)&&[p.title,p.subtitle,...p.tags,...p.tracks.flatMap(t=>[t.title,t.artist])].join(' ').toLocaleLowerCase().includes(search));
 const featured=playlists[0];
 const resetFilters=()=>{setCategory('全部');setQuery('');};
 const collection=<>
  <div className="section-line" id="collection"><h2>{view==='favorites'?'我的收藏':'挑一张，听听看'}<span>{String(visible.length).padStart(2,'0')}</span></h2><p>{view==='favorites'?'留住喜欢的音乐':'不同心情，都有一张歌单'}</p></div>
  <div className="filters" aria-label="按心情筛选歌单">{categories.map(c=><button key={c} className={'filter'+(category===c?' active':'')} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
  <p className="sr-only" role="status">找到 {visible.length} 张歌单</p>
  {visible.length?<div className="playlist-grid">{visible.map(p=><article className="playlist-card" key={p.id}>
   <button className="cover-button" onClick={()=>setSelected(p)} aria-label={'查看'+p.title+'歌单'}><Cover playlist={p}/><span className="open-cover"><ArrowUpRight size={24}/></span></button>
   <div className="card-heading"><button onClick={()=>setSelected(p)} className="text-button"><h3>{p.title}</h3></button><button className={'favorite-button'+(favorites.includes(p.id)?' saved':'')} aria-label={(favorites.includes(p.id)?'取消收藏':'收藏')+p.title} aria-pressed={favorites.includes(p.id)} onClick={()=>toggleFavorite(p)} disabled={!ready}><Heart size={20} fill={favorites.includes(p.id)?'currentColor':'none'}/></button></div>
   <p className="card-subtitle">{p.subtitle}</p><div className="card-meta"><span>{p.tracks.length} 首歌曲</span><span>·</span><span>{p.tags.slice(0,2).join(' / ')}</span></div>
   {search&&<p className="match-hint">{p.tracks.filter(t=>(t.title+' '+t.artist).toLocaleLowerCase().includes(search)).slice(0,1).map(t=>'含「'+t.title+'」· '+t.artist)}</p>}
  </article>)}</div>:<Empty className="empty-state"><EmptyHeader><Heart size={36}/><EmptyTitle className="empty-title">{query||category!=='全部'?'暂时没有匹配的歌单':'喜欢的歌单，留在这里'}</EmptyTitle><EmptyDescription>{query||category!=='全部'?'试试其他歌名、歌手，或者换一种心情。':'点击歌单旁的爱心，就能把它加入收藏。'}</EmptyDescription></EmptyHeader><Button onClick={()=>{resetFilters();if(!query&&category==='全部')setView('discover');}} className="lime-button">{query||category!=='全部'?'清除筛选':'去发现歌单'}<ArrowUpRight size={16}/></Button></Empty>}
 </>;
 return <Tabs value={view} onValueChange={value=>{setView(String(value));resetFilters();}} className="site-shell">
  <a href="#main" className="skip-link">跳到歌单</a>
  <header className="topbar"><a href="/" className="brand" aria-label="循环首页"><span className="brand-symbol"><AudioLines size={25}/></span><strong>循环<span>ON REPEAT</span></strong></a><TabsList variant="line" className="main-nav"><TabsTrigger value="discover">发现歌单</TabsTrigger><TabsTrigger value="favorites">我的收藏<span className="nav-count">{favorites.length}</span></TabsTrigger></TabsList><div className="personal"><span className="status-dot"/>私人音乐空间<div className="avatar">我</div></div></header>
  <main id="main"><div className="page-heading"><div><p className="eyebrow">YOUR PERSONAL SOUNDTRACK</p><h1>生活，自有节奏<span>。</span></h1></div><div className="search-box"><Search size={20}/><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索歌单、歌曲或歌手" aria-label="搜索歌单、歌曲或歌手"/>{query&&<button onClick={()=>setQuery('')} aria-label="清除搜索"><X size={17}/></button>}</div></div>
   {view==='discover'&&!query&&<section className="featured-layout" aria-label="精选歌单"><button className="featured" onClick={()=>setSelected(featured)}><Cover playlist={featured} hero/><div className="featured-copy"><p className="eyebrow"><span className="status-dot"/>本期精选 / VOL. 01</p><h2>夜深了，<br/>再听一首。</h2><p>把白天的喧闹，留在车窗外。</p><div className="featured-tags"><span>华语</span><span>独立</span><span>夜晚</span></div><span className="feature-action">打开夜行电台<ArrowUpRight size={19}/></span></div></button><aside className="collection-note"><div className="note-top"><Heart size={22}/><span>MADE FOR YOU</span></div><div><p>你的音乐偏爱</p><strong>{String(favorites.length).padStart(2,'0')}<span>张已收藏</span></strong></div><button onClick={()=>{setView('favorites');resetFilters();}}>打开我的收藏<ArrowUpRight size={22}/></button><p className="local-note">收藏仅保存在当前浏览器</p></aside></section>}
   <TabsContent value="discover" className="collection-content">{view==='discover'&&collection}</TabsContent><TabsContent value="favorites" className="collection-content">{view==='favorites'&&collection}</TabsContent>
   {storageError&&<p className="storage-warning" role="alert">浏览器暂时无法保存收藏；本次选择仍可使用，关闭页面后可能丢失。</p>}
   <footer><a href="/" className="footer-brand"><AudioLines size={18}/>循环 · ON REPEAT</a><span>示例歌单 · 收藏仅保存在当前浏览器</span><a href="#main">回到顶部 ↑</a></footer>
  </main><span className="sr-only" role="status">{announcement}</span>
  <Sheet open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}}><SheetContent className="playlist-sheet" aria-label="歌单详情">{selected&&<><SheetHeader className="detail-header"><div className="detail-cover"><Cover playlist={selected}/></div><p className="eyebrow">PLAYLIST / {selected.tracks.length} TRACKS</p><SheetTitle className="detail-title">{selected.title}</SheetTitle><SheetDescription className="detail-description">{selected.description}</SheetDescription><Button className={'detail-save'+(favorites.includes(selected.id)?' is-saved':'')} onClick={()=>toggleFavorite(selected)} disabled={!ready}>{favorites.includes(selected.id)?<Check size={18}/>:<Heart size={18}/>} {favorites.includes(selected.id)?'已收藏 · 点击取消':'收藏这张歌单'}</Button></SheetHeader><ol className="track-list">{selected.tracks.map((track,i)=><li key={track.title}><span className="track-number">{String(i+1).padStart(2,'0')}</span><div><h3>{track.title}</h3><p>{track.artist}</p></div><Disc3 size={20}/></li>)}</ol><p className="detail-note">这是一份歌单展示，暂不提供站内音频播放。</p></>}</SheetContent></Sheet>
 </Tabs>;
}
