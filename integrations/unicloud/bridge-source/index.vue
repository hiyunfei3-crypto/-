<template><view>歌单云连接</view></template>
<script>
export default {
 onLoad() {
  this.receive = async (event) => {
   if (event.origin !== location.origin || event.source !== parent) return;
   const msg = event.data;
   if (!msg || msg.channel !== 'jiuju-cloud-v1' || typeof msg.requestId !== 'string') return;
   if (!['state','login','like','copy','wish','vote','health'].includes(msg.action)) return;
   try {
    const response = await uniCloud.callFunction({name:'songlist-api',data:{action:msg.action,body:msg.body || {}}});
    parent.postMessage({channel:'jiuju-cloud-v1',requestId:msg.requestId,result:response.result},location.origin);
   } catch (error) {
    parent.postMessage({channel:'jiuju-cloud-v1',requestId:msg.requestId,error:error.message || error.errMsg || '云端连接失败'},location.origin);
   }
  };
  window.addEventListener('message', this.receive);
  parent.postMessage({channel:'jiuju-cloud-v1',ready:true},location.origin);
 },
 onUnload(){window.removeEventListener('message',this.receive)}
}
</script>
