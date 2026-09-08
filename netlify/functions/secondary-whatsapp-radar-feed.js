import {createNetlifyEventQueue} from '../../secondary-whatsapp/queue.js';
import {eventResponseToResponse,json,requestToEvent} from './_secondary-http.js';
import {validCursor} from '../../secondary-whatsapp/contract.js';

export function createRadarFeedHandler({queueFactory=createNetlifyEventQueue}={}){return async event=>{
  if(event.httpMethod!=='GET')return json(405,{error:'method_not_allowed'});const site=String(event.headers?.['sec-fetch-site']||event.headers?.['Sec-Fetch-Site']||'');if(site&&site!=='same-origin'&&site!=='none')return json(403,{error:'forbidden'});
  const cursor=String(event.queryStringParameters?.cursor||''),limit=Math.min(100,Math.max(1,Number(event.queryStringParameters?.limit)||50));if(!validCursor(cursor))return json(400,{error:'cursor_invalid'});try{return json(200,await (await queueFactory(event)).list({cursor,limit}));}catch{return json(503,{error:'queue_unavailable'});}
};}
const handler=createRadarFeedHandler();export default async request=>eventResponseToResponse(await handler(await requestToEvent(request)));
