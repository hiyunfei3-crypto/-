'use strict';
const crypto = require('crypto');
const songIds = new Set(require('./song-ids.json'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const normalize = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
const empty = () => ({copies:{},likes:{},wishes:[],nextWish:1});
function snapshot(id, profile, stats) {
 const rank = map => Object.entries(map).filter(([,count])=>count>0).map(([song,count])=>({song:Number(song),count})).sort((a,b)=>b.count-a.count || a.song-b.song);
 return {id,favorites:profile.favorites || [],supported:profile.supported || [],copies:rank(stats.copies),likes:rank(stats.likes),wishes:[...stats.wishes].sort((a,b)=>b.count-a.count || a.id-b.id).map(({key,...wish})=>wish)};
}
exports.main = async event => {
 try {
  const action = event && event.action;
  const body = event && event.body || {};
  if(JSON.stringify(body).length>16000) throw Error('请求太大');
  if(action==='health') return {ok:true,version:1};
  if(!['state','login','like','copy','wish','vote'].includes(action)) throw Error('未知操作');
  const id=normalize(body.id);
  if(id && !/^[\p{L}\p{N}_-]{3,40}$/u.test(id)) throw Error('ID须为3–40个字母、数字、中文、下划线或短横线');
  if(!id && !['state','copy'].includes(action)) throw Error('请先输入ID进入');
  if(['like','copy'].includes(action) && !songIds.has(body.song)) throw Error('歌曲无效');
  if(['like','vote'].includes(action) && typeof body.active!=='boolean') throw Error('操作无效');
  if(action==='copy' && !/^[-\w]{16,80}$/.test(body.event || '')) throw Error('点歌记录无效');
  const db=uniCloud.database();
  const profileKey=id ? hash(id) : '';
  if(action==='state') {
   const statsRes=await db.collection('songlist_stats').doc('community').get();
   const userRes=id ? await db.collection('songlist_profiles').doc(profileKey).get() : {data:[]};
   return snapshot(id,userRes.data[0] || {},statsRes.data[0] || empty());
  }
  const tx=await db.startTransaction();
  try {
   const statsRef=tx.collection('songlist_stats').doc('community');
   const statsResult=await statsRef.get();
   const stats=statsResult.data || empty();
   const profileRef=id ? tx.collection('songlist_profiles').doc(profileKey) : null;
   const userResult=profileRef ? await profileRef.get() : {data:null};
   const profile=userResult.data || {favorites:[],supported:[]};
   let statsChanged=false;
   const like=(song,active)=>{
    const present=profile.favorites.includes(song);
    if(present===active)return;
    profile.favorites=active ? [...profile.favorites,song] : profile.favorites.filter(s=>s!==song);
    stats.likes[song]=Math.max(0,(stats.likes[song] || 0)+(active?1:-1));statsChanged=true;
   };
   const vote=(wish,active)=>{
    const present=profile.supported.includes(wish.id);
    if(present===active)return;
    profile.supported=active ? [...profile.supported,wish.id] : profile.supported.filter(w=>w!==wish.id);
    wish.count=Math.max(0,wish.count+(active?1:-1));statsChanged=true;
   };
   if(action==='login') for(const song of [...new Set(Array.isArray(body.merge)?body.merge:[])]) {if(songIds.has(song))like(song,true)}
   if(action==='like')like(body.song,body.active);
   if(action==='vote') {const wish=stats.wishes.find(w=>w.id===body.wish);if(!wish)throw Error('许愿不存在');vote(wish,body.active)}
   if(action==='wish') {
    const title=normalize(body.title),artist=normalize(body.artist);
    if(!title || title.length>100 || artist.length>80)throw Error('请填写有效歌名');
    const key=hash(JSON.stringify([title.toLowerCase(),artist.toLowerCase()]));
    let wish=stats.wishes.find(w=>w.key===key);
    if(!wish){if(stats.wishes.length>=200)throw Error('许愿列表已满，请先支持已有许愿');wish={id:stats.nextWish++,title,artist,key,count:0};stats.wishes.push(wish);statsChanged=true}
    vote(wish,true);
   }
   if(action==='copy') {
    const eventKey=hash(body.event);
    const previous=await tx.collection('songlist_events').doc(eventKey).get();
    if(!previous.data){await tx.collection('songlist_events').add({_id:eventKey,song:body.song,createdAt:Date.now()});stats.copies[body.song]=(stats.copies[body.song] || 0)+1;statsChanged=true}
   }
   if(statsChanged) {
    const {_id,...data}=stats;
    if(statsResult.data)await statsRef.update(data);else await tx.collection('songlist_stats').add({_id:'community',...data});
   }
   if(profileRef) {
    const {_id,...data}=profile;
    if(userResult.data)await profileRef.update(data);else await tx.collection('songlist_profiles').add({_id:profileKey,...data});
   }
   await tx.commit();
   return snapshot(id,profile,stats);
  } catch(error) {await tx.rollback();throw error}
 } catch(error) {return {error:error.message || '云端暂时不可用'}}
};
