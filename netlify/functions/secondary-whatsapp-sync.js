import {createNetlifyEventQueue} from '../../secondary-whatsapp/queue.js';
import {bearer,json,secureEqual} from './_secondary-http.js';
import {validCursor} from '../../secondary-whatsapp/contract.js';
import {allowedOrigin,preflight,rateLimit,withCors} from './_secondary-security.js';

export function createSyncHandler({queueFactory=createNetlifyEventQueue,env=process.env}={}){return async event=>{
  if(event.httpMethod==='OPTIONS')return preflight(event,env);
  if(event.httpMethod!=='GET')return json(405,{error:'method_not_allowed'});
  const origin=allowedOrigin(event,env);if(!origin.ok)return origin.response;
  const limited=rateLimit(event,{scope:'sync',limit:120});if(limited)return withCors(limited,origin.origin);
  const expected=env.RADAR_SECONDARY_SYNC_TOKEN;if(!expected||!secureEqual(bearer(event.headers),expected))return json(401,{error:'unauthorized'});
  const cursor=String(event.queryStringParameters?.cursor||'');if(!validCursor(cursor))return withCors(json(400,{error:'cursor_invalid'}),origin.origin);
  const limit=Math.min(100,Math.max(1,Number(event.queryStringParameters?.limit)||50));
  try{const queue=await queueFactory(event),page=await queue.list({cursor,limit});return withCors(json(200,page),origin.origin);}catch{return withCors(json(503,{error:'queue_unavailable'}),origin.origin);}
};}
export const handler=createSyncHandler();
