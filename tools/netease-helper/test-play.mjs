import {randomUUID} from 'node:crypto';

const [code,title,artist='']=process.argv.slice(2);
if(!code||!title){
 console.error('用法：node tools/netease-helper/test-play.mjs <配对码> "歌曲名" ["原唱歌手"]');
 process.exit(2);
}
try{
 const response=await fetch('http://127.0.0.1:43871/play',{
  method:'POST',
  headers:{Origin:'http://localhost:5180','Content-Type':'application/json','X-Host-Code':code},
  body:JSON.stringify({requestId:randomUUID(),title,artist}),
  signal:AbortSignal.timeout(90000),
 });
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'播放失败');
 console.log(`客户端已切换到：${result.matchedTitle}${result.artist?` · ${result.artist}`:''}（${result.player==='qqmusic'?'QQ 音乐':'网易云'}${result.songId?`，歌曲 ID：${result.songId}`:''}）`);
}catch(error){
 console.error(error.message);
 process.exitCode=1;
}
