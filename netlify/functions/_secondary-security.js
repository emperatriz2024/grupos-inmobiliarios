import {json} from './_secondary-http.js';

const buckets=new Map();
export function clientKey(event={}){return String(event.headers?.['x-nf-client-connection-ip']||event.headers?.['x-forwarded-for']||event.headers?.['client-ip']||'unknown').split(',')[0].trim().slice(0,80);}
export function rateLimit(event,{scope='default',limit=60,windowMs=60_000,now=Date.now()}={}){
  const key=`${scope}:${clientKey(event)}`,current=buckets.get(key);if(!current||now-current.startedAt>=windowMs){buckets.set(key,{startedAt:now,count:1});return null;}current.count++;if(current.count<=limit)return null;const retryAfter=Math.max(1,Math.ceil((windowMs-(now-current.startedAt))/1000));return {statusCode:429,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','retry-after':String(retryAfter)},body:JSON.stringify({error:'rate_limited'})};
}
export function resetRateLimits(){buckets.clear();}

export function allowedOrigin(event={},env=process.env){
  const origin=String(event.headers?.origin||event.headers?.Origin||'').replace(/\/$/,'');if(!origin)return {ok:true,origin:null};
  const configured=String(env.RADAR_SECONDARY_ALLOWED_ORIGIN||'').replace(/\/$/,'');
  const host=String(event.headers?.host||event.headers?.Host||'');const sameHost=host&&origin===`https://${host}`;
  return configured&&origin===configured||sameHost?{ok:true,origin}:{ok:false,response:json(403,{error:'origin_not_allowed'})};
}

export function withCors(response,origin){if(!origin)return response;return {...response,headers:{...response.headers,'access-control-allow-origin':origin,'vary':'Origin'}};}
export function preflight(event,env){const origin=allowedOrigin(event,env);if(!origin.ok)return origin.response;return withCors({statusCode:204,headers:{'cache-control':'no-store','access-control-allow-methods':'GET, OPTIONS','access-control-allow-headers':'Authorization, Content-Type'},body:''},origin.origin);}
