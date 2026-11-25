import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../modules/sync.js',import.meta.url),'utf8');
const start=source.indexOf('let tsSyncGeneration=0;');
const stop=source.indexOf('function tsSyncCanReplay()',start);
assert.ok(start>=0&&stop>start);
function harness(encrypt,cas){
 return new Function('tsEncryptBackup','tsSyncCAS','let tsSyncPassword="fixture",tsSyncRaw="old",tsSyncVault={queue:[]};'+source.slice(start,stop)+'return {persist:tsSyncPersist,lock:tsSyncLock,change:()=>{tsSyncRaw="other"},state:()=>({raw:tsSyncRaw,vault:tsSyncVault})};')(encrypt,cas);
}
test('offline vault rejects stale save before writing',async()=>{
 let release,writes=0;
 const wait=new Promise(r=>release=r);
 const h=harness(async()=>{await wait;return 'encrypted'},async()=>{writes++});
 const p=h.persist({queue:[1]});h.change();release();
 await assert.rejects(p,/changed during save/);assert.equal(writes,0);
});
test('offline vault never reopens a vault locked during encryption',async()=>{
 let release,writes=0;
 const wait=new Promise(r=>release=r);
 const h=harness(async()=>{await wait;return 'encrypted'},async()=>{writes++});
 const p=h.persist({queue:[1]});h.lock();release();
 await assert.rejects(p,/changed during save/);assert.equal(writes,0);assert.equal(h.state().vault,null);
});
test('offline vault commits a current update',async()=>{
 let expected;
 const h=harness(async()=> 'encrypted',async(e)=>{expected=e});
 await h.persist({queue:[1]});
 assert.equal(expected,'old');assert.equal(h.state().raw,'encrypted');assert.deepEqual(h.state().vault,{queue:[1]});
});
test('protected online requests obtain a durable ID even if caller omitted it',async()=>{
 const start=source.indexOf('const tsPendingScopes=');
 const stop=source.indexOf('const tsPendingLabels=',start);
 const h=new Function('user','navigator','crypto','t',source.slice(start,stop)+'return {call:tsPendingCall,setMocks:m=>{tsPendingHash=m.hash;tsPendingClaim=m.claim;tsPendingClear=m.clear;tsPendingLock=m.lock}}')({id:'fixture-owner'},{onLine:true},{randomUUID:()=> 'fixture-request'},(_a,b)=>b);
 let claimed, sent;
 h.setMocks({hash:async()=> 'hash',claim:async(owner,scope,hash,id)=>{claimed=id;return {id,fresh:true}},clear:async()=>{},lock:async(_k,fn)=>fn()});
 await h.call('business',{action:'expense',args:{amount:10}},async(_path,b)=>{sent=b.args.request_id;return {id:'fixture-entry'}});
 assert.equal(claimed,'fixture-request');assert.equal(sent,claimed);
});
