/* Supabase public client. Only the publishable key is included. */
window.tsCloud=(()=>{
const base='https://jtjnbeywpfdtgohffanl.supabase.co',key='sb_publishable_b6YygUoLhEVE78WYApR7Ag_JfDIq1cz',storage='techstore-auth-v42';
let session=null;try{session=JSON.parse(sessionStorage.getItem(storage)||'null')}catch{}
function save(x){session=x?.access_token?{access_token:x.access_token,refresh_token:x.refresh_token,expires_at:x.expires_at||Math.floor(Date.now()/1000)+(x.expires_in||3600)}:null;try{if(session)sessionStorage.setItem(storage,JSON.stringify(session));else sessionStorage.removeItem(storage)}catch{}}
async function request(url,method='GET',body,token){const r=await fetch(base+url,{method,headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});let x;try{x=await r.json()}catch{x={}}if(!r.ok)throw Error(x.error_description||x.msg||x.message||x.error||'Request failed ('+r.status+')');return x}
let refreshing=null;
async function token(){if(!session)return null;if(session.expires_at>Date.now()/1000+60)return session.access_token;if(!refreshing)refreshing=request('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:session.refresh_token}).then(x=>{save(x);return session.access_token}).catch(()=>{save(null);return null}).finally(()=>refreshing=null);return refreshing}
async function api(path,b){if(path==='login'){let x=await request('/auth/v1/token?grant_type=password','POST',{email:b.email,password:b.password});save(x);try{return await api('me')}catch(e){save(null);throw e}}
if(path==='register'){let x=await request('/auth/v1/signup','POST',{email:b.email,password:b.password,data:{name:b.name||''},gotrue_meta_security:{}});if(x.access_token){save(x);return await api('me')}return {confirmationRequired:true}}
if(path==='logout'){let t=await token();try{if(t)await request('/auth/v1/logout','POST',{},t)}finally{save(null)}return {ok:true}}
let t=await token();return request('/functions/v1/techstore-api?path='+encodeURIComponent('/api/'+path),b===undefined?'GET':'POST',b,t)}
return {api};
})();