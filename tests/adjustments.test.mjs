import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../modules/'+p,import.meta.url),'utf8');
const stub="let user={role:'admin'},lang='en';const t=(a,b)=>b,esc=x=>String(x??'').replaceAll('<','&lt;'),money=x=>Number(x||0).toFixed(2)+' USD',info=x=>'<p>'+x+'</p>',proNote=info,card=(a,b)=>'<section>'+a+b+'</section>',table=(a,b)=>JSON.stringify(b),form=(a,b)=>'<form data-form=\"'+a+'\">'+b+'</form>',input=(k)=>'<input name=\"'+k+'\">',button=()=>'';";
const m=runInNewContext(stub+read('invoices.js')+'\n'+read('business.js')+'\n;({tsAdjustmentDoc,tsInvoiceMarkup,tsSettlementMarkup,tsInstallmentRows})',{});
test('partial returns preserve invoice items and show net total; cancelled schedule has no overdue status',()=>{
 const r={id:'i',kind:'sale',number:1,document:{store_name:'Shop',title:'Invoice',total:300,paid:300,payment_mode:'cash',items:[{name:'Phone',qty:3,price:100,total:300,warranty_months:12}]}};
 const adj=[{id:'a',cash_refund:100,debt_cancel:0,lines:[{line_no:1,qty:1,gross:100}]}],b={total:200,paid:200,refunded:100,debt_cancelled:0,balance:0,cancelled:false};
 const html=m.tsInvoiceMarkup(m.tsAdjustmentDoc(r,b,adj,true));
 assert.match(html,/Partial return/);assert.match(html,/Returned: 1/);assert.match(html,/Net after adjustment/);assert.match(html,/200.00 USD/);assert.doesNotMatch(html,/Cancelled by return/);
 assert.match(m.tsSettlementMarkup(r,b,null,[],adj),/qty_1/);
 const s=m.tsInstallmentRows([{number:1,sequence:1,due_date:'2000-01-01',amount:30,paid:10,cancelled:true}]);assert.match(s,/Cancelled/);assert.doesNotMatch(s,/Overdue/);
 const cancelled=m.tsInvoiceMarkup(m.tsAdjustmentDoc(r,{total:0,paid:0,refunded:60,debt_cancelled:240,cancelled:true},adj,true));assert.match(cancelled,/Cancelled — settled/);assert.match(cancelled,/Debt cancelled/);
});