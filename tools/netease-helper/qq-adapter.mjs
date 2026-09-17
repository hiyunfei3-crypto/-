import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PlaybackAttemptError} from './netease-adapter.mjs';

const probe=fileURLToPath(new URL('./qq-probe.ps1',import.meta.url));
export async function playQQMusic(){
 const result=await new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',probe],{windowsHide:true,timeout:10000,maxBuffer:1024*1024},(error,stdout,stderr)=>{
  if(error){reject(new PlaybackAttemptError((stderr||stdout||error.message).trim(),'unknown'));return}
  try{resolve(JSON.parse(stdout.trim()))}catch{reject(new PlaybackAttemptError('QQ 音乐检测结果无效','unknown'))}
 }));
 // This QQ Music build exposes no searchable UIA children; never claim playback from a blind click.
 const reasons={'not-open':'QQ 音乐桌面窗口未打开','no-controls':'当前 QQ 音乐未暴露可验证的搜索和播放控件，请主播手动处理','unverified-controls':'QQ 音乐控件可见，但尚未完成实机播放验证','inspection-failed':'QQ 音乐控件检查失败'};
 throw new PlaybackAttemptError(reasons[result.code]||'QQ 音乐当前版本未通过自动播放验证',result.outcome||'unavailable');
}
