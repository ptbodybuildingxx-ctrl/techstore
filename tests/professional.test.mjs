import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {runInNewContext} from 'node:vm';
const src=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const sandbox={crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,atob,btoa,console,document:{addEventListener(){}},t:(a,b)=>b,esc:x=>String(x??'')};
const m=runInNewContext(src('pro.js')+'\n'+src('catalog-admin.js')+'\n;({tsProductCSV,tsProductUnique,tsBuildCheckData,tsSuggestBuild,tsEncryptBackup,tsDecryptBackup})',sandbox);
test('CSV parses quoted fields and rejects invalid data and duplicates',()=>{
 const p=m.tsProductCSV('sku,name,type,price,cost,qty,nameEn,specs\r\nA1,"Laptop, black",laptop,600.50,400,2,Test,"{""ram"":""16 GB""}"')[0];
 assert.equal(p.name,'Laptop, black');assert.equal(p.price,600.5);assert.equal(p.specs.ram,'16 GB');
 assert.throws(()=>m.tsProductCSV('sku,name,type,price,cost,qty\nA,Name,laptop,-1,0,1'));
 assert.throws(()=>m.tsProductCSV('sku,name,type,price,cost,qty\nA,Name,laptop,1,0,1.5'));
 assert.throws(()=>m.tsProductUnique([{sku:'A1'},{sku:'a1'}]));
});
const parts=[{type:'cpu',specs:{socket:'AM5',watts:'65'}},{type:'board',specs:{socket:'AM5',ram:'DDR5',form:'ATX'}},{type:'ram',specs:{ram:'DDR5'}},{type:'gpu',specs:{watts:'200'}},{type:'storage',specs:{}},{type:'psu',specs:{watts:'550'}},{type:'case',specs:{form:'ATX'}}].map((p,i)=>({...p,id:String(i),qty:2,price:50}));
test('PC checks detect socket and power conflicts, respect budget',()=>{
 const b=m.tsBuildCheckData(parts);assert.equal(b.warnings.length,0);assert.equal(b.unknown.length,0);assert.equal(b.missing.length,0);
 assert.ok(m.tsBuildCheckData(parts.map(p=>p.type==='cpu'?{...p,specs:{socket:'LGA1700',watts:'65'}}:p)).warnings.includes('socket'));
 assert.ok(m.tsBuildCheckData(parts.map(p=>p.type==='psu'?{...p,specs:{watts:'200'}}:p)).warnings.includes('power'));
 const selection=m.tsSuggestBuild(parts,350);assert.ok(selection);assert.ok(selection.reduce((n,p)=>n+p.price,0)<=350);assert.equal(m.tsSuggestBuild(parts,10),null);
});
test('AES-GCM backup decrypts and rejects wrong password/tampering',async()=>{
 const value={workspace:{revision:1,data:{products:[{name:'Synthetic fixture'}]}}};
 const encrypted=await m.tsEncryptBackup(value,'synthetic-test-password-not-used');
 assert.ok(!encrypted.includes('Synthetic fixture'));
 const decrypted=await m.tsDecryptBackup(encrypted,'synthetic-test-password-not-used');
 assert.equal(JSON.stringify(decrypted),JSON.stringify(value));
 await assert.rejects(m.tsDecryptBackup(encrypted,'synthetic-wrong-password'));
 const e=JSON.parse(encrypted);e.data=(e.data[0]==='A'?'B':'A')+e.data.slice(1);
 await assert.rejects(m.tsDecryptBackup(JSON.stringify(e),'synthetic-test-password-not-used'));
});