import test from 'node:test';
import assert from 'node:assert/strict';
import {playAcrossPlayers} from './play-routing.mjs';
import {PlaybackAttemptError} from './netease-adapter.mjs';

const unavailable=()=>{throw new PlaybackAttemptError('明确不可播','unavailable')};
test('指定歌手时先尝试两边原唱，再考虑翻唱',async()=>{
 const order=[];
 const adapters={
  netease:async(_title,_artist,cover)=>{order.push(`netease:${cover}`);return unavailable()},
  qq:async(_title,_artist,cover)=>{order.push(`qq:${cover}`);if(cover)return{player:'qqmusic'};return unavailable()},
 };
 assert.equal((await playAcrossPlayers('歌名','歌手',adapters)).player,'qqmusic');
 assert.deepEqual(order,['netease:false','qq:false','netease:true','qq:true']);
});
test('状态不明时停止切换，所有明确失败才报告不可播',async()=>{
 const unknown=new PlaybackAttemptError('可能已出声','unknown');
 let qqCalls=0;
 await assert.rejects(playAcrossPlayers('歌名','',{netease:async()=>{throw unknown},qq:async()=>{qqCalls++}}),error=>error===unknown);
 assert.equal(qqCalls,0);
 await assert.rejects(playAcrossPlayers('歌名','',{netease:unavailable,qq:unavailable}),error=>error.outcome==='unavailable');
});
