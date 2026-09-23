import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join} from 'node:path';

export async function startPlayerCap(){
 const executable=process.env.PLAYER_CAP_EXE||join(import.meta.dirname,'playercap','Metabox-Nexus-PlayerCap.exe');
 if(!existsSync(executable))return {running:false,stop:async()=>{}};
 const child=spawn(executable,['-addr','127.0.0.1:8765'],{cwd:join(import.meta.dirname,'playercap'),windowsHide:true,stdio:'ignore'});
 child.unref();
 let owned=true;
 child.once('exit',()=>{owned=false});
 return {running:true,stop:()=>new Promise(resolve=>{if(!owned||child.killed)return resolve();child.once('exit',resolve);child.kill();setTimeout(resolve,1500)})};
}
