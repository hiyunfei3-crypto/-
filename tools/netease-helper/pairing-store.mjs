import {randomBytes,timingSafeEqual} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';

const tokenPattern=/^[a-f0-9]{64}$/;
export const pairingFile=join(process.env.LOCALAPPDATA||import.meta.dirname,'SonglistMusicHelper','paired-devices.json');

export class PairingStore{
 constructor(path=pairingFile){this.path=path;this.tokens=this.read()}
 read(){
  try{
   if(!existsSync(this.path))return {};
   const data=JSON.parse(readFileSync(this.path,'utf8'));
   if(!data||typeof data!=='object'||Array.isArray(data))return {};
   return Object.fromEntries(Object.entries(data).filter(([origin])=>/^https?:\/\//.test(origin)).map(([origin,tokens])=>[origin,(Array.isArray(tokens)?tokens:[tokens]).filter(token=>typeof token==='string'&&tokenPattern.test(token))]));
  }catch{return {}}
 }
 save(){
  mkdirSync(dirname(this.path),{recursive:true});
  const temporary=this.path+'.tmp-'+process.pid;
  writeFileSync(temporary,JSON.stringify(this.tokens),{encoding:'utf8',mode:0o600});
  renameSync(temporary,this.path);
 }
 issue(origin){const token=randomBytes(32).toString('hex');this.tokens[origin]=[...(this.tokens[origin]||[]),token];this.save();return token}
 valid(origin,token){
  if(typeof token!=='string'||!tokenPattern.test(token))return false;
  return (this.tokens[origin]||[]).some(saved=>timingSafeEqual(Buffer.from(saved),Buffer.from(token)));
 }
 revoke(origin,token){if(!this.valid(origin,token))return false;this.tokens[origin]=this.tokens[origin].filter(saved=>saved!==token);if(!this.tokens[origin].length)delete this.tokens[origin];this.save();return true}
}
