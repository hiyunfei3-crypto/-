import test from 'node:test';
import assert from 'node:assert/strict';
import {neteaseProgressWrapped,neteaseTrackCompleted,parseNeteasePlayerState,parsePlayerClock,selectExactSong} from './web-playback.mjs';

const rows=[
 {title:'茶汤 (Live)',artists:['郁可唯'],index:0},
 {title:'茶汤',artists:['翻唱者'],index:1},
 {title:'茶汤',artists:['郁可唯'],index:2},
];

test('网页结果按完整歌名和指定歌手选择，翻唱最后尝试',()=>{
 assert.equal(selectExactSong(rows,'茶汤','郁可唯').index,2);
 assert.equal(selectExactSong(rows,'茶汤','郁可唯',true).index,1);
 assert.equal(selectExactSong(rows,'茶汤','不存在'),null);
 assert.equal(selectExactSong(rows,'茶汤').index,1);
 assert.equal(selectExactSong(rows,'茶汤').ambiguous,true);
});

test('播放条时间只接受有效的分秒或时分秒',()=>{
 assert.equal(parsePlayerClock('03:17'),197000);
 assert.equal(parsePlayerClock('1:02:03'),3723000);
 assert.equal(parsePlayerClock('尚未播放'),null);
});

test('网易云播放条关联歌曲编号和实际进度',()=>{
 assert.deepEqual(parseNeteasePlayerState({href:'/song?id=1437251162',title:'河流 demo',time:'00:13 / 04:20',playClass:'pas j-flag'}),{
  songId:'1437251162',title:'河流 demo',positionMs:13000,durationMs:260000,playingClass:true,
 });
});

test('只有临近结尾后跳回开头才算自然播完',()=>{
 assert.equal(neteaseProgressWrapped(257000,{positionMs:56000,durationMs:260000}),true);
 assert.equal(neteaseProgressWrapped(172000,{positionMs:56000,durationMs:260000}),false);
 assert.equal(neteaseProgressWrapped(257000,{positionMs:180000,durationMs:260000}),false);
});

test('网易云自动切到另一首只在原曲接近结尾时认定播完',()=>{
 const current={songId:'1',durationMs:51000,lastPositionMs:48000};
 assert.equal(neteaseTrackCompleted(current,{songId:'2',positionMs:1000,durationMs:180000}),true);
 assert.equal(neteaseTrackCompleted({...current,lastPositionMs:15000},{songId:'2',positionMs:1000,durationMs:180000}),false);
 assert.equal(neteaseTrackCompleted(current,{songId:'1',positionMs:5000,durationMs:51000}),true);
});
