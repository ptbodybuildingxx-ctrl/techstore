import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../modules/'+p,import.meta.url),'utf8');
test('branch returns show original sale and net recent revenue/cost',async()=>{
 const env=runInNewContext("let user={role:'admin'},lang='en';const t=(a,b)=>b,esc=x=>String(x??''),money=x=>Number(x||0).toFixed(2)+' USD',card=(a,b)=>'<section>'+a+b+'</section>',proNote=x=>x,info=x=>x,form=(k,x)=>'<form data-kind=\"'+k+'\">'+x+'</form>',input=k=>'<input name=\"'+k+'\">',select=(k,a,b,opts)=>'<select name=\"'+k+'\">'+JSON.stringify(opts)+'</select>',button=()=>'',table=(a,b)=>JSON.stringify(b);const api=async p=>p==='state'?{data:{products:[{id:'p',name:'Product'}]}}:{branches:[{id:'b',name:'Branch'}],stock:[],journal:[],events:[{id:'sale-ref',kind:'sale',branch_from:'b',product_id:'p',qty:3,amount:300,cost:180},{id:'return-ref',kind:'return',branch_from:'b',product_id:'p',qty:1,amount:100,cost:60,original_sale_id:'sale-ref'}]};\n"+read('operations.js')+"\n;({view:tsBranchView})",{});
 const html=await env.view();for(const s of ['ops-return','sale-ref','200.00 USD','120.00 USD','Return'])assert.ok(html.includes(s),s);
 assert.ok(read('sync.js').includes("'ops-branch:return'"));
 for(const k of ['inventory_write','purchase_write','supplier_write','orders_write','repair_write','warranty_write','debt_write','installment_write','used_write'])assert.ok(read('staff.js').includes(k));
});