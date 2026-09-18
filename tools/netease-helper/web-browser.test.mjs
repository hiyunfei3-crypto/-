import test from 'node:test';
import assert from 'node:assert/strict';
import {MusicBrowser} from './web-browser.mjs';

test('助手能重新打开被关闭的音乐标签页',async()=>{
 const browser=new MusicBrowser();
 const closed={isClosed:()=>true};
 const opened={isClosed:()=>false,url:()=> 'about:blank',goto:async url=>{assert.equal(url,'https://music.163.com/')}};
 browser.pages.set('netease',closed);
 browser.context={pages:()=>[],newPage:async()=>opened};
 assert.equal(await browser.page('netease',{reopen:false}),null);
 assert.equal(await browser.page('netease'),opened);
 assert.equal(await browser.page('netease'),opened);
});
