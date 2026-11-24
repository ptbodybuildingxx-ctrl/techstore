import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=dirname(fileURLToPath(import.meta.url));
const DATA=resolve(process.env.DATA_DIR||'data');
mkdirSync(DATA,{recursive:true,mode:0o700});
const db=new DatabaseSync(resolve(DATA,'techstore.sqlite'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,password TEXT NOT NULL,active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER);
CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,owner TEXT,created TEXT NOT NULL,data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS records_kind ON records(kind);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT,action TEXT,time TEXT);
INSERT OR IGNORE INTO state VALUES(1,0,'{}');`);
const q=(sql,...args)=>db.prepare(sql).all(...args);
const one=(sql,...args)=>db.prepare(sql).get(...args);
const run=(sql,...args)=>db.prepare(sql).run(...args);
const now=()=>new Date().toISOString();
const hash=s=>createHash('sha256').update(s).digest('hex');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
const txt=(v,n=200)=>String(v??'').trim().slice(0,n);
const positive=(v,zero=false)=>{let n=Number(v);if(!Number.isFinite(n)||n<0||(!zero&&n===0)||n>1e12)fail(400,'Invalid amount');return n};
const units=v=>{let n=positive(v);if(!Number.isSafeInteger(n))fail(400,'Quantity must be integer');return n};
const email=v=>{v=txt(v,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))fail(400,'Invalid email');return v};
function password(p){if(typeof p!=='string'||p.length<12||p.length>128)fail(400,'Password length 12–128');const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(p,salt,64).toString('hex')}
function verify(p,h){if(typeof p!=='string'||p.length>128||!h)return false;const [salt,key]=h.split(':');return timingSafeEqual(Buffer.from(key,'hex'),scryptSync(p,salt,64))}
function addUser(b,role){const id=randomUUID();try{run('INSERT INTO users(id,email,name,role,password) VALUES(?,?,?,?,?)',id,email(b.email),txt(b.name)||'User',role,password(b.password))}catch(e){if(String(e).includes('UNIQUE'))fail(409,'Email already registered');throw e}return id}
if(!one("SELECT id FROM users WHERE role='admin'")){if(!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD)throw Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ chars) before first start');addUser({email:process.env.ADMIN_EMAIL,name:'Owner',password:process.env.ADMIN_PASSWORD},'admin')}
const publicUser=u=>({id:u.id,email:u.email,name:u.name,role:u.role});
function session(req){let raw=(req.headers.cookie||'').match(/(?:^|;\s*)ts_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(!raw)return null;return one('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND u.active=1',hash(raw),Date.now())||null}
const secure=process.env.NODE_ENV==='production'?'; Secure':'';
function cookie(res,value,age){res.setHeader('Set-Cookie','ts_session='+value+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+age+secure)}
function login(res,u){let t=randomBytes(32).toString('hex');run('DELETE FROM sessions WHERE expires<?',Date.now());run('INSERT INTO sessions VALUES(?,?,?)',hash(t),u.id,Date.now()+86400000);cookie(res,t,86400);return publicUser(u)}
function need(u,roles){if(!u)fail(401,'Sign in required');if(roles&&!roles.includes(u.role))fail(403,'Access denied');return u}
const roles=['admin','cashier','stock','tech','customer'];
const managers=['admin','cashier','stock','tech'];
const rules={suppliers:['admin','stock'],purchases:['admin','stock'],debts:['admin','cashier'],installments:['admin','cashier'],inventory:['admin','stock'],used:['admin','stock'],returns:['admin','cashier'],repairs:['admin','tech','cashier'],offers:['admin'],coupons:['admin'],media:['admin'],draft:['admin'],versions:['admin'],notifications:['admin','cashier','tech'],orders:['admin','cashier'],loyalty:['admin','cashier'],warranty:['admin','cashier','tech']};
const audit=(u,a)=>run('INSERT INTO audit(actor,action,time) VALUES(?,?,?)',u?.id||'system',a,now());
function transaction(fn){db.exec('BEGIN IMMEDIATE');try{let v=fn();db.exec('COMMIT');return v}catch(e){db.exec('ROLLBACK');throw e}}
function state(){let s=one('SELECT revision,payload FROM state WHERE id=1');return {revision:s.revision,data:JSON.parse(s.payload)}}
function putState(s,data){const revision=s.revision+1;run('UPDATE state SET revision=?,payload=? WHERE id=1',revision,JSON.stringify(data));return revision}
function rows(kind){return q('SELECT * FROM records WHERE kind=? ORDER BY created DESC',kind).map(r=>({id:r.id,owner:r.owner,created:r.created,...JSON.parse(r.data)}))}
function record(kind,data,owner=null){const id=randomUUID(),created=now();run('INSERT INTO records VALUES(?,?,?,?,?)',id,kind,owner,created,JSON.stringify(data));return {id,owner,created,...data}}
function getRecord(kind,id){let r=one('SELECT * FROM records WHERE kind=? AND id=?',kind,id);if(!r)fail(404,'Record not found');return {id:r.id,owner:r.owner,created:r.created,...JSON.parse(r.data)}}
function replaceRecord(kind,r,data){run('UPDATE records SET data=? WHERE kind=? AND id=?',JSON.stringify(data),kind,r.id);return {id:r.id,owner:r.owner,created:r.created,...data}}
function product(s,id){let p=(s.data.products||[]).find(p=>p.id===id);if(!p)fail(404,'Product not found');return p}
function publicProducts(s){return (s.data.products||[]).filter(p=>!p.hidden&&!(s.data.owner?.hiddenCategories||[]).includes(p.type)).map(p=>({id:p.id,name:txt(p.name),nameEn:txt(p.nameEn),type:txt(p.type),sku:txt(p.sku),price:Number(p.price)||0,qty:Math.max(0,Number(p.qty)||0),specs:p.specs||{},image:safeImage(p.image)}))}
function safeImage(s){return typeof s==='string'&&s.length<500000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s)?s:''}
function points(id){return rows('loyalty').filter(r=>r.owner===id).reduce((s,r)=>s+Number(r.points||0),0)}
function notify(owner,title,body){return record('notifications',{title:txt(title),body:txt(body,1000)},owner)}
function validateState(data){if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Invalid snapshot');for(let k of ['products','sales','expenses','repairs','warranties','orders','staff','customers','stockMoves'])if(data[k]!=null&&!Array.isArray(data[k]))fail(400,'Invalid '+k);const ids=new Set;for(let p of data.products||[]){if(!p||typeof p.id!=='string'||ids.has(p.id)||!txt(p.name))fail(400,'Invalid product');ids.add(p.id);if(!Number.isSafeInteger(p.qty)||p.qty<0)fail(400,'Invalid stock');positive(p.cost,true);positive(p.price,true)}return data}
const cleanState=d=>{let result={...d};for(let k of ['cart','shopCart','favorites','role','lang','demo'])delete result[k];return result};
function move(s,p,delta,reason){if(p.qty+delta<0)fail(409,'Insufficient stock');p.qty+=delta;s.data.stockMoves??=[];s.data.stockMoves.push({id:randomUUID(),product:p.id,name:p.name,qty:delta,reason,date:now().slice(0,10)});}
const fields={suppliers:['name','phone','email','address'],debts:['name','direction','amount','due','notes'],installments:['name','amount','count','due','notes'],used:['name','serial','condition','cost','price','notes'],offers:['title','description','end'],coupons:['code','percent','end'],repairs:['customer','phone','device','serial','fault','estimate','status','notes','customerId'],media:['name','image'],draft:['title','subtitle','accent','blocks','menu']};
function clean(kind,b){let o={};for(let k of fields[kind]||[])o[k]=txt(b[k],k==='image'?500000:k==='blocks'||k==='menu'?20000:1000);if(kind==='media'){o.image=safeImage(o.image);if(!o.image)fail(400,'PNG/JPEG/WebP required (under 350 KB)')}
if(kind==='coupons'){o.code=o.code.toUpperCase();o.percent=positive(o.percent);if(o.percent>100||!o.code)fail(400,'Invalid coupon')}
if(['debts','installments'].includes(kind))o.amount=positive(o.amount);
if(kind==='installments'){o.count=units(o.count);if(o.count>120)fail(400,'Too many installments');o.paid=0}
if(kind==='used'){o.cost=positive(o.cost,true);o.price=positive(o.price,true)}
if(kind==='repairs'){if(o.customerId&&!one("SELECT id FROM users WHERE id=? AND role='customer'",o.customerId))fail(400,'Invalid customer account');o.estimate=positive(o.estimate,true);o.status='received'}
if(kind==='draft'){for(const k of ['blocks','menu']){try{o[k]=JSON.parse(o[k]||'[]')}catch{fail(400,'Invalid page JSON')}if(!Array.isArray(o[k])||o[k].length>50)fail(400,'Invalid page blocks')}o.blocks=o.blocks.map(x=>({title:txt(x.title),text:txt(x.text,3000),image:txt(x.image,80)}));o.menu=o.menu.map(x=>({label:txt(x.label),target:txt(x.target)}));o.accent=/^#[a-f0-9]{6}$/i.test(o.accent)?o.accent:'#1768db'}
return o}
const rate=new Map();
function limit(req){const ip=req.socket.remoteAddress||'unknown',t=Date.now();let a=rate.get(ip)||{n:0,t};if(t-a.t>600000)a={n:0,t};if(++a.n>30)fail(429,'Too many attempts');rate.set(ip,a);if(rate.size>5000)for(let [k,v] of rate)if(t-v.t>600000)rate.delete(k)}
async function body(req){if(!String(req.headers['content-type']).startsWith('application/json'))fail(415,'JSON required');let parts=[],n=0;for await(let c of req){n+=c.length;if(n>8_000_000)fail(413,'Payload too large');parts.push(c)}try{let v=JSON.parse(Buffer.concat(parts));if(!v||typeof v!=='object'||Array.isArray(v))fail(400,'Invalid JSON');return v}catch{fail(400,'Invalid JSON')}}
function json(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
function report(s){let sales=s.data.sales||[],expenses=s.data.expenses||[],total=sales.reduce((a,x)=>a+Number(x.total||0),0),cost=sales.reduce((a,x)=>a+Number(x.cost||0),0),expense=expenses.reduce((a,x)=>a+Number(x.amount||0),0);let cutoff=Date.now()-30*86400000;return {total,cost,expense,profit:total-cost-expense,forecast:(s.data.products||[]).map(p=>{let sold=sales.filter(x=>Date.parse(x.date)>=cutoff).flatMap(x=>x.items||[]).filter(x=>x.id===p.id).reduce((a,x)=>a+Number(x.qty||0),0);return {id:p.id,name:p.name,qty:p.qty,sold30:sold,days:sold?Math.round(p.qty*30/sold):null,suggestedPrice:Math.round(Number(p.cost||0)*1.25*100)/100}})}}
async function api(req,res,path,u){let method=req.method;
if(method==='GET'){
 if(path==='/api/health')return json(res,{ok:true});
 if(path==='/api/me')return json(res,u?publicUser(u):null);
 if(path==='/api/catalog'){let s=state(),site=rows('versions').find(x=>x.published);return json(res,{products:s.data.owner?.maintenance?[]:publicProducts(s),maintenance:!!s.data.owner?.maintenance,site:site?.page||null,media:rows('media').filter(m=>site?.page?.blocks?.some(b=>b.image===m.id)).map(m=>({id:m.id,name:m.name,image:m.image})),offers:rows('offers').filter(x=>!x.end||Date.parse(x.end)+86400000>Date.now()),currency:'USD'})}
 if(path==='/api/state'){need(u,['admin']);return json(res,state())}
 if(path==='/api/stock'){need(u,['admin','cashier','stock']);let s=state();return json(res,{products:(s.data.products||[]).map(p=>({id:p.id,name:p.name,sku:p.sku,qty:p.qty,price:p.price,...(u.role==='cashier'?{}:{cost:p.cost})})),sales:u.role==='stock'?[]:(s.data.sales||[]).map(({id,number,items})=>({id,number,items:items.map(({id,name,qty,price})=>({id,name,qty,price}))}))})}
 if(path==='/api/customers'){need(u,['admin','cashier','tech']);return json(res,q("SELECT id,name,email FROM users WHERE role='customer' AND active=1"))}
 if(path==='/api/users'){need(u,['admin']);return json(res,q('SELECT id,email,name,role,active FROM users'))}
 if(path==='/api/audit'){need(u,['admin']);return json(res,q('SELECT * FROM audit ORDER BY id DESC LIMIT 500'))}
 if(path==='/api/report'){need(u,['admin']);return json(res,report(state()))}
 if(path==='/api/account'){need(u);return json(res,{user:publicUser(u),points:points(u.id),orders:rows('orders').filter(r=>r.owner===u.id).map(({cost,items,...r})=>({...r,items:items.map(({cost,...i})=>i)})),repairs:rows('repairs').filter(r=>r.customerId===u.id).map(({device,status,estimate,created,id})=>({device,status,estimate,created,id})),warranties:rows('warranty').filter(r=>r.owner===u.id),notifications:rows('notifications').filter(r=>r.owner===u.id)})}
 if(path.startsWith('/api/records/')){let kind=path.split('/')[3];need(u,rules[kind]||[]);return json(res,rows(kind))}
 fail(404,'Not found')
}
if(method!=='POST')fail(405,'Method not allowed');
if(req.headers.origin){let expected=process.env.PUBLIC_ORIGIN||((process.env.NODE_ENV==='production'?'https://':'http://')+req.headers.host);if(req.headers.origin!==expected)fail(403,'Origin rejected')}
let b=await body(req);
if(path==='/api/login'){limit(req);let user=one('SELECT * FROM users WHERE email=? AND active=1',email(b.email));if(!verify(b.password,user?.password))fail(401,'Invalid credentials');audit(user,'login');return json(res,login(res,user))}
if(path==='/api/register'){limit(req);let id=addUser(b,'customer');return json(res,login(res,one('SELECT * FROM users WHERE id=?',id)),201)}
if(path==='/api/logout'){let t=(req.headers.cookie||'').match(/ts_session=([a-f0-9]{64})/)?.[1];if(t)run('DELETE FROM sessions WHERE token=?',hash(t));cookie(res,'',0);return json(res,{ok:true})}
need(u);
if(path==='/api/users'){need(u,['admin']);if(!roles.includes(b.role)||b.role==='admin')fail(400,'Invalid role');let id=addUser(b,b.role);audit(u,'create user '+id);return json(res,{id},201)}
if(path==='/api/users/active'){need(u,['admin']);if(b.id===u.id)fail(400,'Cannot disable self');run("UPDATE users SET active=? WHERE id=? AND role<>'admin'",b.active?1:0,txt(b.id));run('DELETE FROM sessions WHERE user_id=?',txt(b.id));audit(u,'change account '+b.id);return json(res,{ok:true})}
if(path==='/api/state'){need(u,['admin']);return json(res,transaction(()=>{let s=state();if(b.revision!==s.revision)fail(409,'Revision conflict: reload before saving');let revision=putState(s,validateState(cleanState(b.data)));audit(u,'update legacy snapshot '+revision);return {revision}}))}
if(path==='/api/records'){let k=txt(b.kind);need(u,rules[k]||[]);if(!fields[k])fail(400,'Use dedicated operation');let data=clean(k,b);return json(res,transaction(()=>{let r=record(k,data);audit(u,'create '+k+' '+r.id);return r}),201)}
if(path==='/api/publish'||path==='/api/restore'){need(u,['admin']);return json(res,transaction(()=>{let source=getRecord(path==='/api/publish'?'draft':'versions',b.id);let page=path==='/api/publish'?{title:source.title,subtitle:source.subtitle,accent:source.accent,blocks:source.blocks,menu:source.menu}:source.page;let r=record('versions',{page,published:true});audit(u,'publish '+r.id);return r}))}
if(path==='/api/operation'){let k=txt(b.kind);need(u,rules[k]||[]);return json(res,transaction(()=>{let s=state(),r;
 if(k==='purchases'){let p=product(s,b.product),qty=units(b.qty),cost=positive(b.cost,true);getRecord('suppliers',b.supplier);move(s,p,qty,'purchase');p.cost=cost;r=record(k,{product:p.id,name:p.name,qty,cost,total:qty*cost,supplier:b.supplier});putState(s,s.data)}
 else if(k==='inventory'){let p=product(s,b.product),qty=positive(b.qty,true);if(!Number.isSafeInteger(qty))fail(400,'Invalid stock count');let before=p.qty;move(s,p,qty-before,'inventory count');r=record(k,{product:p.id,name:p.name,before,qty,delta:qty-before,barcode:p.sku||p.id});putState(s,s.data)}
 else if(k==='returns'){let sale=(s.data.sales||[]).find(x=>x.id===b.sale),line=sale?.items?.find(x=>x.id===b.product);if(!line)fail(404,'Invoice item not found');let qty=units(b.qty),previous=rows('returns').filter(x=>x.sale===b.sale&&x.product===b.product).reduce((a,x)=>a+x.qty,0);if(qty+previous>line.qty)fail(409,'Quantity exceeds original sale');let p=product(s,b.product);move(s,p,qty,'return');r=record(k,{sale:b.sale,product:p.id,name:p.name,qty,refund:qty*line.price,reason:txt(b.reason)});s.data.expenses??=[];s.data.expenses.push({id:r.id,date:now().slice(0,10),desc:'Return '+sale.number,amount:r.refund-qty*Number(line.cost||0)});putState(s,s.data)}
 else if(k==='installments'||k==='debts'){let old=getRecord(k,b.id),amount=positive(b.amount),paid=Number(old.paid||0)+amount;if(paid>old.amount)fail(400,'Exceeds balance');let {id,owner,created,...d}=old;r=replaceRecord(k,old,{...d,paid});record('payments',{kind:k,reference:id,amount})}
 else if(k==='repairs'){let old=getRecord(k,b.id);if(!['received','diagnosed','approval','repairing','testing','ready','delivered','cancelled'].includes(b.status))fail(400,'Invalid status');let {id,owner,created,...d}=old;r=replaceRecord(k,old,{...d,status:b.status,notes:txt(b.notes,1000)});let user=old.customerId&&one("SELECT id FROM users WHERE id=? AND role='customer'",old.customerId);if(user)notify(user.id,'Repair '+old.device,b.status)}
 else if(k==='orders'){let old=getRecord(k,b.id);if(!['pending','confirmed','delivered','cancelled'].includes(old.status))fail(409,'Invalid state');let allowed={pending:['confirmed','cancelled'],confirmed:['delivered','cancelled'],delivered:[],cancelled:[]};if(!allowed[old.status].includes(b.status))fail(409,'Invalid order transition');let {id,owner,created,...d}=old;if(b.status==='cancelled'){for(let i of old.items)move(s,product(s,i.id),i.qty,'cancel order');putState(s,s.data)}if(b.status==='delivered'){s.data.sales??=[];s.data.sales.push({id,number:'WEB-'+id.slice(0,8),date:now().slice(0,10),customer:old.customer,payment:'cod',paid:true,items:old.items,total:old.total,cost:old.cost});putState(s,s.data);record('loyalty',{points:Math.floor(old.total),order:id},owner)}r=replaceRecord(k,old,{...d,status:b.status});notify(owner,'Order '+id.slice(0,8),b.status)}
 else fail(400,'Unknown operation');audit(u,'operation '+k+' '+r.id);return r}))}
if(path==='/api/warranty'){need(u,['admin','cashier','tech']);return json(res,transaction(()=>{let serial=txt(b.serial),device=txt(b.device),months=units(b.months);if(!serial||!device||months>120)fail(400,'Invalid warranty');if(rows('warranty').some(x=>x.serial.toLowerCase()===serial.toLowerCase()))fail(409,'Duplicate serial');let customer=one("SELECT id FROM users WHERE id=? AND role='customer'",txt(b.customerId));if(!customer)fail(400,'Invalid customer');let start=new Date(),end=new Date(start);end.setUTCMonth(end.getUTCMonth()+months);let w=record('warranty',{serial,device,months,start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)},customer.id);notify(customer.id,'Warranty '+device,w.end);audit(u,'warranty '+w.id);return w}),201)}
if(path==='/api/pos'){need(u,['admin','cashier']);return json(res,transaction(()=>{let s=state(),qty=units(b.qty),p=product(s,b.product);move(s,p,-qty,'POS sale');let sale={id:randomUUID(),number:'POS-'+Date.now(),date:now().slice(0,10),customer:txt(b.customer),payment:'cash',paid:true,items:[{id:p.id,name:p.name,qty,price:p.price,cost:p.cost}],total:p.price*qty,cost:p.cost*qty};s.data.sales??=[];s.data.sales.push(sale);putState(s,s.data);audit(u,'POS '+sale.id);let {cost,items,...out}=sale;return {...out,items:items.map(({cost,...i})=>i)}}),201)}
if(path==='/api/order'){need(u,['customer']);return json(res,transaction(()=>{let s=state();if(s.data.owner?.maintenance)fail(409,'Store closed');if(!txt(b.phone)||!txt(b.address))fail(400,'Phone and address required');if(!Array.isArray(b.items)||!b.items.length||b.items.length>50)fail(400,'Invalid cart');let counts=new Map;for(let i of b.items)counts.set(i.id,(counts.get(i.id)||0)+units(i.qty));let items=[];for(let [id,qty] of counts){let p=product(s,id);if(p.hidden||(s.data.owner?.hiddenCategories||[]).includes(p.type))fail(409,'Unavailable');move(s,p,-qty,'web order reservation');items.push({id,name:p.name,qty,price:p.price,cost:p.cost})}let subtotal=items.reduce((a,i)=>a+i.price*i.qty,0),cost=items.reduce((a,i)=>a+i.cost*i.qty,0),coupon=rows('coupons').find(x=>x.code===txt(b.coupon).toUpperCase()&&(!x.end||Date.parse(x.end)+86400000>Date.now())),discount=coupon?subtotal*coupon.percent/100:0,total=Math.round((subtotal-discount)*100)/100;let order=record('orders',{customer:u.name,address:txt(b.address,1000),phone:txt(b.phone),items,total,cost,discount,status:'pending',payment:'cod'},u.id);putState(s,s.data);notify(u.id,'Order '+order.id.slice(0,8),'pending');audit(u,'order '+order.id);return {id:order.id,total,status:order.status}}),201)}
fail(404,'Not found')
}
const allowedFiles=new Set(['index.html','style.css','app.js','extension.js','owner.js','manifest.webmanifest','sw.js','icon-192.png','icon-512.png','workspace.html','workspace.js','workspace.css','bridge.js','supabase-client.js']);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');try{let path=new URL(req.url,'http://localhost').pathname;if(path.startsWith('/api/'))return await api(req,res,path,session(req));if(req.method!=='GET'&&req.method!=='HEAD')fail(405,'Method not allowed');let file=path==='/'?'workspace.html':path.slice(1);if(!allowedFiles.has(file))fail(404,'Not found');if(file==='index.html'&&new URL(req.url,'http://localhost').searchParams.get('demo')!=='1'){if(session(req)?.role!=='admin')fail(403,'Legacy workspace requires owner login');if(!new URL(req.url,'http://localhost').searchParams.has('central')){res.writeHead(302,{Location:'./index.html?central=1','Cache-Control':'no-store'});return res.end()}}let buf=readFileSync(resolve(ROOT,file));res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:buf)}catch(e){if(!e.status)console.error(e);if(!res.headersSent)json(res,{error:e.status?e.message:'Internal error'},e.status||500);else res.end()}});
function backup(){try{let folder=resolve(DATA,'backups');mkdirSync(folder,{recursive:true,mode:0o700});let target=resolve(folder,now().replace(/[:.]/g,'-')+'.sqlite');db.exec("VACUUM INTO '"+target.replaceAll("'","''")+"'");let files=readdirSync(folder).filter(x=>x.endsWith('.sqlite')).sort().reverse();for(let f of files.slice(14))unlinkSync(resolve(folder,f))}catch(e){console.error('Backup failed',e.message)}}
if(process.env.NODE_ENV!=='test'){backup();setInterval(backup,24*3600000).unref()}
server.listen(Number(process.env.PORT)||8080,'0.0.0.0',()=>console.log('TechStore listening'));
