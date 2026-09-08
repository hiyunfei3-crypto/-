'use client';
import { BlindBox } from '@/components/blind-box';
import { useEffect, useState } from 'react';
import { ArrowUpRight, AudioLines, ChevronLeft, ChevronRight, Heart, Search, X, Copy, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { copySongRequest, requestText } from '@/lib/song-request';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationEllipsis } from '@/components/ui/pagination';
import { songs, categories, cleanFavorites, findSongs, matchesCategory, isSC, PAGE_SIZE, type Song, type Category } from '@/lib/songs';

const storageKey = 'on-repeat-song-favorites-v1';
export default function Home() {
 const [view, setView] = useState('discover');
 const [category, setCategory] = useState<Category>('全部');
 const [query, setQuery] = useState('');
 const [page, setPage] = useState(1);
 const [favorites, setFavorites] = useState<number[]>([]);
 const [ready, setReady] = useState(false);
 const [storageError, setStorageError] = useState(false);
 const [announcement, setAnnouncement] = useState('');
 const [copiedId, setCopiedId] = useState<number | null>(null);
 const [copying, setCopying] = useState(false);
 const [copyMessage, setCopyMessage] = useState('');
 const [manualCopy, setManualCopy] = useState<Song | null>(null);
 useEffect(() => { if (copiedId === null) return; const timer = setTimeout(() => setCopiedId(null), 2500); return () => clearTimeout(timer); }, [copiedId]);
 async function copySong(song: Song) {
  if (copying) return;
  setCopying(true);
  const succeeded = await copySongRequest(song, navigator.clipboard);
  setCopying(false);
  if (succeeded) { setCopiedId(song.id); setCopyMessage('已复制：' + requestText(song) + '，请粘贴到直播间。'); }
  else { setCopyMessage(''); setManualCopy(song); }
 }

 useEffect(() => {
  const restore = () => { try { setFavorites(cleanFavorites(JSON.parse(localStorage.getItem(storageKey) || '[]'))); setStorageError(false); } catch { setStorageError(true); } };
  restore(); setReady(true);
  const onStorage = (event: StorageEvent) => { if (event.key === storageKey || event.key === null) restore(); };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
 }, []);
 function toggleFavorite(song: Song) {
  if (!ready) return;
  let current = favorites;
  try { current = cleanFavorites(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch { /* Keep the usable in-memory selection. */ }
  const exists = current.includes(song.id);
  const next = exists ? current.filter(id => id !== song.id) : [...current, song.id];
  setFavorites(next);
  try { localStorage.setItem(storageKey, JSON.stringify(next)); setStorageError(false); } catch { setStorageError(true); }
  setAnnouncement(song.title + (exists ? '已取消收藏' : '已加入收藏'));
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
    <button className={'copy-song-button' + (copiedId === song.id ? ' copied' : '')} onClick={() => copySong(song)} disabled={copying} aria-label={'复制点歌：' + requestText(song)}>{copiedId === song.id ? <Check size={16} /> : <Copy size={16} />}<span>{copiedId === song.id ? '已复制' : '复制点歌'}</span></button>
    <button className={'favorite-button' + (favorites.includes(song.id) ? ' saved' : '')} aria-label={(favorites.includes(song.id) ? '取消收藏' : '收藏') + '第 ' + song.id + ' 首 ' + song.title} aria-pressed={favorites.includes(song.id)} onClick={() => toggleFavorite(song)} disabled={!ready}><Heart size={19} fill={favorites.includes(song.id) ? 'currentColor' : 'none'} /></button>
   </li>)}</ol>
   <div className="catalog-paging"><span className="page-label">第 {currentPage} / {pageCount} 页</span><Pagination aria-label="歌曲列表分页"><PaginationContent>
    <PaginationItem><Button variant="ghost" className="page-direction" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)} aria-label="上一页"><ChevronLeft size={18} /><span>上一页</span></Button></PaginationItem>
    {pageNumbers.map((n, i) => <PaginationItem key={n} className="page-number-item">{i > 0 && n - pageNumbers[i - 1] > 1 && <PaginationEllipsis />}<PaginationLink href="#collection" isActive={currentPage === n} aria-label={'第 ' + n + ' 页'} onClick={event => { event.preventDefault(); goToPage(n); }}>{n}</PaginationLink></PaginationItem>)}
    <PaginationItem><Button variant="ghost" className="page-direction" disabled={currentPage === pageCount} onClick={() => goToPage(currentPage + 1)} aria-label="下一页"><span>下一页</span><ChevronRight size={18} /></Button></PaginationItem>
   </PaginationContent></Pagination></div>
  </> : <Empty className="empty-state"><EmptyHeader>{view === 'favorites' ? <Heart size={34} /> : <Search size={34} />}<EmptyTitle className="empty-title">{query || category !== '全部' ? '没有找到这首歌' : '喜欢的歌，留在这里'}</EmptyTitle><EmptyDescription>{query || category !== '全部' ? '试试歌名中的几个字，或者输入原编号。' : '点击歌曲旁的爱心，就能加入你的收藏。'}</EmptyDescription></EmptyHeader><Button className="lime-button" onClick={() => { if (!query && category === '全部') setView('discover'); resetFilters(); }}>{query || category !== '全部' ? '清除筛选' : '浏览全部曲目'}<ArrowUpRight size={16} /></Button></Empty>}
 </>;
 return <Tabs value={view} onValueChange={value => { setView(String(value)); resetFilters(); }} className="site-shell">
  <a href="#collection" className="skip-link">跳到歌曲列表</a>
  <header className="topbar"><a href="./" className="brand" aria-label="点歌单首页"><span className="brand-symbol"><AudioLines size={25} /></span><strong>点歌单<span>SONG REQUESTS</span></strong></a><TabsList variant="line" className="main-nav"><TabsTrigger value="discover">全部歌曲</TabsTrigger><TabsTrigger value="favorites">我的收藏<span className="nav-count">{favorites.length}</span></TabsTrigger></TabsList><div className="personal"><span className="status-dot" />直播间点歌</div></header>
  <main id="main"><div className="page-heading"><div><p className="eyebrow">SONG REQUESTS / {songs.length} TRACKS</p><h1>点歌单</h1></div><div className="search-box"><Search size={20} /><Input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="搜索歌名或原编号，如 543" aria-label="搜索歌名或原编号" />{query && <button onClick={() => { setQuery(''); setPage(1); }} aria-label="清除搜索"><X size={17} /></button>}</div></div>
  {view === 'discover' && !query && <section className="catalog-featured" aria-label="点歌说明"><div className="catalog-banner"><img src="./night-city.png" alt="" /><div className="catalog-banner-copy"><p className="eyebrow">PICK A SONG.</p><h2>选一首，<br />唱给你听。</h2><p>{songs.length} 首歌曲 <span>·</span> {songs.filter(isSC).length} 首 SC 标记</p></div><AudioLines className="banner-icon" aria-hidden="true" /></div><aside className="catalog-favorites"><div className="note-top"><Heart size={21} /><span>MY FAVORITES</span></div><strong>{String(favorites.length).padStart(2, '0')}<span>首已收藏</span></strong><button onClick={() => { setView('favorites'); resetFilters(); }}>打开我的收藏<ArrowUpRight size={21} /></button></aside></section>}
  <BlindBox manualCopy={setManualCopy} /><p className="request-instructions">找到想听的歌，点击「复制点歌」，再粘贴到直播间。</p><TabsContent value="discover" className="collection-content">{view === 'discover' && catalog}</TabsContent><TabsContent value="favorites" className="collection-content">{view === 'favorites' && catalog}</TabsContent>
  {storageError && <p className="storage-warning" role="alert">浏览器暂时无法保存收藏；本次选择仍可使用，关闭页面后可能丢失。</p>}
  <footer><a href="./" className="footer-brand"><AudioLines size={18} />点歌单</a><span>{songs.length} 首歌曲 · 收藏保存在当前浏览器 · 复制歌名到直播间点歌</span><a href="#main">回到顶部 ↑</a></footer>
  </main><span className="sr-only" role="status">{announcement}</span>
  {copyMessage && <div className="copy-notice" role="status"><Check size={18} /><span>{copyMessage}</span><button onClick={() => setCopyMessage('')} aria-label="关闭复制提示"><X size={18} /></button></div>}
  <Dialog open={!!manualCopy} onOpenChange={open => { if (!open) setManualCopy(null); }}><DialogContent className="manual-copy-dialog" showCloseButton={false}><DialogHeader><DialogTitle>手动复制点歌</DialogTitle><DialogDescription>浏览器未允许自动复制。请选择下方文字复制，然后粘贴到直播间。</DialogDescription></DialogHeader><textarea autoFocus readOnly aria-label="点歌文字" value={manualCopy ? requestText(manualCopy) : ''} onFocus={event => event.currentTarget.select()} /><DialogClose render={<Button className="lime-button" />}>完成</DialogClose></DialogContent></Dialog>
 </Tabs>;
}


