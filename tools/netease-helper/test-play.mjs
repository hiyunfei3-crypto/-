import {randomUUID} from 'node:crypto';

const [code,title,artist='']=process.argv.slice(2);
if(!code||!title){
 console.error('用法：node tools/netease-helper/test-play.mjs <配对码> "歌曲名" ["原唱歌手"]');
 process.exit(2);
}
try{
 const pair=await fetch('http://127.0.0.1:43871/pair',{
  method:'POST',headers:{Origin:'http://localhost:5181','X-Host-Code':code},signal:AbortSignal.timeout(5000),
 });
 const paired=await pair.json();
 if(!pair.ok||!paired.deviceToken)throw Error(paired.error||'配对失败');
 const response=await fetch('http://127.0.0.1:43871/play',{
  method:'POST',
  headers:{Origin:'http://localhost:5181','Content-Type':'application/json','X-Device-Token':paired.deviceToken},
  body:JSON.stringify({requestId:randomUUID(),title,artist}),
  signal:AbortSignal.timeout(90000),
 });
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'播放失败');
 console.log(`网页已确认播放：${result.matchedTitle}${result.artist?` · ${result.artist}`:''}（${result.player==='qqmusic'?'QQ 音乐':'网易云'}）`);
}catch(error){
 console.error(error.message);
 process.exitCode=1;
}
