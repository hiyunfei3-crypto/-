import {MusicBrowser} from './web-browser.mjs';

const browser=new MusicBrowser();
await browser.start();
console.log('专用音乐浏览器已打开。请分别登录网易云音乐与 QQ 音乐；保持此窗口运行。');
process.on('SIGINT',()=>void browser.close());
setInterval(()=>{},60000);
