type BmobRow = {
 objectId: string;
 [key: string]: unknown;
};

export type Community = {
 id: string;
 favorites: number[];
 supported: string[];
 copies: { song: number; count: number }[];
 likes: { song: number; count: number }[];
 wishes: { id: string; title: string; artist: string; count: number }[];
};

type Env = Record<string, string | undefined>;

const env = (import.meta as ImportMeta & { env: Env }).env ?? {};
// Application ID and REST API Key are the public client credentials Bmob uses
// for REST requests. The Secret Key is deliberately not used here.
const appId = env.VITE_BMOB_APP_ID || '50e389a13b61e42e885cd8279a712040';
const restKey = env.VITE_BMOB_REST_KEY || '075ce899806b859d2f1e17be565150a0';
const apiRoot = (env.VITE_BMOB_API || 'https://api.bmob.cn').replace(/\/+$/, '') + '/1';

const jsonHeaders = {
 'X-Bmob-Application-Id': appId,
 'X-Bmob-REST-API-Key': restKey,
 'Content-Type': 'application/json',
};

function queryWhere(where: Record<string, unknown>) {
 return encodeURIComponent(JSON.stringify(where));
}

async function bmob<T = BmobRow>(table: string, init: RequestInit = {}): Promise<T> {
 const response = await fetch(`${apiRoot}/classes/${table}`, {
  ...init,
  headers: { ...jsonHeaders, ...(init.headers || {}) },
  signal: init.signal || AbortSignal.timeout(12000),
 });
 const text = await response.text();
 let payload: unknown = {};
 try { payload = text ? JSON.parse(text) : {}; } catch { /* handled below */ }
 if (!response.ok) {
  const message = typeof payload === 'object' && payload && 'error' in payload
   ? String((payload as { error?: unknown }).error)
   : `Bmob 请求失败（${response.status}）`;
  throw Error(message);
 }
 return payload as T;
}

async function findWhere(table: string, where: Record<string, unknown> = {}) {
 const suffix = `?where=${queryWhere(where)}&limit=1000`;
 return (await bmob<{ results?: BmobRow[] }>(`${table}${suffix}`, { method: 'GET' })).results || [];
}

async function create(table: string, data: Record<string, unknown>) {
 return bmob<BmobRow>(table, { method: 'POST', body: JSON.stringify(data) });
}

async function remove(table: string, objectId: string) {
 await bmob(`${table}/${encodeURIComponent(objectId)}`, { method: 'DELETE' });
}

function numberValue(row: BmobRow, key: string) {
 const value = row[key];
 return typeof value === 'number' ? value : Number(value);
}

function stringValue(row: BmobRow, key: string) {
 return typeof row[key] === 'string' ? String(row[key]) : '';
}

async function ensureProfile(id: string) {
 const rows = await findWhere('profiles', { id });
 if (!rows.length) await create('profiles', { id });
}

async function upsertLike(id: string, song: number, active: boolean) {
 const rows = await findWhere('likes', { profile: id, song });
 if (active) { if (!rows.length) await create('likes', { profile: id, song }); }
 else { await Promise.all(rows.map(row => remove('likes', row.objectId))); }
}

async function upsertVote(id: string, wish: string, active: boolean) {
 const rows = await findWhere('votes', { profile: id, wish });
 if (active) { if (!rows.length) await create('votes', { profile: id, wish }); }
 else { await Promise.all(rows.map(row => remove('votes', row.objectId))); }
}

async function snapshot(id: string): Promise<Community> {
 const [likeRows, copyRows, wishRows, voteRows] = await Promise.all([
  findWhere('likes'),
  findWhere('copies'),
  findWhere('wishes'),
  findWhere('votes'),
 ]);
 const favorites = id
  ? likeRows.filter(row => stringValue(row, 'profile') === id).map(row => numberValue(row, 'song')).filter(Number.isFinite)
  : [];
 const supported = id
  ? voteRows.filter(row => stringValue(row, 'profile') === id).map(row => stringValue(row, 'wish')).filter(Boolean)
  : [];
 const counts = (rows: BmobRow[], key: string) => {
  const map = new Map<number, number>();
  for (const row of rows) {
   const value = numberValue(row, key);
   if (Number.isFinite(value)) map.set(value, (map.get(value) || 0) + 1);
  }
  return [...map.entries()].map(([song, count]) => ({ song, count })).sort((a, b) => b.count - a.count || a.song - b.song);
 };
 const wishCount = new Map<string, number>();
 for (const row of voteRows) {
  const wish = stringValue(row, 'wish');
  if (wish) wishCount.set(wish, (wishCount.get(wish) || 0) + 1);
 }
 const wishes = wishRows.map(row => ({
  id: row.objectId,
  title: stringValue(row, 'title'),
  artist: stringValue(row, 'artist'),
  count: wishCount.get(row.objectId) || 0,
 })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
 return { id, favorites, supported, copies: counts(copyRows, 'song'), likes: counts(likeRows, 'song'), wishes };
}

function normalize(value: unknown) {
 return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
}

export async function community(path: string, body: Record<string, unknown> = {}): Promise<Community> {
 const [action, query = ''] = path.split('?');
 const params = new URLSearchParams(query);
 const id = normalize(body.id ?? params.get('id'));
 if (action === 'state') return snapshot(id);
 if (action === 'copy') {
  const song = Number(body.song);
  const event = normalize(body.event);
  if (!Number.isFinite(song) || !event) throw Error('点歌记录无效');
  if (!(await findWhere('copies', { event })).length) await create('copies', { event, song });
  return snapshot(id);
 }
 if (!id || !/^[\p{L}\p{N}_-]{3,40}$/u.test(id)) throw Error('ID须为3–40个字母、数字、中文、下划线或短横线');

 await ensureProfile(id);
 if (action === 'login') {
  const merge = Array.isArray(body.merge) ? body.merge : [];
  for (const song of merge) if (Number.isFinite(Number(song))) await upsertLike(id, Number(song), true);
 } else if (action === 'like') {
  const song = Number(body.song);
  if (!Number.isFinite(song) || typeof body.active !== 'boolean') throw Error('歌曲参数无效');
  await upsertLike(id, song, body.active);
 } else if (action === 'wish') {
  const title = normalize(body.title);
  const artist = normalize(body.artist);
  if (!title || title.length > 100 || artist.length > 80) throw Error('请填写有效歌名（100字以内）');
  const wishKey = JSON.stringify([title.toLowerCase(), artist.toLowerCase()]);
  let wish = (await findWhere('wishes', { wishKey }))[0];
  if (!wish) wish = await create('wishes', { title, artist, wishKey, creator: id });
  await upsertVote(id, wish.objectId, true);
 } else if (action === 'vote') {
  const wish = normalize(body.wish);
  if (!wish || typeof body.active !== 'boolean') throw Error('许愿参数无效');
  await upsertVote(id, wish, body.active);
 } else {
  throw Error('未知操作');
 }
 return snapshot(id);
}
