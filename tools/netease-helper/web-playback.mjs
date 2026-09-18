import {findSong,PlaybackAttemptError} from './netease-adapter.mjs';

const normalize=value=>String(value||'').normalize('NFKC').trim().toLocaleLowerCase();
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const qqSearch='https://y.qq.com/n/ryqq_v2/search';

export function parsePlayerClock(value){
 const parts=String(value||'').trim().split(':').map(Number);
 if(parts.length<2||parts.length>3||parts.some(part=>!Number.isInteger(part)||part<0))return null;
 return parts.reduce((total,part)=>total*60+part,0)*1000;
}

export function parseNeteasePlayerState(raw){
 const [,positionText='',durationText='']=raw.time.match(/(\d{1,2}:\d{2}(?::\d{2})?)\s*\/\s*(\d{1,2}:\d{2}(?::\d{2})?)/)||[];
 return {songId:raw.href.match(/[?&]id=(\d+)/)?.[1]||'',title:raw.title.trim(),positionMs:parsePlayerClock(positionText),durationMs:parsePlayerClock(durationText),playingClass:/\bpas\b/.test(raw.playClass)};
}

export function neteaseProgressWrapped(lastPositionMs,state){
 return Number.isFinite(lastPositionMs)&&state.durationMs>0&&lastPositionMs>=state.durationMs-10000&&state.positionMs<lastPositionMs-5000&&state.positionMs<=Math.min(60000,state.durationMs/4);
}

export function neteaseTrackCompleted(current,state){
 if(!current?.durationMs||current.lastPositionMs<current.durationMs-10000)return false;
 if(state.songId&&state.songId!==current.songId)return true;
 return state.songId===current.songId&&neteaseProgressWrapped(current.lastPositionMs,state);
}

async function neteasePlayerState(page){
 const raw=await page.evaluate(()=>{
  const root=document.querySelector('.m-playbar');
  const song=root?.querySelector('.words a.name');
  const time=root?.querySelector('.m-pbar .time')?.textContent||'';
  const play=root?.querySelector('a[data-action="play"]');
  return {href:song?.getAttribute('href')||'',title:song?.getAttribute('title')||song?.textContent||'',time,playClass:play?.className||''};
 });
 return parseNeteasePlayerState(raw);
}

async function confirmedNeteaseUI(page,songId){
 let first=null;
 for(let i=0;i<24;i++){
  const state=await neteasePlayerState(page).catch(()=>null);
  if(state?.songId===String(songId)&&state.durationMs>0&&state.positionMs!==null){
   if(first?.songId!==state.songId||state.positionMs<first.positionMs)first=state;
   else if(state.positionMs>=first.positionMs+1000)return state;
  }
  await wait(500);
 }
 return null;
}

export function selectExactSong(rows,title,artist='',cover=false){
 const matches=rows.filter(row=>normalize(row.title)===normalize(title));
 const chosen=matches.find(row=>artist?cover?!row.artists.some(name=>normalize(name)===normalize(artist)):row.artists.some(name=>normalize(name)===normalize(artist)):true);
 return chosen?{...chosen,ambiguous:!artist&&matches.length>1}:null;
}

async function mediaStates(browser,source){
 const origin=source==='netease'?'https://music.163.com':'https://y.qq.com';
 const states=[];
 for(const page of browser.context.pages().filter(item=>item.url().startsWith(origin))){
  for(const frame of page.frames()){
   try{
    const entries=await frame.evaluate(()=>[...document.querySelectorAll('audio,video')].map(item=>({src:item.currentSrc||item.src||'',time:item.currentTime,duration:item.duration,paused:item.paused,ended:item.ended,ready:item.readyState,muted:item.muted})));
    for(const entry of entries)states.push({...entry,page,frame});
   }catch{}
  }
 }
 return states;
}

async function confirmedMedia(browser,source,before){
 const old=new Map(before.filter(item=>item.src).map(item=>[item.src,item.time]));
 let first=null;
 for(let i=0;i<24;i++){
  const states=await mediaStates(browser,source);
  const candidate=states.find(item=>item.src&&!item.paused&&!item.muted&&item.ready>=2&&Number.isFinite(item.duration)&&item.duration>0&&(!old.has(item.src)||item.time<(old.get(item.src)-1)));
  if(candidate){
   if(!first||first.src!==candidate.src)first={...candidate,initialTime:candidate.time};
   else if(candidate.time>first.initialTime+0.6)return candidate;
  }
  await wait(500);
 }
 return null;
}

async function watchEnd(media){
 await media.frame.evaluate(source=>{
  window.__songlistEndedSource='';
  const item=[...document.querySelectorAll('audio,video')].find(element=>(element.currentSrc||element.src)===source);
  item?.addEventListener('ended',()=>{window.__songlistEndedSource=source},{once:true});
 },media.src);
}

