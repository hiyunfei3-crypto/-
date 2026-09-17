import assert from 'node:assert/strict';
import test from 'node:test';
import {nextAutoPlayRequest} from '../lib/auto-play-queue.ts';

const request=(id,kind,status,createdAt)=>({id,kind,status,createdAt,user:'viewer',song:null,songTitle:id});

test('manual review blocks automatic playback until the first request is accepted',()=>{
 const waiting=[request('sing','sing','pending',1),request('play','play','pending',2)];
 assert.equal(nextAutoPlayRequest(waiting,false),undefined);
 assert.equal(nextAutoPlayRequest([request('play','play','queued',1)],false)?.id,'play');
});

test('automatic review skips singing and chooses the earliest playable request',()=>{
 const waiting=[request('done','play','done',0),request('sing','sing','pending',1),request('second','play','pending',3),request('first','play','queued',2)];
 assert.equal(nextAutoPlayRequest(waiting,true)?.id,'first');
 assert.equal(nextAutoPlayRequest([request('sing','sing','pending',1)],true),undefined);
});
