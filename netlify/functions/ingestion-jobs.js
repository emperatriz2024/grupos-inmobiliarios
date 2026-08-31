import {createBatch,batchStatus,createNetlifyJobStore,resultChunk,retryJob} from '../../ingestion/background-jobs.js';
import {createServerDropbox} from '../../ingestion/server-dropbox.js';

const response=(statusCode,body)=>({statusCode,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify(body)});
const originOf=event=>`https://${event.headers?.host||event.headers?.Host}`;
async function dispatch(event,jobId,fetchImpl=fetch){const result=await fetchImpl(`${originOf(event)}/.netlify/functions/ingestion-worker-background`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({job_id:jobId})});if(!result.ok)throw new Error('worker_dispatch_failed');}
export async function handler(event){
  const store=createNetlifyJobStore(),method=event.httpMethod||'GET',query=event.queryStringParameters||{};
  try{
    if(method==='GET'&&query.batch){const state=await batchStatus(query.batch,{store});return state?response(200,state):response(404,{error:'batch_not_found'});}
    if(method==='GET'&&query.job&&query.chunk!=null){const chunk=await resultChunk(query.job,Number(query.chunk),{store});return chunk?response(200,chunk):response(404,{error:'result_not_found'});}
    if(method==='GET')return response(200,{build_sha:process.env.COMMIT_REF||process.env.BRANCH||'local',worker:'ready'});
    if(method!=='POST')return response(405,{error:'method_not_allowed'});
    const body=JSON.parse(event.body||'{}');
    if(body.action==='retry'){const job=await retryJob(body.job_id,{store});await dispatch(event,job.id);return response(202,{accepted:true,job_id:job.id});}
    const entries=await createServerDropbox().listPending(),created=await createBatch(entries,{store,buildSha:process.env.COMMIT_REF||'local'});const dispatchErrors=[];
    for(const job of created.jobs)try{await dispatch(event,job.id);}catch(error){dispatchErrors.push(job.id);}
    return response(202,{batch_id:created.batch.id,total:created.batch.total,build_sha:created.batch.build_sha,dispatch_errors:dispatchErrors.length});
  }catch(error){return response(503,{error:String(error?.message||'ingestion_unavailable').slice(0,120)});}
}
export default async request=>{const url=new URL(request.url),event={httpMethod:request.method,headers:Object.fromEntries(request.headers),queryStringParameters:Object.fromEntries(url.searchParams),body:request.method==='GET'?null:await request.text()};const result=await handler(event);return new Response(result.body,{status:result.statusCode,headers:result.headers});};
