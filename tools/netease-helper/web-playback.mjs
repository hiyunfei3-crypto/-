import {findSong,PlaybackAttemptError} from './netease-adapter.mjs';

const normalize=value=>String(value||'').normalize('NFKC').trim().toLocaleLowerCase();
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const qqSearch='https://y.qq.com/n/ryqq_v2/search';

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
 constructor(browser){this.browser=browser;this.current=null}
 async stopAll(){
  for(const source of ['netease','qqmusic']){
   const origin=source==='netease'?'https://music.163.com':'https://y.qq.com';
   for(const page of this.browser.context.pages().filter(item=>item.url().startsWith(origin))){
    for(const frame of page.frames()){
     try{await frame.evaluate(()=>[...document.querySelectorAll('audio,video')].forEach(item=>item.pause()))}catch{}
    }
   }
  }
 }
 async qq(title,artist='',cover=false){
  const page=this.browser.page('qqmusic');
  const query=new URL(qqSearch);query.searchParams.set('w',artist&&!cover?`${title} ${artist}`:title);query.searchParams.set('t','song');
  await page.goto(query.toString(),{waitUntil:'domcontentloaded',timeout:30000});
  try{await page.locator('.songlist__item').first().waitFor({state:'visible',timeout:15000})}
  catch{
   const text=await page.locator('body').innerText().catch(()=>'');
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
  try{await frame.locator('.u-btni-play').first().click({timeout:15000})}
  catch{throw new PlaybackAttemptError('网易云网页未提供可操作的播放按钮，请检查登录状态','unknown')}
  const media=await confirmedMedia(this.browser,'netease',before);
  if(!media){
   const text=await page.locator('body').innerText().catch(()=>'');
   if(/暂无版权|因合作方要求|VIP.*才能|开通.*会员/.test(text))throw new PlaybackAttemptError('网易云网页提示版权或会员限制','unavailable');
   throw new PlaybackAttemptError('网易云已收到播放指令，但未确认目标音频开始播放','unknown');
  }
  await watchEnd(media);
  this.current={source:'netease',src:media.src,frame:media.frame,startedAt:Date.now(),durationMs:media.duration*1000};
  return {ok:true,player:'netease',matchedTitle:song.name,artist:(song.artists||[]).map(item=>item.name).join(' / '),durationMs:media.duration*1000,ambiguous:!!song.ambiguous,verification:'html-media-progress'};
 }
 async status(){
  if(!this.current)return {ended:false,estimated:false,remainingMs:null};
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
