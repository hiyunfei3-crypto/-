'use strict';
const crypto = require('crypto');
const songIds = new Set(require('./song-ids.json'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const hmac = (secret,value) => crypto.createHmac('sha256',secret).update(value).digest('hex');
const normalize = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
const empty = () => ({copies:{},likes:{},wishes:[],nextWish:1});
const hostSecret = () => process.env.SONGLIST_HOST_PASSWORD || '';
const tokenSecret = () => process.env.SONGLIST_TOKEN_SECRET || hostSecret();
const makeToken = () => {const payload=Buffer.from(JSON.stringify({exp:Date.now()+12*60*60*1000})).toString('base64url');return payload+'.'+hmac(tokenSecret(),payload)};
const verifyToken = token => {try{const [payload,signature]=String(token||'').split('.');if(!payload||!signature||hmac(tokenSecret(),payload)!==signature)return false;return JSON.parse(Buffer.from(payload,'base64url')).exp>Date.now()}catch{return false}};
const publicSong = row => ({id:row.songId,title:row.title,note:row.note||'',url:row.url||'',isSC:!!row.isSC,active:row.active!==false});
async function readSongs(db,activeOnly){
 const result=[];let skip=0;
 while(true){let query=db.collection('songlist_songs');if(activeOnly)query=query.where({active:true});const page=await query.orderBy('songId','asc').skip(skip).limit(500).get();result.push(...page.data);if(page.data.length<500)break;skip+=page.data.length}
 return result.map(publicSong);
}
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
  if(!['state','login','like','copy','wish','vote','catalog','hostChallenge','hostLogin','hostSongs','addSong','setSongActive','setSongUrl','requestList','submitRequest','requestAction'].includes(action)) throw Error('未知操作');
  const db=uniCloud.database();
  if(action==='requestList'){
   const host=body.token&&verifyToken(body.token);
   const statuses=['pending','queued','active','paused'];
   const active=await db.collection('songlist_requests').where({status:db.command.in(statuses)}).orderBy('createdAt','asc').limit(200).get();
   let rows=active.data;
   if(host){const recent=await db.collection('songlist_requests').orderBy('createdAt','desc').limit(30).get();rows=[...new Map([...rows,...recent.data].map(row=>[row._id,row])).values()].sort((a,b)=>a.createdAt-b.createdAt)}
   const requests=rows.map(({_id,user,songId,songTitle,kind,status,createdAt,updatedAt})=>({id:_id,user,song:songId??null,songTitle,kind,status,createdAt,updatedAt}));
   return {requests,serverTime:Date.now()};
  }
  if(action==='submitRequest'){
   const user=normalize(body.user),kind=body.kind,fromCatalog=body.song!==undefined&&body.song!==null;
   if(!/^[\p{L}\p{N}_-]{3,40}$/u.test(user))throw Error('请先输入有效 ID');
   if(!['sing','play'].includes(kind))throw Error('点歌内容无效');
   let songId=null,songTitle='';
   if(fromCatalog){
    songId=Number(body.song);
    if(!Number.isInteger(songId)||songId<1)throw Error('歌曲编号无效');
    const song=await db.collection('songlist_songs').where({songId,active:true}).limit(1).get();
    if(!song.data.length)throw Error('歌曲已下架或不存在');
    songTitle=song.data[0].title;
   }else{
    if(typeof body.title!=='string')throw Error('请输入歌名');
    songTitle=normalize(body.title);
    if(!songTitle||songTitle.length>100||/[\p{Cc}\p{Cf}]/u.test(songTitle))throw Error('歌名需为 1–100 个有效字符');
   }
   const requestId=String(body.requestId||'');if(!/^[a-f0-9-]{36}$/i.test(requestId))throw Error('点歌请求无效');
   const previous=await db.collection('songlist_requests').doc(requestId).get();
   if(previous.data.length)return {request:{id:requestId,status:previous.data[0].status}};
   const recent=await db.collection('songlist_requests').where({user,status:db.command.in(['pending','queued','active','paused'])}).limit(200).get();
   if(recent.data.some(row=>row.songId!=null&&row.songId===songId||normalize(row.songTitle).toLocaleLowerCase()===normalize(songTitle).toLocaleLowerCase()))throw Error('你已经点过这首歌了，请等待主播处理');
   const now=Date.now(),row={_id:requestId,user,...(songId===null?{}:{songId}),songTitle,kind,status:'pending',createdAt:now,updatedAt:now};
   await db.collection('songlist_requests').add(row);
   return {request:{id:requestId,user,song:songId,songTitle:row.songTitle,kind,status:'pending',createdAt:now}};
  }
  if(action==='requestAction'){
   if(!verifyToken(body.token))throw Error('主播登录已过期，请重新登录');
   const requestId=String(body.requestId||''),status=String(body.status||'');
   if(!/^[a-f0-9-]{36}$/i.test(requestId))throw Error('请求编号无效');
   const transitions={pending:['queued','rejected'],queued:['active','done'],active:['paused','done'],paused:['active','done']};
   const ref=db.collection('songlist_requests').doc(requestId),result=await ref.get(),row=result.data[0];
   if(!row)throw Error('点歌请求不存在');
   if(row.status===status)return {ok:true,status};
   if(!transitions[row.status]?.includes(status))throw Error('请求状态已变化，请刷新待播单');
   if(status==='active'){const current=await db.collection('songlist_requests').where({status:'active'}).limit(1).get();if(current.data.some(item=>item._id!==requestId))throw Error('请先完成正在进行的歌曲')}
   await ref.update({status,updatedAt:Date.now()});return {ok:true,status};
  }
  if(action==='catalog'){const list=await readSongs(db,true);return {songs:list,version:list.reduce((value,song)=>Math.max(value,song.id),0)}}
  if(action==='hostChallenge'){
   if(!hostSecret()||!tokenSecret())throw Error('主播密码尚未在云函数环境变量中配置');
   const challengeId=crypto.randomBytes(18).toString('hex'),nonce=crypto.randomBytes(32).toString('hex');
   await db.collection('songlist_host_challenges').add({_id:challengeId,nonce,expiresAt:Date.now()+60000});return {challengeId,nonce};
  }
  if(action==='hostLogin'){
   const challengeId=String(body.challengeId||''),proof=String(body.proof||'');const result=await db.collection('songlist_host_challenges').doc(challengeId).get();const challenge=result.data[0];
   if(challenge)await db.collection('songlist_host_challenges').doc(challengeId).remove();
   const expected=challenge?hmac(hostSecret(),challenge.nonce):'';const valid=challenge&&challenge.expiresAt>Date.now()&&proof.length===expected.length&&crypto.timingSafeEqual(Buffer.from(proof),Buffer.from(expected));
   if(!valid)throw Error('主播密码不正确');return {token:makeToken(),expiresIn:43200};
  }
  if(['hostSongs','addSong','setSongActive','setSongUrl'].includes(action)){
   if(!verifyToken(body.token))throw Error('主播登录已过期，请重新登录');
   if(action==='hostSongs'){const list=await readSongs(db,false);return {songs:list,version:list.reduce((value,song)=>Math.max(value,song.id),0)}}
   if(action==='addSong'){
    const title=normalize(body.title),note=normalize(body.note),url=normalize(body.url);if(!title||title.length>100||note.length>200)throw Error('请填写有效的歌名和备注');
    if(url&&(!/^https?:\/\/\S+$/i.test(url)||url.length>500))throw Error('视频链接必须是有效的 HTTP 或 HTTPS 地址');
    const duplicate=await db.collection('songlist_songs').where({title}).limit(1).get();if(duplicate.data.length)throw Error('歌单中已经存在同名歌曲');
    const last=await db.collection('songlist_songs').orderBy('songId','desc').limit(1).get(),songId=(last.data[0]?.songId||0)+1,now=Date.now();
    await db.collection('songlist_songs').add({songId,title,note,url,isSC:!!body.isSC,active:true,createdAt:now,updatedAt:now});return {song:{id:songId,title,note,url,isSC:!!body.isSC,active:true}};
   }
   const songId=Number(body.songId);if(!Number.isInteger(songId))throw Error('歌曲操作无效');
   const target=await db.collection('songlist_songs').where({songId}).limit(1).get();if(!target.data.length)throw Error('歌曲不存在');
   if(action==='setSongUrl'){const url=normalize(body.url);if(url&&(!/^https?:\/\/\S+$/i.test(url)||url.length>500))throw Error('视频链接必须是有效的 HTTP 或 HTTPS 地址');await db.collection('songlist_songs').doc(target.data[0]._id).update({url,updatedAt:Date.now()});return {ok:true,url}}
   if(typeof body.active!=='boolean')throw Error('歌曲操作无效');
   await db.collection('songlist_songs').doc(target.data[0]._id).update({active:body.active,updatedAt:Date.now()});return {ok:true};
  }
  const id=normalize(body.id);
  if(id && !/^[\p{L}\p{N}_-]{3,40}$/u.test(id)) throw Error('ID须为3–40个字母、数字、中文、下划线或短横线');
  if(!id && !['state','copy'].includes(action)) throw Error('请先输入ID进入');
  if(['like','copy'].includes(action) && !songIds.has(body.song)) {const song=await db.collection('songlist_songs').where({songId:body.song,active:true}).limit(1).get();if(!song.data.length)throw Error('歌曲无效')}
  if(['like','vote'].includes(action) && typeof body.active!=='boolean') throw Error('操作无效');
  if(action==='copy' && !/^[-\w]{16,80}$/.test(body.event || '')) throw Error('点歌记录无效');
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
