import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
mkdirSync(new URL('../work/', import.meta.url), { recursive: true });
const db = new DatabaseSync(process.env.COMMUNITY_DB || new URL('../work/community.sqlite', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS likes(profile TEXT, song INTEGER, PRIMARY KEY(profile,song));
CREATE TABLE IF NOT EXISTS copies(event TEXT PRIMARY KEY, song INTEGER);
CREATE TABLE IF NOT EXISTS wishes(id INTEGER PRIMARY KEY, title TEXT, artist TEXT, key TEXT UNIQUE, creator TEXT);
CREATE TABLE IF NOT EXISTS votes(profile TEXT, wish INTEGER, PRIMARY KEY(profile,wish));`);
const songIds = new Set([...readFileSync(new URL('../lib/songs.ts', import.meta.url),'utf8').matchAll(/"id":\s*(\d+)/g)].map(m=>Number(m[1])));
const normalize = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g,' ');
const allowed = new Set((process.env.COMMUNITY_ORIGINS || 'http://localhost:5173,http://localhost:4173').split(','));
function profile(id) { if (!/^[\p{L}\p{N}_-]{3,40}$/u.test(id)) throw Error('ID须为3–40个字母、数字、中文、下划线或短横线'); }
function snapshot(id) { return { id, favorites: db.prepare('SELECT song FROM likes WHERE profile=?').all(id).map(r=>r.song), supported:db.prepare('SELECT wish FROM votes WHERE profile=?').all(id).map(r=>r.wish), copies:db.prepare('SELECT song,COUNT(*) AS count FROM copies GROUP BY song ORDER BY count DESC,song').all(), likes:db.prepare('SELECT song,COUNT(*) AS count FROM likes GROUP BY song ORDER BY count DESC,song').all(), wishes:db.prepare('SELECT w.id,w.title,w.artist,COUNT(v.profile) AS count FROM wishes w LEFT JOIN votes v ON w.id=v.wish GROUP BY w.id ORDER BY count DESC,w.id').all() }; }
createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(origin && !allowed.has(origin)){res.writeHead(403);res.end();return;}
 if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Cache-Control','no-store');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 try {
  const url=new URL(req.url,'http://localhost'); let b={};
  if(req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16000)throw Error('请求太大');}b=JSON.parse(raw);}
  const id=normalize(b.id ?? url.searchParams.get('id')); if(id)profile(id);
  if(req.method==='POST'){
   if(url.pathname!=='/api/copy' && !id)throw Error('请先输入ID进入');
   db.exec('BEGIN IMMEDIATE');
   try{
    if(id)db.prepare('INSERT OR IGNORE INTO profiles VALUES(?)').run(id);
    if(url.pathname==='/api/login'){
     for(const song of Array.isArray(b.merge)?b.merge:[])if(songIds.has(song))db.prepare('INSERT OR IGNORE INTO likes VALUES(?,?)').run(id,song);
    }else if(url.pathname==='/api/like'){
     if(!songIds.has(b.song)||typeof b.active!=='boolean')throw Error('歌曲无效');
     db.prepare(b.active?'INSERT OR IGNORE INTO likes VALUES(?,?)':'DELETE FROM likes WHERE profile=? AND song=?').run(id,b.song);
    }else if(url.pathname==='/api/copy'){
     if(!songIds.has(b.song)||!/^[-\w]{16,80}$/.test(b.event||''))throw Error('点歌记录无效');
     db.prepare('INSERT OR IGNORE INTO copies VALUES(?,?)').run(b.event,b.song);
    }else if(url.pathname==='/api/wish'){
     const title=normalize(b.title),artist=normalize(b.artist);if(!title||title.length>100||artist.length>80)throw Error('请填写有效歌名（100字以内）');
     const key=JSON.stringify([title.toLowerCase(),artist.toLowerCase()]);
     db.prepare('INSERT OR IGNORE INTO wishes(title,artist,key,creator) VALUES(?,?,?,?)').run(title,artist,key,id);
     const wish=db.prepare('SELECT id FROM wishes WHERE key=?').get(key).id;
     db.prepare('INSERT OR IGNORE INTO votes VALUES(?,?)').run(id,wish);
    }else if(url.pathname==='/api/vote'){
     if(!db.prepare('SELECT id FROM wishes WHERE id=?').get(b.wish)||typeof b.active!=='boolean')throw Error('许愿不存在');
     db.prepare(b.active?'INSERT OR IGNORE INTO votes VALUES(?,?)':'DELETE FROM votes WHERE profile=? AND wish=?').run(id,b.wish);
    }else throw Error('未知操作');
    db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}
  }else if(req.method!=='GET'||url.pathname!=='/api/state')throw Error('未知操作');
  res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(snapshot(id)));
 }catch(e){res.writeHead(400,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:e.message}));}
}).listen(Number(process.env.PORT||8788),'127.0.0.1',()=>console.log('Community API listening on 127.0.0.1:'+ (process.env.PORT||8788)));
