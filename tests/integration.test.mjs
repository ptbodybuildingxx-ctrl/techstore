import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('authentication, role restrictions, central revisions, stock and customer isolation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'techstore-')),port=19000+Math.floor(Math.random()*20000),base='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,NODE_ENV:'test',DATA_DIR:dir,PORT:String(port),ADMIN_EMAIL:'owner@example.test',ADMIN_PASSWORD:'test-only-long-password'},stdio:'pipe'});
 let diagnostics='';child.stderr.on('data',x=>diagnostics+=x);
 const call=async(path,b,cookie)=>{let r=await fetch(base+'/api/'+path,{method:b===undefined?'GET':'POST',headers:{...(b===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:b===undefined?undefined:JSON.stringify(b)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}};
 try{
 let ready=false;for(let i=0;i<80;i++){try{if((await call('health')).status===200){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
 assert.ok(ready,diagnostics);
 assert.equal((await call('state')).status,401);
 const admin=(await call('login',{email:'owner@example.test',password:'test-only-long-password'})).cookie;assert.ok(admin);
 let seed={products:[{id:'p1',name:'Phone',sku:'TS-001',type:'phone',qty:4,cost:50,price:100}],sales:[],expenses:[]};
 assert.equal((await call('state',{revision:0,data:seed},admin)).status,200);
 assert.equal((await call('state',{revision:0,data:seed},admin)).status,409);
 let a=await call('register',{name:'Customer',email:'c@example.test',password:'test-only-customer-password'});assert.equal(a.status,201);
 const c=a.cookie;assert.equal((await call('state',undefined,c)).status,403);
 const catalog=await call('catalog');assert.equal(catalog.data.products[0].cost,undefined);
 let order=await call('order',{items:[{id:'p1',qty:2}],phone:'1234',address:'Address'},c);assert.equal(order.status,201);
 assert.equal((await call('catalog')).data.products[0].qty,2);
 assert.equal((await call('order',{items:[{id:'p1',qty:3}],phone:'1234',address:'Address'},c)).status,409);
 let own=await call('account',undefined,c);assert.equal(own.data.orders[0].cost,undefined);assert.equal(own.data.orders[0].items[0].cost,undefined);
 let b=await call('register',{name:'Other',email:'b@example.test',password:'test-only-other-password'});assert.equal((await call('account',undefined,b.cookie)).data.orders.length,0);
 assert.equal((await call('operation',{kind:'orders',id:order.data.id,status:'cancelled'},admin)).status,200);
 assert.equal((await call('catalog')).data.products[0].qty,4);
 assert.equal((await call('users',{email:'cash@example.test',name:'Cashier',password:'test-only-cashier-password',role:'cashier'},admin)).status,201);
 let cashier=(await call('login',{email:'cash@example.test',password:'test-only-cashier-password'})).cookie;
 assert.equal((await call('report',undefined,cashier)).status,403);
 assert.equal((await call('pos',{product:'p1',qty:1,customer:'Walk-in'},cashier)).status,201);
 assert.equal((await call('catalog')).data.products[0].qty,3);
 assert.equal((await call('warranty',{customerId:a.data.id,device:'Phone',serial:'SERIAL-123',months:12},admin)).status,201);
 assert.equal((await call('account',undefined,c)).data.warranties.length,1);
 assert.equal((await call('account',undefined,b.cookie)).data.warranties.length,0);
 }finally{child.kill();await new Promise(r=>{if(child.exitCode!==null||child.signalCode!==null)r();else child.once('exit',r)});rmSync(dir,{recursive:true,force:true})}
});
