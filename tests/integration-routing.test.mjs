import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('existing sections route to integrated workflows',()=>{
 const w=read('workspace.js'),s=read('modules/store.js'),b=read('modules/business.js');
 assert.ok(w.includes("if(page==='pos')return tsInvoiceView()"));
 assert.ok(w.includes("tsIntegratedPurchase(d)"));
 assert.ok(w.includes("Legacy history is read-only"));
 assert.ok(w.includes("View invoice','biz-detail'"));
 assert.ok(w.includes("tsBusinessSummaryMarkup(s)+card"));
 assert.ok(s.includes("action:'purchase'"));
 assert.ok(b.includes("money(s.supplier_payable)"));
 assert.ok(b.includes("money(s.payroll_payable)"));
 assert.ok(b.includes("money(s.branch_cash)"));
});