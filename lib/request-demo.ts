export type RequestKind='sing'|'play';
export type RequestStatus='pending'|'queued'|'active'|'paused'|'done'|'rejected';
export type SongRequest={id:string;user:string;song:number;kind:RequestKind;status:RequestStatus;createdAt:number;note?:string};
const key='jiuju-request-demo-v1';
const eventName='jiuju-request-demo-change';
const seed:SongRequest[]=[
 {id:'demo-1',user:'橘子汽水',song:14,kind:'sing',status:'pending',createdAt:Date.now()-180000},
 {id:'demo-2',user:'晚风听众',song:23,kind:'play',status:'queued',createdAt:Date.now()-120000},
 {id:'demo-3',user:'月亮邮差',song:7,kind:'sing',status:'queued',createdAt:Date.now()-60000},
];
export function loadRequests():SongRequest[]{
 try{const raw=localStorage.getItem(key);if(raw)return JSON.parse(raw);localStorage.setItem(key,JSON.stringify(seed));return seed}catch{return seed}
}
export function saveRequests(value:SongRequest[]){localStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new Event(eventName))}
export function submitRequest(user:string,song:number,kind:RequestKind){
 const list=loadRequests();
 if(list.some(item=>item.user===user&&item.song===song&&!['done','rejected'].includes(item.status)))throw Error('你已经点过这首歌了，请等待主播处理');
 saveRequests([...list,{id:crypto.randomUUID(),user,song,kind,status:'pending',createdAt:Date.now()}]);
}
export const requestEvent=eventName;
