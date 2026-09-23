import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PairingStore} from './pairing-store.mjs';

test('device pairing survives helper restart and stays restricted to its origin',()=>{
 const dir=mkdtempSync(join(tmpdir(),'songlist-pair-'));
 try{
  const path=join(dir,'paired.json');
  const first=new PairingStore(path);
  const publicOrigin='https://hiyunfei3-crypto.github.io';
  const localOrigin='http://localhost:5180';
  const publicToken=first.issue(publicOrigin);
  const secondBrowser=first.issue(publicOrigin);
  const localToken=first.issue(localOrigin);
  assert.equal(first.valid(publicOrigin,publicToken),true);
  assert.equal(first.valid(publicOrigin,localToken),false);
  assert.equal(first.valid(localOrigin,publicToken),false);
  assert.equal(first.valid(publicOrigin,'wrong'),false);
  assert.equal(readFileSync(path,'utf8').includes(publicToken),true);
  const afterRestart=new PairingStore(path);
  assert.equal(afterRestart.valid(publicOrigin,publicToken),true);
  assert.equal(afterRestart.revoke(publicOrigin,publicToken),true);
  assert.equal(afterRestart.valid(publicOrigin,publicToken),false);
  assert.equal(afterRestart.valid(publicOrigin,secondBrowser),true);
  assert.equal(afterRestart.valid(localOrigin,localToken),true);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
