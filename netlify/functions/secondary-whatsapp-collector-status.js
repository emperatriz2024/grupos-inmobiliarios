import {eventResponseToResponse,json,requestToEvent,secureEqual} from './_secondary-http.js';

export function createCollectorStatusHandler({env=process.env,fetchImpl=fetch}={}){return async event=>{
  if(event.httpMethod!=='GET')return json(405,{error:'method_not_allowed'});
  const base=String(env.RADAR_COLLECTOR_URL||'').replace(/\/$/,''),token=env.RADAR_COLLECTOR_M2M_TOKEN;if(!base||!token)return json(503,{error:'collector_not_configured'});
  try{const response=await fetchImpl(`${base}/internal/status`,{headers:{authorization:`Bearer ${token}`}});if(!response.ok)return json(503,{error:'collector_unavailable'});const status=await response.json();return json(200,{state:status.state,qr_available:Boolean(status.qr_available),qr_data_url:status.qr_available&&typeof status.qr_data_url==='string'?status.qr_data_url:null,last_ready_at:status.last_ready_at||null,last_error:status.last_error||null,groups:Number(status.groups||0)});}catch{return json(503,{error:'collector_unavailable'});}
};}
const handler=createCollectorStatusHandler();
export default async request=>eventResponseToResponse(await handler(await requestToEvent(request)));
