import type {SongRequest} from './request-demo';

/** Automatic approval only applies to play requests; singing always awaits the host. */
export function nextAutoPlayRequest(requests:SongRequest[],autoReview:boolean):SongRequest|undefined{
 const waiting=requests.filter(item=>item.status==='pending'||item.status==='queued').sort((a,b)=>a.createdAt-b.createdAt);
 if(autoReview)return waiting.find(item=>item.kind==='play');
 const first=waiting[0];
 return first?.kind==='play'&&first.status==='queued'?first:undefined;
}
