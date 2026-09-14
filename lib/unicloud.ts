let frame: HTMLIFrameElement | undefined;
let ready: Promise<void> | undefined;
const pending = new Map<string,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
function connect() {
 if (ready) return ready;
 ready = new Promise<void>((resolve,reject)=>{
  const receive=(event:MessageEvent)=>{
   if(event.origin!==location.origin || event.source!==frame?.contentWindow || event.data?.channel!=='jiuju-cloud-v1')return;
   if(event.data.ready){clearTimeout(timer);resolve();return;}
   const item=pending.get(event.data.requestId);if(!item)return;
   clearTimeout(item.timer);pending.delete(event.data.requestId);
   const error=event.data.error || event.data.result?.error;
   if(error)item.reject(Error(error));else item.resolve(event.data.result);
  };
  const timer=setTimeout(()=>{window.removeEventListener('message',receive);ready=undefined;frame?.remove();frame=undefined;reject(Error('云连接加载超时，请重试'));},20000);
  frame=document.createElement('iframe');
  frame.hidden=true;frame.title='歌单云连接';frame.setAttribute('aria-hidden','true');
  const base=(import.meta as ImportMeta & {env:Record<string,string>}).env.BASE_URL || '/';
  frame.src=base+'community-bridge/index.html';
  window.addEventListener('message',receive);
  document.body.appendChild(frame);
 });
 return ready;
}
export async function cloudCall(action:string,body:Record<string,unknown>={}) {
 await connect();
 return new Promise<any>((resolve,reject)=>{
  const requestId=crypto.randomUUID();
  const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('云端响应超时，请稍后重试'));},20000);
  pending.set(requestId,{resolve,reject,timer});
  frame!.contentWindow!.postMessage({channel:'jiuju-cloud-v1',requestId,action,body},location.origin);
 });
}
