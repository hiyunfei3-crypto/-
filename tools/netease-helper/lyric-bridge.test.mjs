import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlayerCap,parseLrc} from './lyric-bridge.mjs';

test('PlayerCap 歌词事件会转换为直播页统一格式',()=>{
 const result=normalizePlayerCap({player:'cloudmusicv3',title:'月光',artist:'歌手',lyric:{text:'照亮天涯',next_text:'满目琳琅',text_detailed:[{text:'照',start_time:100,duration:300}]},position:150,playing:true});
 assert.equal(result.available,true);
 assert.equal(result.player,'cloudmusicv3');
 assert.equal(result.currentLine,'照亮天涯');
 assert.equal(result.nextLine,'满目琳琅');
 assert.deepEqual(result.words,[{text:'照',startMs:100,durationMs:300}]);
});

test('网易云逐行歌词时间会转换成毫秒并保持顺序',()=>{
 assert.deepEqual(parseLrc('[00:02.50]第二行\n[00:01.005]第一行'),[{timeMs:1005,text:'第一行'},{timeMs:2500,text:'第二行'}]);
});
