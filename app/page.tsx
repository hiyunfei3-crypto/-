'use client';
import { BlindBox } from '@/components/blind-box';
import { CommunityPanel } from '@/components/community-panel';
import { community, type Community } from '@/lib/community';
import { useEffect, useState } from 'react';
import { ArrowUpRight, AudioLines, ChevronLeft, ChevronRight, Heart, Mic2, Play, Search, X, Check, Copy } from 'lucide-react';
import { copySongRequest, requestText } from '@/lib/song-request';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AudienceQueue, HostConsole } from '@/components/request-demo';
import type { RequestKind } from '@/lib/request-demo';
import { submitRequest } from '@/lib/request-demo';
import {cachedCatalog,loadCatalog} from '@/lib/catalog';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationEllipsis } from '@/components/ui/pagination';
import { songs, replaceSongs, categories, cleanFavorites, findSongs, matchesCategory, isSC, PAGE_SIZE, type Song, type Category } from '@/lib/songs';

const storageKey = 'on-repeat-song-favorites-v1';
export default function Home() {
 const [hostMode,setHostMode]=useState(false);
 const [copiedId,setCopiedId]=useState<number|null>(null);
 const [view, setView] = useState('discover');
 const [category, setCategory] = useState<Category>('全部');
 const [query, setQuery] = useState('');
 const [page, setPage] = useState(1);
 const [favorites, setFavorites] = useState<number[]>([]);
 const [profileId,setProfileId]=useState('');
 const [shared,setShared]=useState<Community|null>(null);
 const [sharedError,setSharedError]=useState('');
 const [sharedBusy,setSharedBusy]=useState(false);
 const [catalogError,setCatalogError]=useState('');
 const [,setCatalogRevision]=useState(0);
 async function act(path:string,body:Record<string,unknown>){
  if(sharedBusy)return false;
  setSharedBusy(true);setSharedError('');
  try{const data=await community(path,{...body,id:profileId});setShared(data);if(profileId)setFavorites(data.favorites);return true;}
  catch(e){setSharedError((e as Error).message);return false;}finally{setSharedBusy(false);}
 }
 async function enter(id:string,merge:boolean){
  if(sharedBusy)return;setSharedBusy(true);setSharedError('');
  try{const data=await community('login',{id,merge:merge?cleanFavorites(JSON.parse(localStorage.getItem(storageKey)||'[]')):[]});setShared(data);setProfileId(data.id);setFavorites(data.favorites);}
  catch(e){setSharedError((e as Error).message);}finally{setSharedBusy(false);}
 }
 function leave(){setProfileId('');setShared(null);try{setFavorites(cleanFavorites(JSON.parse(localStorage.getItem(storageKey)||'[]')));}catch{setFavorites([]);}}
 useEffect(()=>{
  let active=true;
  void community('state?id=').then(data=>{if(active){setShared(data);setSharedError('');}}).catch(e=>{if(active)setSharedError(e.message);});
  return()=>{active=false};
 },[]);
 useEffect(()=>{
  let active=true;replaceSongs(cachedCatalog());setCatalogRevision(value=>value+1);
  void loadCatalog().then(result=>{if(active){replaceSongs(result.songs);setCatalogRevision(value=>value+1);setCatalogError('')}}).catch(()=>{if(active)setCatalogError('歌曲目录暂未同步，当前显示缓存歌单')});
  return()=>{active=false};
 },[]);
 const [ready, setReady] = useState(false);
 const [storageError, setStorageError] = useState(false);
 const [announcement, setAnnouncement] = useState('');
 const [notice, setNotice] = useState<{ text: string } | null>(null);
 const notify = (text: string) => setNotice({ text });
 useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 3000); return () => clearTimeout(timer); }, [notice]);
 useEffect(()=>{if(copiedId===null)return;const timer=setTimeout(()=>setCopiedId(null),2200);return()=>clearTimeout(timer)},[copiedId]);
 function directRequest(song:Song,kind:RequestKind){
  if(!profileId){notify('请先点击右上角头像，输入 ID 后再点歌');return}
  try{submitRequest(profileId,song.id,kind);notify(`${song.title} · ${kind==='sing'?'点唱':'点放'}已提交，可到待播单查看排位`)}catch(error){notify((error as Error).message)}
 }
 async function copySong(song:Song){
  if(await copySongRequest(song,navigator.clipboard)){setCopiedId(song.id);notify('已复制：'+requestText(song))}
  else notify('浏览器未允许复制，请长按歌名手动复制')
 }

 useEffect(() => {
  const restore = () => { if(profileId)return; try { setFavorites(cleanFavorites(JSON.parse(localStorage.getItem(storageKey) || '[]'))); setStorageError(false); } catch { setStorageError(true); } };
  restore(); setReady(true);
  const onStorage = (event: StorageEvent) => { if (event.key === storageKey || event.key === null) restore(); };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
 }, [profileId]);
 async function toggleFavorite(song: Song) {
  if (!ready) return;
  if(profileId){const exists=favorites.includes(song.id);if(await act('like',{song:song.id,active:!exists}))notify(song.title+(exists?'已取消收藏':'已加入收藏'));return;}
  let current = favorites;
  try { current = cleanFavorites(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch { /* Keep the usable in-memory selection. */ }
  const exists = current.includes(song.id);
  const next = exists ? current.filter(id => id !== song.id) : [...current, song.id];
  setFavorites(next);
  try { localStorage.setItem(storageKey, JSON.stringify(next)); setStorageError(false); } catch { setStorageError(true); }
  setAnnouncement(song.title + (exists ? '已取消收藏' : '已加入收藏'));
  notify(song.title + (exists ? '已取消收藏' : '已加入收藏'));
 }
 const visible = findSongs(view, category, query, favorites);
 const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
 const currentPage = Math.min(page, pageCount);
 const start = (currentPage - 1) * PAGE_SIZE;
 const currentSongs = visible.slice(start, start + PAGE_SIZE);
 const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1).filter(n => n === 1 || n === pageCount || Math.abs(n - currentPage) <= 1);
 const resetFilters = () => { setCategory('全部'); setQuery(''); setPage(1); };
 function goToPage(next: number) {
  setPage(Math.max(1, Math.min(pageCount, next)));
  document.getElementById('collection-heading')?.focus({ preventScroll: true });
  document.getElementById('collection')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
 }
 if(hostMode)return <HostConsole onClose={()=>setHostMode(false)}/>;
 const catalog = <>
  <div className="section-line" id="collection"><h2 id="collection-heading" tabIndex={-1}>{view === 'favorites' ? '我的收藏' : '全部曲目'}<span>{visible.length} 首</span></h2><p>{query ? '搜索结果 · 保留原始编号' : '按原始编号排列'}</p></div>
  <div className="filters" aria-label="按歌名字数或 SC 标记筛选">{categories.map(c => {
   const count = songs.filter(s => (view !== 'favorites' || favorites.includes(s.id)) && matchesCategory(s, c)).length;
   return <button key={c} className={'filter' + (category === c ? ' active' : '')} aria-pressed={category === c} onClick={() => { setCategory(c); setPage(1); }}>{c}<span className="filter-count">{count}</span></button>;
  })}</div>
  <p className="result-summary" role="status">{visible.length ? '共 ' + visible.length + ' 首 · 当前显示第 ' + (start + 1) + '–' + Math.min(start + PAGE_SIZE, visible.length) + ' 条' : '找到 0 首歌曲'}{(query || category !== '全部') && <button onClick={resetFilters}>清除筛选<X size={14} /></button>}</p>
  {visible.length ? <>
   <ol className="song-grid" aria-label={view === 'favorites' ? '已收藏歌曲' : '歌曲列表'} start={start + 1}>{currentSongs.map(song => <li key={song.id} className={'song-item' + (favorites.includes(song.id) ? ' song-saved' : '')}>
    <span className="song-number" aria-label={'原编号 ' + song.id}>{String(song.id).padStart(3, '0')}</span>
    <span className="song-name">{song.title}</span>
    <div className="song-request-actions"><button className="song-action sing" onClick={()=>directRequest(song,'sing')}><Mic2/>点唱</button><button className="song-action play" onClick={()=>directRequest(song,'play')}><Play/>点放</button><button className="song-action copy" onClick={()=>void copySong(song)}>{copiedId===song.id?<Check/>:<Copy/>}{copiedId===song.id?'已复制':'复制'}</button></div>
    <button className={'favorite-button' + (favorites.includes(song.id) ? ' saved' : '')} aria-label={(favorites.includes(song.id) ? '取消收藏' : '收藏') + '第 ' + song.id + ' 首 ' + song.title} aria-pressed={favorites.includes(song.id)} onClick={() => toggleFavorite(song)} disabled={!ready}><Heart size={19} fill={favorites.includes(song.id) ? 'currentColor' : 'none'} /></button>
   </li>)}</ol>
   <div className="catalog-paging"><span className="page-label">第 {currentPage} / {pageCount} 页</span><Pagination aria-label="歌曲列表分页"><PaginationContent>
    <PaginationItem><Button variant="ghost" className="page-direction" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)} aria-label="上一页"><ChevronLeft size={18} /><span>上一页</span></Button></PaginationItem>
    {pageNumbers.map((n, i) => <PaginationItem key={n} className="page-number-item">{i > 0 && n - pageNumbers[i - 1] > 1 && <PaginationEllipsis />}<PaginationLink href="#collection" isActive={currentPage === n} aria-label={'第 ' + n + ' 页'} onClick={event => { event.preventDefault(); goToPage(n); }}>{n}</PaginationLink></PaginationItem>)}
    <PaginationItem><Button variant="ghost" className="page-direction" disabled={currentPage === pageCount} onClick={() => goToPage(currentPage + 1)} aria-label="下一页"><span>下一页</span><ChevronRight size={18} /></Button></PaginationItem>
   </PaginationContent></Pagination></div>
  </> : <Empty className="empty-state"><EmptyHeader>{view === 'favorites' ? <Heart size={34} /> : <Search size={34} />}<EmptyTitle className="empty-title">{query || category !== '全部' ? '没有找到这首歌' : '喜欢的歌，留在这里'}</EmptyTitle><EmptyDescription>{query || category !== '全部' ? '试试歌名中的几个字，或者输入原编号。' : '点击歌曲旁的爱心，就能加入你的收藏。'}</EmptyDescription></EmptyHeader><Button className="lime-button" onClick={() => { if (!query && category === '全部') setView('discover'); resetFilters(); }}>{query || category !== '全部' ? '清除筛选' : '浏览全部曲目'}<ArrowUpRight size={16} /></Button></Empty>}
 </>;
 return <Tabs value={view} onValueChange={value => { setView(String(value)); resetFilters(); }} className={'site-shell'+(view==='ranking'||view==='wishes'||view==='queue'?' community-view':'')}>
  <a href="#collection" className="skip-link">跳到歌曲列表</a>
  <header className="topbar"><a href="./" className="brand" aria-label="点歌单首页"><span className="brand-symbol"><AudioLines size={25} /></span><strong>点歌单<span>SONG REQUESTS</span></strong></a><div id="profile-slot" /><TabsList variant="line" className="main-nav"><TabsTrigger value="discover">全部歌曲</TabsTrigger><TabsTrigger value="queue">待播单</TabsTrigger><TabsTrigger value="ranking">点歌榜</TabsTrigger><TabsTrigger value="wishes">许愿学歌</TabsTrigger><TabsTrigger value="favorites">我的收藏<span className="nav-count">{favorites.length}</span></TabsTrigger></TabsList></header>
  <div className={"search-dock"+(view==='ranking'||view==='wishes'||view==='queue'?' search-dock-hidden':'')}> <div className="search-box"><Search size={20} /><Input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="搜索歌名或原编号，如 543" aria-label="搜索歌名或原编号" />{query && <button onClick={() => { setQuery(''); setPage(1); }} aria-label="清除搜索"><X size={17} /></button>}</div></div>
  <CommunityPanel data={shared} id={profileId} enter={enter} leave={leave} act={act} view={view} error={sharedError} busy={sharedBusy} openHost={()=>setHostMode(true)}/>
  {view==='queue'&&<AudienceQueue user={profileId}/>} 
  <main id="main"><div className="page-heading"><div><p className="eyebrow">SONG REQUESTS / {songs.length} TRACKS</p><h1>点歌单</h1></div></div>
  {catalogError&&<p className="catalog-sync-warning" role="status">{catalogError}</p>}
  {view === 'discover' && !query && <section className="catalog-featured" aria-label="点歌说明"><div className="catalog-banner"><img src="./night-city.png" alt="" /><div className="catalog-banner-copy"><p className="eyebrow">PICK A SONG.</p><h2>选一首，<br />唱给你听。</h2><p>{songs.length} 首歌曲 <span>·</span> {songs.filter(isSC).length} 首 SC 标记</p></div><AudioLines className="banner-icon" aria-hidden="true" /></div><aside className="catalog-favorites"><div className="note-top"><Heart size={21} /><span>MY FAVORITES</span></div><strong>{String(favorites.length).padStart(2, '0')}<span>首已收藏</span></strong><button onClick={() => { setView('favorites'); resetFilters(); }}>打开我的收藏<ArrowUpRight size={21} /></button></aside></section>}
  <BlindBox favorites={favorites} toggleFavorite={toggleFavorite} ready={ready} onRequest={directRequest} onCopy={song=>void copySong(song)} copiedId={copiedId} pool={view === 'favorites' ? songs.filter(song => favorites.includes(song.id)) : songs} /><p className="request-instructions">找到想听的歌，直接点唱、点放，或复制歌名分享；提交后可在待播单查看排位。</p><TabsContent value="discover" className="collection-content">{view === 'discover' && catalog}</TabsContent><TabsContent value="favorites" className="collection-content">{view === 'favorites' && catalog}</TabsContent>
  {storageError && <p className="storage-warning" role="alert">浏览器暂时无法保存收藏；本次选择仍可使用，关闭页面后可能丢失。</p>}
  <footer><a href="./" className="footer-brand"><AudioLines size={18} />点歌单</a><span>{songs.length} 首歌曲 · {profileId?'收藏保存在ID档案':'游客收藏保存在当前浏览器'} · 点唱和点放可在待播单查看</span><a href="#main">回到顶部 ↑</a></footer>
  </main><span className="sr-only" role="status">{announcement}</span>
  {notice && <div className="copy-notice" role="status"><Check size={18} /><span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="关闭提示"><X size={18} /></button></div>}
 </Tabs>;
}


