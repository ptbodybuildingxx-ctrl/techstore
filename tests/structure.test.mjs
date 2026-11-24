import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
test('workspace scripts, offline cache, static allowlist and files agree',()=>{
 const html=read('workspace.html'), sw=read('sw.js'),server=read('server.mjs');
 const scripts=[...html.matchAll(/<script src="([^"]+)" defer/g)].map(x=>x[1]);
 assert.ok(scripts.length>=12);
 for(const f of scripts){const p=f.split('?')[0];assert.ok(existsSync(new URL(p,root)),p);assert.ok(sw.includes("'./"+f+"'"),'SW '+f);assert.ok(server.includes("'"+p+"'"),'Server '+p)}
 assert.equal(scripts.at(-1).split('?')[0],'workspace.js');
});
test('only the known product storage origin and object path are accepted',()=>{
 const m=runInNewContext(read('modules/store.js')+'\n;({tsStorePhotoUrl,tsStoreIsPhoto,tsStorePhotoRoot})',{});
 const path='catalog/11111111-1111-4111-8111-111111111111.jpg';
 assert.ok(m.tsStoreIsPhoto(m.tsStorePhotoUrl(path)));
 assert.equal(m.tsStorePhotoUrl('../private'),'');
 assert.equal(m.tsStoreIsPhoto('https://evil.example/'+path),false);
 assert.equal(m.tsStoreIsPhoto(m.tsStorePhotoRoot+path+'?x=1'),false);
});