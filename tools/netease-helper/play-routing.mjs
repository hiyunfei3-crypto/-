import {playNetease,PlaybackAttemptError} from './netease-adapter.mjs';
import {playQQMusic} from './qq-adapter.mjs';

export async function playAcrossPlayers(title,artist='',adapters={netease:playNetease,qq:playQQMusic}){
 const attempts=artist?[
  ()=>adapters.netease(title,artist,false),()=>adapters.qq(title,artist,false),
  ()=>adapters.netease(title,artist,true),()=>adapters.qq(title,artist,true),
 ]:[()=>adapters.netease(title),()=>adapters.qq(title)];
 const failures=[];
 for(const attempt of attempts){
  try{return await attempt()}
  catch(error){
   if(!(error instanceof PlaybackAttemptError)||error.outcome!=='unavailable')throw error;
   failures.push(error.message);
  }
 }
 throw new PlaybackAttemptError(failures.join('；')||'两款播放器均无法播放','unavailable');
}
