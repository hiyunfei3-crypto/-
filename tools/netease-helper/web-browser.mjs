import {chromium} from 'playwright-core';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';

const profile=resolve(process.env.SONGLIST_MUSIC_PROFILE||join(import.meta.dirname,'.music-browser-profile'));
const home={netease:'https://music.163.com/',qqmusic:'https://y.qq.com/n/ryqq_v2/'};

function installed(path){return Boolean(path&&existsSync(path))}
function defaultBrowserProgId(){
 try{return execFileSync('reg.exe',['query','HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice','/v','ProgId'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore']}).match(/ProgId\s+REG_SZ\s+(\S+)/i)?.[1]||''}catch{return ''}
}
export function selectBrowserChannel(progId=defaultBrowserProgId(),env=process.env){
 const programFilesX86=env['ProgramFiles(x86)']||env.PROGRAMFILES_X86||'';
 const programFiles=env.ProgramFiles||env.PROGRAMFILES||'';
 const edgePath=programFilesX86?join(programFilesX86,'Microsoft','Edge','Application','msedge.exe'):'';
 const chromePath=programFiles?join(programFiles,'Google','Chrome','Application','chrome.exe'):'';
 const localChrome=env.LOCALAPPDATA?join(env.LOCALAPPDATA,'Google','Chrome','Application','chrome.exe'):'';
 const hasEdge=process.platform!=='win32'||installed(edgePath);
 const hasChrome=process.platform!=='win32'||installed(chromePath)||installed(localChrome);
 if(/ChromeHTML/i.test(progId)&&hasChrome)return {channel:'chrome',processName:'chrome.exe',label:'Google Chrome'};
 if(/MSEdgeHTM/i.test(progId)&&hasEdge)return {channel:'msedge',processName:'msedge.exe',label:'Microsoft Edge'};
 if(hasEdge)return {channel:'msedge',processName:'msedge.exe',label:'Microsoft Edge'};
 if(hasChrome)return {channel:'chrome',processName:'chrome.exe',label:'Google Chrome'};
 throw Error('未找到可用的 Microsoft Edge 或 Google Chrome');
}

export class MusicBrowser{
 constructor(){this.context=null;this.pages=new Map();this.browser=selectBrowserChannel()}
 async start(){
  if(this.context)return;
  const launch=()=>chromium.launchPersistentContext(profile,{
    channel:this.browser.channel,headless:false,viewport:null,
    args:['--autoplay-policy=no-user-gesture-required','--disk-cache-size=1048576','--media-cache-size=1048576'],
    ignoreDefaultArgs:['--mute-audio'],
   });
  try{this.context=await launch()}
  catch(error){
   if(process.platform!=='win32'||!/ProcessSingleton|profile directory|Lock file/i.test(String(error?.message||error)))throw error;
   closeStaleMusicBrowser(this.browser.processName);
   await new Promise(resolve=>setTimeout(resolve,900));
   this.context=await launch();
  }
  for(const [source,url] of Object.entries(home)){
   const page=this.context.pages().find(item=>item.url().startsWith(new URL(url).origin))||await this.context.newPage();
   this.pages.set(source,page);
   if(page.url()==='about:blank')await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{});
  }
 }
 label(){return this.browser.label}
 async page(source,{reopen=true}={}){
  if(!this.context)throw Error('音乐浏览器已关闭，请重新启动助手');
  let page=this.pages.get(source);
  if(page&&!page.isClosed()){
   if(page.url()==='about:blank'||page.url().startsWith('chrome-error://'))await page.goto(home[source],{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{});
   return page;
  }
  if(!reopen)return null;
  const url=home[source];
  if(!url)throw Error('未知音乐网页');
  page=this.context.pages().find(item=>!item.isClosed()&&item.url().startsWith(new URL(url).origin))||await this.context.newPage();
  this.pages.set(source,page);
  if(page.url()==='about:blank')await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  return page;
 }
 async close(){await this.context?.close();this.context=null;this.pages.clear()}
 async state(){return Object.fromEntries([...this.pages].map(([source,page])=>[source,{url:page.url(),closed:page.isClosed()}]))}
}

function closeStaleMusicBrowser(processName){
 const escaped=profile.replace(/'/g,"''");
 const command=`Get-CimInstance Win32_Process -Filter "Name='${processName}'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${escaped}') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
 try{execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{stdio:'ignore',windowsHide:true})}catch{}
}
