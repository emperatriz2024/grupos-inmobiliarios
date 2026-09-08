import {getStore} from '@netlify/blobs';
import {bearer,eventResponseToResponse,json,parseJsonBody,requestToEvent,secureEqual} from './_secondary-http.js';

const SHA=/^[a-f0-9]{64}$/;
const outputText=value=>value?.output_text||value?.choices?.[0]?.message?.content||'';
const parseResult=value=>{const raw=outputText(value).replace(/^```(?:json)?\s*|\s*```$/g,'').trim();try{return JSON.parse(raw);}catch{return {summary:raw||null};}};
export function createIntelligenceHandler({env=process.env,storeFactory=getStore,fetchImpl=fetch}={}){return async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'method_not_allowed'});
  if(!env.RADAR_COLLECTOR_M2M_TOKEN||!secureEqual(bearer(event.headers),env.RADAR_COLLECTOR_M2M_TOKEN))return json(401,{error:'unauthorized'});
  const parsed=parseJsonBody(event);if(!parsed.ok)return parsed.response;const input=parsed.value||{},sha=String(input.media?.sha256||''),messageId=String(input.messageId||'').slice(0,240);if(!messageId)return json(422,{error:'message_id_required'});
  let imageUrl=null;if(SHA.test(sha)){const thumbnail=await storeFactory({name:'radar-whatsapp-media-production',consistency:'strong'}).get(`thumbnail/${sha}`,{type:'arrayBuffer'});if(thumbnail)imageUrl=`data:image/jpeg;base64,${Buffer.from(thumbnail).toString('base64')}`;}
  const content=[{type:'input_text',text:`Extrae datos inmobiliarios y responde SOLO JSON. Campos: is_real_estate, summary, property_type, operation, zone, municipality, residence, price_usd, area_m2, bedrooms, bathrooms, parking, contact_phone, amenities, demand. No inventes datos. Mensaje:\n${String(input.text||input.caption||'').slice(0,12000)}`}];if(imageUrl)content.push({type:'input_image',image_url:imageUrl});
  const headers={'content-type':'application/json'};if(env.OPENAI_API_KEY)headers.authorization=`Bearer ${env.OPENAI_API_KEY}`;const model=env.RADAR_MULTIMODAL_MODEL||'gpt-4o-mini';const response=await fetchImpl(`${env.OPENAI_BASE_URL||'https://api.openai.com/v1'}/responses`,{method:'POST',headers,body:JSON.stringify({model,input:[{role:'user',content}],temperature:0})});if(!response.ok)return json(503,{error:'intelligence_unavailable'});
  const result=parseResult(await response.json()),record={message_id:messageId,media_sha256:SHA.test(sha)?sha:null,result,processed_at:new Date().toISOString(),model};await storeFactory({name:'radar-whatsapp-intelligence-analysis',consistency:'strong'}).setJSON(`message/${encodeURIComponent(messageId)}`,record);return json(200,record);
};}
const handler=createIntelligenceHandler();export default async request=>eventResponseToResponse(await handler(await requestToEvent(request)));
