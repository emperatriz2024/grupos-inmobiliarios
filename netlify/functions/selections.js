import { getStore } from '@netlify/blobs';
import { buildPublicSelection, publicSelectionAvailable, randomSelectionSlug } from '../../selection-utils.js';

const STORE_NAME='radar-public-selections-v060';
const MAX_BODY_BYTES=250000;
const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};

const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});
const slugFrom=request=>{
  const path=new URL(request.url).pathname.replace(/\/+$/,'');
  const markers=['/api/selections/','/.netlify/functions/selections/'];
  const marker=markers.find(value=>path.includes(value));
  return marker?decodeURIComponent(path.slice(path.indexOf(marker)+marker.length)):'';
};
const validSlug=slug=>/^[a-z0-9]{16,32}$/i.test(slug);

function sameSecret(a='',b=''){
  const left=new TextEncoder().encode(String(a)),right=new TextEncoder().encode(String(b));
  let diff=left.length^right.length;
  for(let i=0;i<Math.max(left.length,right.length);i++)diff|=(left[i%Math.max(1,left.length)]||0)^(right[i%Math.max(1,right.length)]||0);
  return diff===0&&left.length>0;
}

async function readJson(request){
  const length=Number(request.headers.get('content-length')||0);
  if(length>MAX_BODY_BYTES)throw Object.assign(new Error('payload_too_large'),{status:413});
  const text=await request.text();
  if(new TextEncoder().encode(text).length>MAX_BODY_BYTES)throw Object.assign(new Error('payload_too_large'),{status:413});
  try{return JSON.parse(text||'{}');}catch{throw Object.assign(new Error('invalid_json'),{status:400});}
}

function authorized(request,env){
  const expected=env.RADAR_SELECTION_ADMIN_TOKEN||'';
  const supplied=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  return sameSecret(supplied,expected);
}

function queue(){return getStore({name:STORE_NAME,consistency:'strong'});}

export function createSelectionHandler({getStoreImpl=queue,env=process.env}={}){
  return async request=>{
    const method=request.method.toUpperCase(),slug=slugFrom(request);
    try{
      if(method==='GET'){
        if(!validSlug(slug))return json(404,{error:'selection_not_found'});
        const store=getStoreImpl();
        const payload=await store.get(`selection:${slug}`,{type:'json'});
        if(!payload||!publicSelectionAvailable(payload))return json(404,{error:'selection_not_found'});
        return json(200,payload);
      }
      if(!authorized(request,env))return json(401,{error:'unauthorized'});
      const store=getStoreImpl();
      if(method==='POST'){
        const body=await readJson(request),newSlug=randomSelectionSlug();
        const payload=buildPublicSelection({...body,public_slug:newSlug,status:'active'},body.properties||[]);
        await store.setJSON(`selection:${newSlug}`,payload,{metadata:{status:'active',updated_at:payload.updated_at}});
        return json(201,{slug:newSlug,status:'active',url:`/s/${newSlug}`});
      }
      if(!validSlug(slug))return json(404,{error:'selection_not_found'});
      const current=await store.get(`selection:${slug}`,{type:'json'});
      if(!current)return json(404,{error:'selection_not_found'});
      if(method==='PUT'){
        const body=await readJson(request);
        const payload=buildPublicSelection({...current,...body,public_slug:slug,status:body.status||current.status||'active',updated_at:new Date().toISOString()},body.properties||current.properties||[]);
        await store.setJSON(`selection:${slug}`,payload,{metadata:{status:payload.status,updated_at:payload.updated_at}});
        return json(200,{slug,status:payload.status,url:`/s/${slug}`});
      }
      if(method==='DELETE'){
        const payload={...current,status:'disabled',updated_at:new Date().toISOString(),properties:[]};
        await store.setJSON(`selection:${slug}`,payload,{metadata:{status:'disabled',updated_at:payload.updated_at}});
        return json(200,{slug,status:'disabled'});
      }
      return json(405,{error:'method_not_allowed'});
    }catch(error){
      console.error('SELECTION_STORE_ERROR',{name:error?.name||'Error',code:error?.status?'client_input':'storage_failure'});
      return json(error?.status||503,{error:error?.status?error.message:'selection_unavailable'});
    }
  };
}

export default createSelectionHandler();
