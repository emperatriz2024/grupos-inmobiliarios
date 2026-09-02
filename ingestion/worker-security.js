import {timingSafeEqual} from 'node:crypto';

const clean=value=>String(value||'').trim().replace(/\/$/,'');
export function deploymentOrigin(env=process.env){
  const value=clean(env.DEPLOY_PRIME_URL||env.URL||env.DEPLOY_URL);
  if(!value)throw new Error('worker_deployment_url_missing');
  const url=new URL(value);
  if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('worker_deployment_url_invalid');
  return url.origin;
}
export function sameDeploymentOrigin(event={},env=process.env){
  const supplied=clean(event.headers?.origin||event.headers?.Origin||'');
  if(!supplied)return false;
  try{return new URL(supplied).origin===deploymentOrigin(env);}catch{return false;}
}
export function workerToken(env=process.env){return clean(env.RADAR_INGESTION_WORKER_TOKEN);}
export function validWorkerToken(event={},env=process.env){
  const expected=workerToken(env),actual=clean(event.headers?.['x-radar-worker-token']||event.headers?.['X-Radar-Worker-Token']);
  if(!expected||!actual)return false;
  const a=Buffer.from(actual),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);
}
