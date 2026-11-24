'use strict';
if(CENTRAL){
 let revision=null, baseline='', saving=false, ready=false;
 const bar=document.createElement('div');bar.style.cssText='position:sticky;top:0;z-index:99;background:#e5edf8;padding:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center';bar.innerHTML='<a href="./workspace.html">← TechStore Cloud</a><button id="ts-load">تحميل من الخادم / Reload</button><button id="ts-save" disabled>حفظ مركزي / Central save</button><span id="ts-state" role="status">Connecting…</span>';document.body.prepend(bar);
 const status=s=>$('#ts-state').textContent=s;
 const snapshot=()=>{let d={...db};for(let k of ['cart','shopCart','favorites','role','lang','demo'])delete d[k];return d};
 const fingerprint=()=>JSON.stringify(snapshot());
 async function remote(b){let r=await fetch('./api/state',{method:b===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:b===undefined?{}:{'Content-Type':'application/json'},body:b===undefined?undefined:JSON.stringify(b)});let d=await r.json();if(!r.ok)throw Error(d.error||r.status);return d}
 function locked(v){document.querySelector('.layout').inert=v;$('#ts-save').disabled=v;$('#role').style.display='none';$('#mode').style.display='none';}
 async function load(){locked(true);try{let s=await remote();let language=db.lang;db={...fresh(),...newFields(),...s.data,lang:language,role:'admin',demo:false};revision=s.revision;storeMode=false;tab='dashboard';render();baseline=fingerprint();ready=true;status('Central • revision '+revision);locked(false)}catch(e){ready=false;status(e.message);locked(true)}}
 $('#ts-load').onclick=()=>{if(saving)return;if(ready&&fingerprint()!==baseline&&!confirm('Discard unsaved changes? / تجاهل التعديلات غير المحفوظة؟'))return;load()};
 $('#ts-save').onclick=async()=>{if(!ready||saving)return;saving=true;$('#ts-save').disabled=true;let data=snapshot(),sent=JSON.stringify(data);try{let s=await remote({revision,data});revision=s.revision;baseline=sent;status('Saved • revision '+revision)}catch(e){status(e.message);toast(e.message)}finally{saving=false;$('#ts-save').disabled=false}};
 window.addEventListener('beforeunload',e=>{if(ready&&fingerprint()!==baseline){e.preventDefault();e.returnValue=''}});
 setInterval(()=>{if(ready&&!saving&&fingerprint()!==baseline)status('Unsaved changes / تعديلات غير محفوظة • '+revision)},1500);
 load();
}else{
 let a=document.createElement('a');a.href='./workspace.html';a.textContent='TechStore Cloud 4.0';a.style.cssText='color:#fff;margin:0 8px';document.querySelector('.tools').append(a);
}
