export type Community = { id:string; favorites:number[]; supported:number[]; copies:{song:number;count:number}[]; likes:{song:number;count:number}[]; wishes:{id:number;title:string;artist:string;count:number}[] };
import {cloudCall} from './unicloud';
export async function community(path:string, body?:Record<string,unknown>):Promise<Community> {
 if((import.meta as ImportMeta & {env:Record<string,string>}).env.VITE_COMMUNITY_PROVIDER!=='cloudflare'){
  const [action,query]=path.split('?');
  return cloudCall(action,body || {id:new URLSearchParams(query).get('id') || ''});
 }
 const base=(import.meta as ImportMeta & {env:Record<string,string>}).env?.VITE_COMMUNITY_API || 'https://jiuju-community.jiuju-gedan.workers.dev';
 const r=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
 if(!(r.headers.get('content-type')||'').includes('application/json'))throw Error('共享服务尚未连接，请稍后再试');
 const data=await r.json() as Community & {error?:string};if(!r.ok)throw Error(data.error||'保存失败');return data;
}
