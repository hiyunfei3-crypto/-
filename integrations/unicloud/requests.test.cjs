const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {main}=require('./songlist-api');

test('远程队列提交、去重和主播权限',async()=>{
 process.env.SONGLIST_HOST_PASSWORD='unit-test-secret';
 const data={songlist_songs:[{_id:'song1',songId:555,title:'测试2',active:true}],songlist_requests:[]};
 const clone=value=>JSON.parse(JSON.stringify(value));
 global.uniCloud={database:()=>({
  command:{in:values=>({$in:values})},
  collection:name=>{
   let filters={},sortField='',sortDirection='asc',max=Infinity;
   const query={
    where(value){filters=value;return this},
    orderBy(field,direction){sortField=field;sortDirection=direction;return this},
    limit(value){max=value;return this},
    async get(){let rows=data[name]||[];rows=rows.filter(row=>Object.entries(filters).every(([key,value])=>value&&value.$in?value.$in.includes(row[key]):row[key]===value));if(sortField)rows=[...rows].sort((a,b)=>(a[sortField]>b[sortField]?1:-1)*(sortDirection==='desc'?-1:1));return{data:clone(rows.slice(0,max))}},
    doc(id){return{async get(){return{data:clone((data[name]||[]).filter(row=>row._id===id))}},async update(value){const row=data[name].find(row=>row._id===id);Object.assign(row,clone(value))}}},
    async add(value){data[name] ||= [];data[name].push(clone(value));return{id:value._id}}
   };return query;
  }
 })};
 const call=(action,body={})=>main({action,body});
 const requestId=crypto.randomUUID();
 let result=await call('submitRequest',{user:'viewer01',song:555,kind:'play',requestId});
 assert.equal(result.request.status,'pending');
 assert.match((await call('submitRequest',{user:'viewer01',song:555,kind:'sing',requestId:crypto.randomUUID()})).error,/已经点过/);
 assert.equal((await call('requestList')).requests[0].songTitle,'测试2');
 assert.match((await call('requestAction',{requestId,status:'queued'})).error,/登录/);
 const payload=Buffer.from(JSON.stringify({exp:Date.now()+60000})).toString('base64url');
 const token=payload+'.'+crypto.createHmac('sha256',process.env.SONGLIST_HOST_PASSWORD).update(payload).digest('hex');
 assert.equal((await call('requestAction',{token,requestId,status:'queued'})).status,'queued');
 assert.equal((await call('requestAction',{token,requestId,status:'active'})).status,'active');
 assert.equal((await call('requestAction',{token,requestId,status:'done'})).status,'done');
 assert.equal((await call('requestList')).requests.length,0);
 assert.equal((await call('requestList',{token})).requests[0].status,'done');
 assert.equal((await call('submitRequest',{user:'viewer01',song:555,kind:'play',requestId:crypto.randomUUID()})).request.status,'pending');
 assert.match((await call('submitRequest',{user:'viewer01',title:'  测试2  ',kind:'sing',requestId:crypto.randomUUID()})).error,/已经点过/);
 assert.match((await call('submitRequest',{user:'viewer01',title:'   ',kind:'play',requestId:crypto.randomUUID()})).error,/歌名/);
 assert.match((await call('submitRequest',{user:'viewer01',title:'字'.repeat(101),kind:'play',requestId:crypto.randomUUID()})).error,/歌名/);
 const freeId=crypto.randomUUID();
 result=await call('submitRequest',{user:'viewer01',title:'  河流   demo ',kind:'sing',requestId:freeId});
 assert.equal(result.request.song,null);
 assert.equal(result.request.songTitle,'河流 demo');
 assert.match((await call('submitRequest',{user:'viewer01',title:'河流 demo',kind:'play',requestId:crypto.randomUUID()})).error,/已经点过/);
 assert.equal((await call('requestList')).requests.find(item=>item.id===freeId).songTitle,'河流 demo');
 assert.equal((await call('requestAction',{token,requestId:freeId,status:'queued'})).status,'queued');
 assert.equal((await call('requestAction',{token,requestId:freeId,status:'active'})).status,'active');
 assert.equal((await call('requestAction',{token,requestId:freeId,status:'done'})).status,'done');
 assert.equal((await call('submitRequest',{user:'viewer01',title:'河流 demo',kind:'play',requestId:crypto.randomUUID()})).request.status,'pending');
});
