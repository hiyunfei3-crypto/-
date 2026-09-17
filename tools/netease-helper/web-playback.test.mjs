import test from 'node:test';
import assert from 'node:assert/strict';
import {selectExactSong} from './web-playback.mjs';

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
