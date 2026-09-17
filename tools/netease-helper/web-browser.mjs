import {chromium} from 'playwright-core';
import {resolve,join} from 'node:path';

const profile=resolve(process.env.SONGLIST_MUSIC_PROFILE||join(import.meta.dirname,'.music-browser-profile'));
const home={netease:'https://music.163.com/',qqmusic:'https://y.qq.com/n/ryqq_v2/'};

export class MusicBrowser{
 constructor(){this.context=null;this.pages=new Map()}
 async start(){
  if(this.context)return;
  this.context=await chromium.launchPersistentContext(profile,{
   channel:'chrome',headless:false,viewport:null,
   args:['--autoplay-policy=no-user-gesture-required','--disk-cache-size=1048576','--media-cache-size=1048576'],
   ignoreDefaultArgs:['--mute-audio'],
  });
  for(const [source,url] of Object.entries(home)){
   const page=this.context.pages().find(item=>item.url().startsWith(new URL(url).origin))||await this.context.newPage();
   this.pages.set(source,page);
   if(page.url()==='about:blank')await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{});
  }
 }
 page(source){
  const page=this.pages.get(source);
  if(!page||page.isClosed())throw Error(`${source} 音乐网页已关闭，请重新启动助手`);
  return page;
 }
 async close(){await this.context?.close();this.context=null;this.pages.clear()}
 async state(){return Object.fromEntries([...this.pages].map(([source,page])=>[source,{url:page.url(),closed:page.isClosed()}]))}
}
