'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Heart, Mic2, Play } from 'lucide-react';
import { createShakeDetector } from '@/lib/shake-detector';
import { songs, type Song } from '@/lib/songs';
import type { RequestKind } from '@/lib/request-demo';

export function BlindBox({ pool = songs, favorites, toggleFavorite, ready, onRequest, onCopy, copiedId }: { pool?: Song[]; favorites: number[]; toggleFavorite: (song: Song) => void; ready: boolean; onRequest: (song: Song, kind: RequestKind) => void; onCopy:(song:Song)=>void; copiedId:number|null }) {
 const [song, setSong] = useState<Song | null>(null);
 const [busy, setBusy] = useState(false);
 const [enabled, setEnabled] = useState(false);
 const [message, setMessage] = useState('');
 const [sensorMessage, setSensorMessage] = useState('');
 const lock = useRef(false);
 const mounted = useRef(true);
 const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
 useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (timer.current) clearTimeout(timer.current); }; }, []);
 async function draw(fromMotion = false) {
  if (lock.current) return;
  if (!pool.length) { setSensorMessage('收藏列表为空，请先收藏歌曲。'); return; }
  lock.current = true; setBusy(true);
  const selected = pool[Math.floor(Math.random() * pool.length)];
  setSong(selected); setMessage('');
  const animation = new Promise<void>(resolve => { timer.current = setTimeout(resolve, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650); });
  if (!mounted.current) return;
  setMessage(fromMotion ? '摇到一首惊喜，选择点唱或点放加入待播单。' : '已抽中！选择点唱或点放加入待播单。');
  await animation;
  if (mounted.current) { setBusy(false); lock.current = false; }
 }
 async function toggle() {
  if (enabled) { setEnabled(false); setSensorMessage('手机摇一摇已关闭'); return; }
  const motion = window.DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };
  if (!motion) { setSensorMessage('此浏览器不支持手机摇动，请点击按钮抽歌。'); return; }
  try {
   if (motion.requestPermission && await motion.requestPermission() !== 'granted') { setSensorMessage('未获得运动权限，请点击按钮抽歌。'); return; }
   if (mounted.current) { setEnabled(true); setSensorMessage('正在连接运动传感器，请摇动手机…'); }
  } catch { setSensorMessage('无法开启运动传感器，请点击按钮抽歌。'); }
 }
 const drawRef = useRef(draw); drawRef.current = draw;
 useEffect(() => {
  if (!enabled) return;
  let detector = createShakeDetector(), received = false;
  const reset = () => { detector = createShakeDetector(); };
  const timeout = setTimeout(() => { if (!received) setSensorMessage('浏览器没有提供运动数据。请检查运动传感器权限，或使用上方按钮抽歌。'); }, 5000);
  const motion = (event: DeviceMotionEvent) => {
   if (document.hidden) return;
   // Prefer raw acceleration: some phones return constant zeros for linear acceleration.
   const a = event.accelerationIncludingGravity ?? event.acceleration;
   const fallback = event.acceleration;
   const valid = (v: DeviceMotionEventAcceleration | null) => v && v.x != null && v.y != null && v.z != null;
   const data = valid(a) ? a : valid(fallback) ? fallback : null;
   if (!data) return;
   if (!received) { received = true; setSensorMessage('已收到运动数据，来回摇动手机即可抽歌。'); }
   if (lock.current) return;
   if (detector([data.x!, data.y!, data.z!], performance.now())) void drawRef.current(true);
  };
  window.addEventListener('devicemotion', motion);
  document.addEventListener('visibilitychange', reset);
  return () => { clearTimeout(timeout); window.removeEventListener('devicemotion', motion); document.removeEventListener('visibilitychange', reset); };
 }, [enabled]);
 return <section className="blind-box" aria-label="盲盒点歌">
  <div><p className="eyebrow">SURPRISE SONG</p><h2>盲盒点歌</h2><p>从{pool === songs ? '全部 ' + songs.length : '当前收藏的 ' + pool.length} 首歌中，摇出今天的惊喜。</p></div>
  <div className="blind-actions"><button className="lime-button" disabled={busy} onClick={() => void draw()}>{busy ? '正在摇出好歌…' : '来首好歌摇一摇'}</button><button className="motion-switch" role="switch" aria-checked={enabled} onClick={() => void toggle()}>{enabled ? '关闭手机摇一摇' : '开启手机摇一摇'}</button></div>
  {sensorMessage && <p className="blind-hint" role="status">{sensorMessage}</p>}
  <div className="blind-result-slot">{song ? <div className={"blind-result" + (busy ? " blind-card-drawing" : "")}><span>抽中第 {song.id} 首</span><strong>{song.title}</strong><div className="inline-song-actions"><button className="song-action sing" disabled={busy} onClick={() => onRequest(song,'sing')}><Mic2/>点唱</button><button className="song-action play" disabled={busy} onClick={() => onRequest(song,'play')}><Play/>点放</button><button className="song-action copy" disabled={busy} onClick={()=>onCopy(song)}>{copiedId===song.id?<Check/>:<Copy/>}{copiedId===song.id?'已复制':'复制'}</button><button className="song-action favorite" disabled={!ready || busy} aria-pressed={favorites.includes(song.id)} onClick={() => toggleFavorite(song)}><Heart fill={favorites.includes(song.id) ? 'currentColor' : 'none'} />{favorites.includes(song.id) ? '已喜欢' : '喜欢'}</button></div></div> : <p className="blind-placeholder">准备好了吗？摇一摇，看看会遇见哪首歌。</p>}</div>
  <p className="blind-hint" role="status" aria-live="polite">{message}</p>
 </section>;
}
