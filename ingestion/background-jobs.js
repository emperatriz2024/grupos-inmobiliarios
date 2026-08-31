import {createHash,randomUUID} from 'node:crypto';
import {getStore} from '@netlify/blobs';
import {extractWhatsAppChat,decodeChat} from '../zip-reader.js';
import {processChatText} from '../engine.js';

export const INGESTION_STORE='radar-operational-ingestion-v1';
const now=()=>new Date().toISOString(),safeError=error=>String(error?.message||error||'worker_failed').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').slice(0,240);
const jobKey=id=>`job-${id}`,batchKey=id=>`batch-${id}`,resultKey=(id,index)=>`result-${id}-${String(index).padStart(5,'0')}`,hashKey=hash=>`hash-${hash}`;

export function createMemoryJobStore(){const data=new Map();return {async get(key){return structuredClone(data.get(key)??null);},async set(key,value){data.set(key,structuredClone(value));},async list(prefix){return [...data.keys()].filter(key=>key.startsWith(prefix)).sort();}};}
export function createNetlifyJobStore(){const store=getStore({name:INGESTION_STORE,consistency:'strong'});return {get:key=>store.get(key,{type:'json'}),set:(key,value)=>store.setJSON(key,value),async list(prefix){const page=await store.list({prefix});return page.blobs.map(row=>row.key).sort();}};}
export async function createBatch(entries,{store,buildSha='unknown'}={}){
  const id=randomUUID(),createdAt=now(),jobs=[];
  for(const entry of entries){const job={id:randomUUID(),batch_id:id,name:entry.name,path:entry.path_lower||entry.path_display||entry.path,status:'QUEUED',checkpoint:'QUEUED',progress:{done:0,total:0},attempts:0,created_at:createdAt,updated_at:createdAt,heartbeat_at:createdAt};jobs.push(job);await store.set(jobKey(job.id),job);}
  const batch={id,status:jobs.length?'RUNNING':'COMPLETED',build_sha:buildSha,total:jobs.length,created_at:createdAt,updated_at:createdAt,job_ids:jobs.map(row=>row.id)};await store.set(batchKey(id),batch);return {batch,jobs};
}
export async function batchStatus(id,{store}={}){const batch=await store.get(batchKey(id));if(!batch)return null;const jobs=(await Promise.all(batch.job_ids.map(jobId=>store.get(jobKey(jobId))))).filter(Boolean),completed=jobs.filter(row=>row.status==='COMPLETED').length,failed=jobs.filter(row=>row.status==='FAILED').length,running=jobs.filter(row=>!['COMPLETED','FAILED'].includes(row.status)).length,status=running?'RUNNING':failed?'COMPLETED_WITH_ERRORS':'COMPLETED';const updated={...batch,status,completed,failed,running,updated_at:now()};await store.set(batchKey(id),updated);return {...updated,jobs:jobs.map(({path,...row})=>row)};}
async function patchJob(store,id,patch){const current=await store.get(jobKey(id));if(!current)throw new Error('job_not_found');const row={...current,...patch,updated_at:now(),heartbeat_at:now()};await store.set(jobKey(id),row);return row;}
export async function retryJob(id,{store}={}){const job=await store.get(jobKey(id));if(!job||job.status!=='FAILED')throw new Error('job_not_retryable');return patchJob(store,id,{status:'QUEUED',checkpoint:job.result_chunks!=null&&job.file_hash?'RESULT_SAVED':'QUEUED',error:null});}
export async function resultChunk(jobId,index,{store}={}){const job=await store.get(jobKey(jobId));if(!job||job.status!=='COMPLETED')return null;return store.get(resultKey(jobId,index));}

export async function processJob(id,{store,dropbox,chunkSize=250,clock=Date.now}={}){
  let job=await store.get(jobKey(id));if(!job)return {ignored:true,reason:'job_not_found'};if(job.status==='COMPLETED')return {duplicate:true,job};
  try{
    job=await patchJob(store,id,{status:'RUNNING',checkpoint:job.checkpoint||'QUEUED',attempts:Number(job.attempts||0)+1,started_at:job.started_at||now()});
    if(job.checkpoint!=='RESULT_SAVED'){
      job=await patchJob(store,id,{checkpoint:'DOWNLOADING',progress:{done:0,total:1}});const bytes=await dropbox.download(job.path),fileHash=createHash('sha256').update(bytes).digest('hex'),existing=await store.get(hashKey(fileHash));
      if(existing?.status==='COMPLETED'&&existing.job_id!==id){await dropbox.move(job.path,job.name);job=await patchJob(store,id,{status:'COMPLETED',checkpoint:'COMPLETED',file_hash:fileHash,duplicate_of:existing.job_id,result_chunks:0,progress:{done:1,total:1},finished_at:now()});return {duplicate:true,job};}
      await store.set(hashKey(fileHash),{status:'PROCESSING',job_id:id,updated_at:now()});job=await patchJob(store,id,{checkpoint:'ANALYZING',file_hash:fileHash,progress:{done:0,total:1}});
      const file={arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)},extracted=await extractWhatsAppChat(file),text=decodeChat(extracted.bytes),group=String(job.name||'').replace(/\.zip$/i,'').replace(/^WhatsApp Chat\s*-?\s*/i,'').trim()||'Grupo inmobiliario';
      const result=processChatText(text,group,{maxAgeDays:60,now:clock()}),rows=result.unique||[],chunks=Math.ceil(rows.length/chunkSize);
      for(let index=0;index<chunks;index++){await store.set(resultKey(id,index),{index,properties:rows.slice(index*chunkSize,(index+1)*chunkSize),demand_messages:index===0?(result.demand_messages||[]):[],location_pendings:index===0?(result.location_pendings||[]):[]});await patchJob(store,id,{checkpoint:'RESULT_SAVING',progress:{done:index+1,total:chunks}});}
      job=await patchJob(store,id,{checkpoint:'RESULT_SAVED',result_chunks:chunks,result_summary:{messages:result.messages,detected:result.properties_detected,unique:rows.length,entry_name:extracted.entryName},progress:{done:chunks,total:chunks}});
    }
    await patchJob(store,id,{checkpoint:'MOVING'});await dropbox.move(job.path,job.name);job=await patchJob(store,id,{status:'COMPLETED',checkpoint:'COMPLETED',finished_at:now()});await store.set(hashKey(job.file_hash),{status:'COMPLETED',job_id:id,updated_at:now()});return {job};
  }catch(error){job=await patchJob(store,id,{status:'FAILED',error:safeError(error),failed_at:now()});return {error:job.error,job};}
}
