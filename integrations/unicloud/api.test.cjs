const {test}=require('node:test');
const assert=require('node:assert/strict');
const {main}=require('./songlist-api');
test('收藏、许愿、投票、重复点歌与失败回滚',async()=>{
 let stored={};
 const copy=x=>JSON.parse(JSON.stringify(x));
 function collection(data,name,transaction=false){
  data[name] ||= {};
  return {doc(id){return {
   async get(){const value=data[name][id];return {data:transaction?(value?copy(value):null):(value?[copy(value)]:[])}} ,
   async update(value){data[name][id]={...data[name][id],...copy(value)}}
  }},async add(value){assert.ok(!data[name][value._id]);data[name][value._id]=copy(value);return{id:value._id}}};
 }
 global.uniCloud={database:()=>({collection:name=>collection(stored,name),async startTransaction(){const data=copy(stored);return{collection:name=>collection(data,name,true),async commit(){stored=data},async rollback(){}}}})};
 const call=(action,body={})=>main({action,body});
 assert.deepEqual((await call('state')).copies,[]);
 let state=await call('login',{id:'test001',merge:[1,1,999999]});
 assert.deepEqual(state.favorites,[1]);
 assert.equal(state.likes[0].count,1);
 state=await call('like',{id:'test001',song:1,active:true});
 assert.equal(state.likes[0].count,1);
 state=await call('state',{id:'test001'});assert.deepEqual(state.favorites,[1]);
 state=await call('like',{id:'test001',song:1,active:false});assert.deepEqual(state.likes,[]);
 state=await call('wish',{id:'test001',title:'  Test Song ',artist:'Singer'});
 assert.equal(state.wishes[0].count,1);const wish=state.wishes[0].id;
 state=await call('wish',{id:'test001',title:'test song',artist:'singer'});assert.equal(state.wishes.length,1);assert.equal(state.wishes[0].count,1);
 state=await call('vote',{id:'test002',wish,active:true});assert.equal(state.wishes[0].count,2);
 state=await call('vote',{id:'test001',wish,active:false});assert.equal(state.wishes[0].count,1);
 assert.ok((await call('vote',{id:'test001',wish:999,active:true})).error);
 state=await call('copy',{song:1,event:'test-event-00000001'});assert.equal(state.copies[0].count,1);
 state=await call('copy',{song:1,event:'test-event-00000001'});assert.equal(state.copies[0].count,1);
 assert.ok((await call('like',{id:'test001',song:999999,active:true})).error);
 assert.ok((await call('wish',{title:'anonymous'})).error);
 assert.ok((await call('delete',{})).error);
});
