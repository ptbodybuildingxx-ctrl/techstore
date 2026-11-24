import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
const src=readFileSync(new URL('../modules/catalog-admin.js',import.meta.url),'utf8');
const m=runInNewContext(src+'\n;({tsProductCSV,tsProductReadSpecs,tsProductVideo,tsProductBulk,tsProductGallery})',{crypto:webcrypto,t:(a,b)=>b});
test('new CSV metadata and canonical video link',()=>{
 const p=m.tsProductCSV('sku,name,type,price,cost,qty,brand,model,variant,video\nA,Phone,phone,200,100,2,Brand,M1,Black,https://youtu.be/dQw4w9WgXcQ')[0];
 assert.equal(p.brand,'Brand');assert.equal(p.model,'M1');assert.equal(p.video,'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
 assert.throws(()=>m.tsProductVideo('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ'));
});
test('structured specs and bulk selection preserve stock and costs',()=>{
 const x=m.tsProductReadSpecs({spec_socket:'AM5',extraSpecs:'watts = 65\nColor = Black'});
 assert.equal(x.socket,'AM5');assert.equal(x.watts,'65');
 assert.throws(()=>m.tsProductReadSpecs({extraSpecs:'__proto__ = x'}));
 assert.throws(()=>m.tsProductReadSpecs({spec_socket:'AM5',extraSpecs:'socket = AM4'}));
 const products=[{id:'a',price:100,qty:4,cost:70},{id:'b',price:200,qty:9,cost:90}];
 const z=m.tsProductBulk(products,['a'],'percent','10');
 assert.equal(z[0].price,110);assert.equal(z[0].qty,4);assert.equal(z[0].cost,70);assert.equal(z[1],products[1]);
 assert.throws(()=>m.tsProductBulk(products,['a'],'price',''));
 const im='data:image/jpeg;base64,AAAA';
 assert.equal(m.tsProductGallery({images:[im,im,'javascript:bad'],image:im}).length,1);
});