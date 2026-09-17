import {cloudCall} from './unicloud';

export type RequestKind='sing'|'play';
export type RequestStatus='pending'|'queued'|'active'|'paused'|'needsAttention'|'done'|'rejected';
export type SongRequest={id:string;user:string;song:number|null;songTitle:string;artist?:string;kind:RequestKind;status:RequestStatus;attentionReason?:string;createdAt:number;updatedAt?:number};

export async function loadRequests(token=''):Promise<SongRequest[]>{
 const result=await cloudCall('requestList',token?{token}:{});
 if(!Array.isArray(result?.requests))throw Error('待播单返回格式不正确');
 return result.requests;
}
export async function submitRequest(user:string,song:number,kind:RequestKind){
 const result=await cloudCall('submitRequest',{user,song,kind,requestId:crypto.randomUUID()});
 if(!result?.request)throw Error('点歌提交失败');
 return result.request as SongRequest;
}
export async function submitFreeRequest(user:string,title:string,kind:RequestKind,artist=''){
 const result=await cloudCall('submitRequest',{user,title,artist,kind,requestId:crypto.randomUUID()});
 if(!result?.request)throw Error('点歌提交失败');
 return result.request as SongRequest;
}
export async function updateRequest(token:string,requestId:string,status:RequestStatus,reason=''){
 const result=await cloudCall('requestAction',{token,requestId,status,reason});
 if(!result?.ok)throw Error('请求状态更新失败');
 return result;
}
