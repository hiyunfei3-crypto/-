import {songs} from '../lib/songs';
const ids=new Set(songs.map(s=>s.id));
const normalize=(v:unknown)=>String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ');
export default {async fetch(req:Request,env:{DB:D1Database}){
 const origin=req.headers.get('Origin');
 const allowed=['https://hiyunfei3-crypto.github.io','http://localhost:5173','http://127.0.0.1:5173'];
 const headers:Record<string,string>={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
 if(origin&&!allowed.includes(origin))return new Response('Forbidden',{status:403});
 if(origin)headers['Access-Control-Allow-Origin']=origin;
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 const db=env.DB;
 try{
  const url=new URL(req.url);let b:Record<string,any>={};
  if(req.method==='POST'){const raw=await req.text();if(raw.length>16000)throw Error('请求太大');b=JSON.parse(raw);}
  const id=normalize(b.id??url.searchParams.get('id'));
  if(id&&!/^[\p{L}\p{N}_-]{3,40}$/u.test(id))throw Error('ID须为3–40个字母、数字、中文、下划线或短横线');
  const sql=(s:string,...v:any[])=>db.prepare(s).bind(...v);
  if(req.method==='POST'){
   if(url.pathname!=='/api/copy'&&!id)throw Error('请先输入ID进入');
   const writes:D1PreparedStatement[]=[];
   if(id)writes.push(sql('INSERT OR IGNORE INTO profiles VALUES(?)',id));
   if(url.pathname==='/api/login'){
    const merge=Array.isArray(b.merge)?[...new Set(b.merge)].filter(s=>ids.has(s)):[];
    for(const s of merge)writes.push(sql('INSERT OR IGNORE INTO likes VALUES(?,?)',id,s));
   }else if(url.pathname==='/api/like'){
    if(!ids.has(b.song)||typeof b.active!=='boolean')throw Error('歌曲无效');
    writes.push(sql(b.active?'INSERT OR IGNORE INTO likes VALUES(?,?)':'DELETE FROM likes WHERE profile=? AND song=?',id,b.song));
   }else if(url.pathname==='/api/copy'){
    if(!ids.has(b.song)||!/^[-\w]{16,80}$/.test(b.event||''))throw Error('点歌记录无效');
    writes.push(sql('INSERT OR IGNORE INTO copies VALUES(?,?)',b.event,b.song));
   }else if(url.pathname==='/api/wish'){
    const title=normalize(b.title),artist=normalize(b.artist);if(!title||title.length>100||artist.length>80)throw Error('请填写有效歌名');
    const key=JSON.stringify([title.toLowerCase(),artist.toLowerCase()]);
    writes.push(sql('INSERT OR IGNORE INTO wishes(title,artist,key,creator) VALUES(?,?,?,?)',title,artist,key,id),sql('INSERT OR IGNORE INTO votes SELECT ?,id FROM wishes WHERE key=?',id,key));
   }else if(url.pathname==='/api/vote'){
    if(!Number.isInteger(b.wish)||typeof b.active!=='boolean'||!await sql('SELECT id FROM wishes WHERE id=?',b.wish).first())throw Error('许愿不存在');
    writes.push(sql(b.active?'INSERT OR IGNORE INTO votes VALUES(?,?)':'DELETE FROM votes WHERE profile=? AND wish=?',id,b.wish));
   }else throw Error('未知操作');
   if(writes.length)await db.batch(writes);
  }else if(req.method!=='GET'||url.pathname!=='/api/state')throw Error('未知操作');
  const results=await db.batch<Record<string,unknown>>([
   sql('SELECT song FROM likes WHERE profile=?',id),sql('SELECT wish FROM votes WHERE profile=?',id),
   sql('SELECT song,COUNT(*) AS count FROM copies GROUP BY song ORDER BY count DESC,song'),
   sql('SELECT song,COUNT(*) AS count FROM likes GROUP BY song ORDER BY count DESC,song'),
   sql('SELECT w.id,w.title,w.artist,COUNT(v.profile) AS count FROM wishes w LEFT JOIN votes v ON w.id=v.wish GROUP BY w.id ORDER BY count DESC,w.id')
  ]);
  return new Response(JSON.stringify({id,favorites:results[0].results.map(r=>r.song),supported:results[1].results.map(r=>r.wish),copies:results[2].results,likes:results[3].results,wishes:results[4].results}),{headers});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:'服务暂时不可用'}),{status:400,headers});}
}};
