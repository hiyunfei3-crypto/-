const empty=()=>({available:false,source:'none',player:'',title:'',artist:'',currentLine:'',nextLine:'',words:[],positionMs:null,playing:false,updatedAt:Date.now()});

export function parseLrc(value){
 const rows=[];
 for(const line of String(value||'').split(/\r?\n/)){
  const text=line.replace(/\[(?:\d{1,2}:\d{2}(?:\.\d{1,3})?)+\]/g,'').trim();
  for(const match of line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)){
   if(!text)continue;
   const fraction=String(match[3]||'').padEnd(3,'0').slice(0,3);
   rows.push({timeMs:(Number(match[1])*60+Number(match[2]))*1000+Number(fraction),text});
  }
 }
 return rows.sort((a,b)=>a.timeMs-b.timeMs);
}

export function normalizePlayerCap(value){
 const data=value?.data||value||{};
 const lyric=data.lyric||data.current_lyric||data.currentLyric||data;
 const currentLine=String(lyric.text||lyric.current_text||data.text||'').trim();
 const nextLine=String(lyric.next_text||lyric.nextText||data.next_text||'').trim();
 const rawWords=lyric.text_detailed||lyric.words||[];
 const words=Array.isArray(rawWords)?rawWords.map(item=>({text:String(item.text||item.word||''),startMs:Number(item.start_time??item.startMs??0),durationMs:Number(item.duration??item.durationMs??0)})).filter(item=>item.text):[];
 return {available:!!currentLine,source:'playercap',player:String(data.player||data.player_name||''),title:String(data.title||data.song_name||data.songInfo?.title||''),artist:String(data.artist||data.songInfo?.artist||''),currentLine,nextLine,words,positionMs:Number.isFinite(Number(data.position??data.progress))?Number(data.position??data.progress):null,playing:data.playing!==false,updatedAt:Date.now()};
}

async function playerCapSnapshot(){
 const response=await fetch('http://127.0.0.1:8765/lyric_update',{signal:AbortSignal.timeout(800)});
 if(!response.ok)throw Error('PlayerCap unavailable');
 return normalizePlayerCap(await response.json());
}

async function pageLyrics(page,source){
 if(!page||page.isClosed())return empty();
 const frames=page.frames();
 for(const frame of frames){
  try{
   const result=await frame.evaluate(player=>{
    const visible=el=>!!el&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden'&&el.getBoundingClientRect().height>0;
    const selectors=player==='netease'?['.j-flag .z-sel','.m-lyric .z-sel','.lyric .z-sel','[class*="lyric"] [class*="active"]']:['.lyric__item--current','.lyric__item--active','[class*="lyric"] [class*="current"]','[class*="lyric"] [class*="active"]'];
    const current=selectors.flatMap(s=>[...document.querySelectorAll(s)]).find(visible);
    if(!current)return null;
    const currentLine=(current.textContent||'').trim();
    let next=current.nextElementSibling;
    while(next&&!visible(next))next=next.nextElementSibling;
    const title=document.querySelector('.words a.name,.song_info__name,.player__songname,[class*="player"] [class*="songname"]');
    const artist=document.querySelector('.words .by,.song_info__singer,.player__singer');
    return {currentLine,nextLine:(next?.textContent||'').trim(),title:(title?.getAttribute('title')||title?.textContent||'').trim(),artist:(artist?.getAttribute('title')||artist?.textContent||'').replace(/^\s*[-–—]\s*/,'').trim()};
   },source);
   if(result?.currentLine)return {...empty(),...result,available:true,source:'web',player:source,playing:true,updatedAt:Date.now()};
  }catch{}
 }
 return empty();
}

export class LyricBridge{
 constructor(browser,playback){this.browser=browser;this.playback=playback;this.last=empty();this.neteaseCache=new Map()}
 async neteaseLyrics(){
  const current=this.playback.current;
  if(current?.source!=='netease'||!current.songId)return null;
  const page=await this.browser.page('netease',{reopen:false});
  if(!page)return null;
  let rows=this.neteaseCache.get(current.songId);
  if(!rows){
   const payload=await page.evaluate(async id=>{const response=await fetch(`/api/song/lyric?id=${encodeURIComponent(id)}&lv=1&kv=1&tv=-1`);return response.ok?response.json():null},current.songId).catch(()=>null);
   rows=parseLrc(payload?.lrc?.lyric||payload?.klyric?.lyric||'');
   if(rows.length)this.neteaseCache.set(current.songId,rows);
  }
  if(!rows?.length)return null;
  let positionMs=current.lastPositionMs;
  if(!Number.isFinite(positionMs)&&current.frame&&current.src)positionMs=await current.frame.evaluate(source=>{const media=[...document.querySelectorAll('audio,video')].find(item=>(item.currentSrc||item.src)===source);return media?media.currentTime*1000:null},current.src).catch(()=>null);
  if(!Number.isFinite(positionMs))return null;
  let index=rows.findLastIndex(row=>row.timeMs<=positionMs+200);
  if(index<0)index=0;
  const state=await page.evaluate(()=>{const root=document.querySelector('.m-playbar');const title=root?.querySelector('.words a.name');const artist=root?.querySelector('.words .by');return {title:title?.getAttribute('title')||title?.textContent||'',artist:artist?.getAttribute('title')||artist?.textContent||''}}).catch(()=>({title:'',artist:''}));
  return {...empty(),available:true,source:'web',player:'netease',title:String(state.title||'').trim(),artist:String(state.artist||'').replace(/^\s*[-–—]\s*/,'').trim(),currentLine:rows[index]?.text||'',nextLine:rows[index+1]?.text||'',positionMs,playing:true,updatedAt:Date.now()};
 }
 async snapshot(){
  try{const result=await playerCapSnapshot();if(result.available){this.last=result;return result}}catch{}
  const netease=await this.neteaseLyrics().catch(()=>null);if(netease?.available){this.last=netease;return netease}
  const active=this.playback.current?.source;
  const order=active?[active,...['netease','qqmusic'].filter(x=>x!==active)]:['netease','qqmusic'];
  for(const source of order){
   const page=await this.browser.page(source,{reopen:false}).catch(()=>null);
   const result=await pageLyrics(page,source);
   if(result.available){this.last=result;return result}
  }
  if(Date.now()-this.last.updatedAt<3000)return this.last;
  return empty();
 }
}