export class WebPlayback{
 constructor(browser){this.browser=browser;this.current=null;this.neteaseMonitor=null;this.neteaseMonitorBusy=false;this.lastNeteaseState=null;this.lastNeteaseError=null}
 diagnostics(){
  const current=this.current;
  return {current:current?{source:current.source,kind:current.kind||'media',songId:current.songId||null,positionMs:current.lastPositionMs??null,durationMs:current.durationMs??null,ended:!!current.ended,interrupted:!!current.interrupted}:null,netease:this.lastNeteaseState,error:this.lastNeteaseError};
 }
 startNeteaseMonitor(){
  if(this.neteaseMonitor)clearInterval(this.neteaseMonitor);
  this.neteaseMonitor=setInterval(()=>void this.sampleNeteaseUI(),500);
 }
 async sampleNeteaseUI(){
  const current=this.current;
  if(this.neteaseMonitorBusy||current?.kind!=='ui'||current.ended||current.interrupted)return;
  this.neteaseMonitorBusy=true;
  try{
   const state=await neteasePlayerState(current.page);
   this.lastNeteaseState=state;
   this.lastNeteaseError=null;
   if(this.current!==current)return;
   const completed=neteaseTrackCompleted(current,state);
   if((state.songId&&state.songId!==current.songId)||completed){
    await this.stopAll();
    this.current={...current,ended:completed,interrupted:!completed};
    return;
   }
   if(state.songId===current.songId&&state.positionMs!==null&&state.durationMs){
    if(state.positionMs>current.lastPositionMs)current.lastProgressAt=Date.now();
    current.lastPositionMs=state.positionMs;
    current.durationMs=state.durationMs;
   }
  }catch(error){
   this.lastNeteaseError=String(error?.message||error);
  }finally{this.neteaseMonitorBusy=false}
 }
 async stopAll(){
  if(this.neteaseMonitor){clearInterval(this.neteaseMonitor);this.neteaseMonitor=null}
  const neteasePage=this.browser.page('netease');
  const neteaseState=await neteasePlayerState(neteasePage).catch(()=>null);
  let advancing=false;
  if(neteaseState?.songId&&!neteaseState.playingClass&&neteaseState.positionMs!==null){
   await wait(1200);
   const latest=await neteasePlayerState(neteasePage).catch(()=>null);
   advancing=latest?.songId===neteaseState.songId&&latest.positionMs>neteaseState.positionMs;
  }
  if(neteaseState?.playingClass||advancing)await neteasePage.locator('.m-playbar a[data-action="play"]').click({timeout:5000});
  for(const source of ['netease','qqmusic']){
   const origin=source==='netease'?'https://music.163.com':'https://y.qq.com';
   for(const page of this.browser.context.pages().filter(item=>item.url().startsWith(origin))){
    for(const frame of page.frames()){
     try{await frame.evaluate(()=>[...document.querySelectorAll('audio,video')].forEach(item=>item.pause()))}catch{}
    }
   }
  }
  this.current=null;
 }
 async qq(title,artist='',cover=false){
  const page=this.browser.page('qqmusic');
  const query=new URL(qqSearch);query.searchParams.set('w',artist&&!cover?`${title} ${artist}`:title);query.searchParams.set('t','song');
  await page.goto(query.toString(),{waitUntil:'domcontentloaded',timeout:30000});
  try{await page.locator('.songlist__item').first().waitFor({state:'visible',timeout:15000})}
  catch{
   const text=await page.locator('body').innerText().catch(()=>'');
   if(/QQ登录|微信登录|查看更多内容，请下载客户端/.test(text))throw new PlaybackAttemptError('QQ 音乐网页尚未登录，或网页版不提供搜索结果；请在助手打开的 Chrome 窗口登录后重试','unknown');
   if(/没有找到相关歌曲|没有搜索到|暂无搜索结果/.test(text))throw new PlaybackAttemptError(`QQ 音乐没有找到「${title}」`,'unavailable');
   throw new PlaybackAttemptError('QQ 音乐网页搜索没有返回可识别的歌曲','unknown');
  }
  const rows=await page.locator('.songlist__item').evaluateAll(items=>items.map((item,index)=>({
   index,title:item.querySelector('.songlist__songname_txt a[title]')?.getAttribute('title')||'',
   artists:[...item.querySelectorAll('.songlist__artist a[title]')].map(a=>a.getAttribute('title')).filter(Boolean),
   href:item.querySelector('.songlist__songname_txt a[href*="songDetail"]')?.getAttribute('href')||'',
  })));
  const selected=selectExactSong(rows,title,artist,cover);
  if(!selected)throw new PlaybackAttemptError(`QQ 音乐未找到${artist&&!cover?'指定歌手的':'同名'}可识别版本「${title}」`,'unavailable');
  const before=await mediaStates(this.browser,'qqmusic');
  await page.locator('.songlist__item').nth(selected.index).locator('.list_menu__play').click({timeout:10000});
  const media=await confirmedMedia(this.browser,'qqmusic',before);
  if(!media){
   const text=await page.locator('body').innerText().catch(()=>'');
   if(/暂无版权|应版权方要求|此歌曲暂时无法播放/.test(text))throw new PlaybackAttemptError('QQ 音乐提示版权限制','unavailable');
   throw new PlaybackAttemptError('QQ 音乐已收到播放指令，但未确认目标音频开始播放','unknown');
  }
  await watchEnd(media);
  this.current={source:'qqmusic',src:media.src,frame:media.frame,startedAt:Date.now(),durationMs:media.duration*1000};
  return {ok:true,player:'qqmusic',matchedTitle:selected.title,artist:selected.artists.join(' / '),durationMs:media.duration*1000,ambiguous:selected.ambiguous,verification:'html-media-progress'};
 }
 async netease(title,artist='',cover=false){
  let song;
  try{song=await findSong(title,artist,cover)}catch(error){throw error}
  const page=this.browser.page('netease');
  const before=await mediaStates(this.browser,'netease');
  await page.goto(`https://music.163.com/#/song?id=${song.id}`,{waitUntil:'domcontentloaded',timeout:30000});
  const frame=page.frameLocator('iframe#g_iframe');
  try{await frame.locator('a[data-res-action="play"][data-res-id="'+song.id+'"]').first().click({timeout:15000})}
  catch{throw new PlaybackAttemptError('网易云网页未提供可操作的播放按钮，请检查登录状态','unknown')}
  const media=await confirmedMedia(this.browser,'netease',before);
  const ui=media?null:await confirmedNeteaseUI(page,song.id);
  if(!media&&!ui){
   const text=await page.locator('body').innerText().catch(()=>'');
   if(/登录获取更懂你的好音乐|扫码登录/.test(text))throw new PlaybackAttemptError('网易云音乐网页尚未登录；请在助手打开的 Chrome 窗口登录后重试','unknown');
   if(/暂无版权|因合作方要求|VIP.*才能|开通.*会员/.test(text))throw new PlaybackAttemptError('网易云网页提示版权或会员限制','unavailable');
   throw new PlaybackAttemptError('网易云已收到播放指令，但未确认目标音频开始播放','unknown');
  }
  if(media)await watchEnd(media);
  this.current=media?{source:'netease',src:media.src,frame:media.frame,startedAt:Date.now(),durationMs:media.duration*1000}:{source:'netease',kind:'ui',songId:String(song.id),page,durationMs:ui.durationMs,lastPositionMs:ui.positionMs,lastProgressAt:Date.now()};
  if(ui)this.startNeteaseMonitor();
  return {ok:true,player:'netease',matchedTitle:song.name,artist:(song.artists||[]).map(item=>item.name).join(' / '),durationMs:this.current.durationMs,ambiguous:!!song.ambiguous,verification:media?'html-media-progress':'player-bar-progress'};
 }
 async status(){
  if(!this.current)return {ended:false,estimated:false,remainingMs:null};
  if(this.current.kind==='ui'){
   if(this.current.ended)return {ended:true,playing:false,estimated:false,remainingMs:0};
   if(this.current.interrupted)return {ended:false,playing:false,estimated:false,remainingMs:null};
   await this.sampleNeteaseUI();
   if(this.current?.ended)return {ended:true,playing:false,estimated:false,remainingMs:0};
   const state=await neteasePlayerState(this.current.page);
   if(state.songId!==this.current.songId||state.positionMs===null||!state.durationMs)return {ended:false,playing:false,estimated:false,remainingMs:null};
   return {ended:false,playing:state.playingClass||Date.now()-this.current.lastProgressAt<3000,estimated:false,remainingMs:Math.max(0,state.durationMs-state.positionMs)};
  }
  const {frame,src,durationMs,startedAt}=this.current;
  let ended=false,playing=false;
  try{
   const state=await frame.evaluate(source=>{
    const item=[...document.querySelectorAll('audio,video')].find(media=>(media.currentSrc||media.src)===source);
    return {ended:window.__songlistEndedSource===source||!!item?.ended,playing:!!item&&!item.paused&&item.readyState>=2};
   },src);
   ended=!!state?.ended;playing=!!state?.playing;
  }catch{}
  return {ended,playing,estimated:false,remainingMs:Math.max(0,durationMs-(Date.now()-startedAt))};
 }
}
