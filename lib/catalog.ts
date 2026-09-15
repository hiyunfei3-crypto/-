import {cloudCall} from './unicloud';
import {songs as fallbackSongs,type Song} from './songs';

const cacheKey='jiuju-song-catalog-v1';
export type CatalogSong=Song&{active:boolean;note:string;isSC:boolean};
export type CatalogResponse={songs:CatalogSong[];version:number;error?:string};

export function cachedCatalog():CatalogSong[]{
 try{const value=JSON.parse(localStorage.getItem(cacheKey)||'null');if(Array.isArray(value)&&value.length)return value}catch{}
 return fallbackSongs.map(song=>({...song,note:song.note||'',isSC:song.isSC??/\(sc\)$/i.test(song.title),active:true}));
}
export async function loadCatalog(includeInactive=false,token=''):Promise<CatalogResponse>{
 const result=await cloudCall(includeInactive?'hostSongs':'catalog',token?{token}:{});
 if(result?.error)throw Error(result.error);
 if(!Array.isArray(result?.songs))throw Error('歌曲目录返回格式不正确');
 if(!includeInactive)try{localStorage.setItem(cacheKey,JSON.stringify(result.songs))}catch{}
 return result;
}
export async function hostCatalogAction(action:'addSong'|'setSongActive',body:Record<string,unknown>){
 const result=await cloudCall(action,body);if(result?.error)throw Error(result.error);return result;
}
export async function hostAuthenticate(password:string){
 const challenge=await cloudCall('hostChallenge',{});if(challenge?.error)throw Error(challenge.error);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signed=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(challenge.nonce));
 const proof=Array.from(new Uint8Array(signed),byte=>byte.toString(16).padStart(2,'0')).join('');
 const result=await cloudCall('hostLogin',{challengeId:challenge.challengeId,proof});if(result?.error)throw Error(result.error);return result;
}
