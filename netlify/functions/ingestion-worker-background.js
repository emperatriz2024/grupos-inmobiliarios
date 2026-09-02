import {createNetlifyJobStore,processJob} from '../../ingestion/background-jobs.js';
import {createServerDropbox} from '../../ingestion/server-dropbox.js';
import {validWorkerToken} from '../../ingestion/worker-security.js';

export async function handler(event){if(!validWorkerToken(event))return {statusCode:401,body:'unauthorized'};let body={};try{body=JSON.parse(event.body||'{}');}catch{return {statusCode:400,body:'invalid_json'};}if(!body.job_id)return {statusCode:400,body:'job_id_required'};await processJob(body.job_id,{store:createNetlifyJobStore(),dropbox:createServerDropbox()});return {statusCode:202,headers:{'content-type':'application/json'},body:JSON.stringify({accepted:true})};}
export default async request=>{const headers=Object.fromEntries(request.headers);if(!validWorkerToken({headers}))return new Response('unauthorized',{status:401});let body={};try{body=await request.json();}catch{return new Response('invalid_json',{status:400});}if(!body.job_id)return new Response('job_id_required',{status:400});await processJob(body.job_id,{store:createNetlifyJobStore(),dropbox:createServerDropbox()});return Response.json({accepted:true},{status:202});};
