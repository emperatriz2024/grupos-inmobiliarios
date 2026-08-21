import {validateBatch} from '../../secondary-whatsapp/contract.js';
import {createNetlifyEventQueue} from '../../secondary-whatsapp/queue.js';
import {bearer,json,parseJsonBody,secureEqual} from './_secondary-http.js';
import {allowedOrigin,rateLimit,withCors} from './_secondary-security.js';

export function createIngestHandler({queueFactory=createNetlifyEventQueue,env=process.env,now=()=>Date.now()}={}){let lastPurgeAt=0;return async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'method_not_allowed'});
  const origin=allowedOrigin(event,env);if(!origin.ok)return origin.response;
  const limited=rateLimit(event,{scope:'ingest',limit:60});if(limited)return withCors(limited,origin.origin);
  const expected=env.RADAR_BRIDGE_INGEST_TOKEN;if(!expected||!secureEqual(bearer(event.headers),expected))return json(401,{error:'unauthorized'});
  const parsed=parseJsonBody(event);if(!parsed.ok)return parsed.response;
  const valid=validateBatch(parsed.value);if(!valid.ok)return json(422,{error:valid.error});
  try{const queue=await queueFactory(event);let accepted=0,duplicates=0;
    for(const item of valid.events){const result=await queue.put(item);result.duplicate?duplicates++:accepted++;}
    const current=now();if(current-lastPurgeAt>=3_600_000){await queue.purgeExpired?.({now:current});lastPurgeAt=current;}return withCors(json(202,{accepted,duplicates,total:valid.events.length}),origin.origin);
  }catch{return withCors(json(503,{error:'queue_unavailable'}),origin.origin);}
};}
export const handler=createIngestHandler();
