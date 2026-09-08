'use client';
import { useEffect, useRef, useState } from 'react';
import { createShakeDetector } from '@/lib/shake-detector';
import { songs, type Song } from '@/lib/songs';
import { copySongRequest, requestText } from '@/lib/song-request';

export function BlindBox({ manualCopy, pool = songs }: { manualCopy: (song: Song) => void; pool?: Song[] }) {
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
  lock.current = true; setBusy(true);
  if (!pool.length) { setSensorMessage('收藏列表为空，请先收藏歌曲。'); lock.current = false; return; }
  const selected = pool[Math.floor(Math.random() * pool.length)];
  setSong(selected); setMessage('');
  // Start clipboard access in the original user gesture, before animation delays.
  const copied = copySongRequest(selected, navigator.clipboard);
  const animation = new Promise<void>(resolve => { timer.current = setTimeout(resolve, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650); });
  const ok = await copied;
  if (!mounted.current) return;
  setMessage(ok ? '已复制，请粘贴到直播间：' + requestText(selected) : '已抽中！点击复制点歌。');
  if (!ok && !fromMotion) manualCopy(selected);
  await animation;
  if (mounted.current) { setBusy(false); lock.current = false; }
 }
 async function copy() {
  if (!song || lock.current) return;
  lock.current = true;
  const ok = await copySongRequest(song, navigator.clipboard);
  if (mounted.current) { setMessage(ok ? '已复制，请粘贴到直播间：' + requestText(song) : '请选择弹窗中的文字手动复制'); if (!ok) manualCopy(song); }
  lock.current = false;
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
  {song && <div className={'blind-result' + (busy ? ' shaking' : '')}><span>抽中第 {song.id} 首</span><strong>{song.title}</strong><div><button disabled={busy} onClick={() => void draw()}>再摇一次</button><button disabled={busy} onClick={() => void copy()}>复制点歌</button></div></div>}
  <p className="blind-hint" role="status" aria-live="polite">{message}</p>
 </section>;
}
