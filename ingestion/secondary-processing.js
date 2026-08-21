import {extractProperty,isPropertyPost} from '../engine.js';
import {validateSecondaryEvent} from '../secondary-whatsapp/contract.js';

const LISTING_LEAD=/\b(apartamento|apto\.?|casa|town\s*house|townhouse|penthouse|terreno|parcela|local\s+comercial|oficina|galp[oó]n)\b/i;
const CONTINUATION_SIGNAL=/\b(hab(?:itaciones?)?|baños?|puestos?|m[²2]|precio|planta|pozo|tanque|piscina|amoblad[oa])\b|\$/i;
export function looksLikeRealEstate(text=''){return isPropertyPost(String(text));}

export function groupConsecutiveEvents(events=[],windowMs=120_000){
  const sorted=[...events].sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));const groups=[];
  for(const event of sorted){const previous=groups.at(-1),body=[event.text,event.caption].filter(Boolean).join('\n').trim();if(!body)continue;
    const canJoin=previous&&previous.groupId===event.groupId&&previous.authorId===event.authorId&&Date.parse(event.timestamp)-Date.parse(previous.lastAt)<=windowMs&&(looksLikeRealEstate(previous.text)||LISTING_LEAD.test(previous.text))&&CONTINUATION_SIGNAL.test(body);
    if(canJoin){previous.events.push(event);previous.text+=`\n${body}`;previous.lastAt=event.timestamp;}else groups.push({groupId:event.groupId,groupName:event.groupName,authorId:event.authorId,authorDisplayName:event.authorDisplayName,events:[event],text:body,lastAt:event.timestamp});
  }
  return groups;
}

export function processSecondaryEvents(rawEvents=[],{locationCatalog=null}={}){
  const valid=[],invalid=[];for(const raw of rawEvents){const result=validateSecondaryEvent(raw);result.ok?valid.push(result.event):invalid.push({messageId:raw?.messageId||null,error:result.error});}
  const records=[],nonProperty=[];
  for(const bundle of groupConsecutiveEvents(valid)){
    if(!looksLikeRealEstate(bundle.text)){nonProperty.push(...bundle.events.map(x=>x.messageId));continue;}
    const first=bundle.events[0],date=new Date(first.timestamp),message={group:first.groupName||first.groupId,sender:first.authorDisplayName||first.authorId||'Autor no verificable',date:date.toLocaleDateString('en-US'),date_iso:date.toISOString().slice(0,10),date_order:'MDY',time:date.toTimeString().slice(0,8),text:bundle.text};
    const record=extractProperty(message,{locationCatalog,sourceType:'whatsapp_secondary',sourceChannel:'secondary_number',sourceId:first.messageId,importedAt:first.receivedAt});
    if(!record){nonProperty.push(...bundle.events.map(x=>x.messageId));continue;}
    record.publisher={observed_name:first.authorDisplayName||null,observed_identifier:first.authorIdentifier||first.authorId||null,observed_phone:first.authorPhone||null,phone_status:first.phoneStatus||'unknown',role:'publisher_observed'};
    record.sources=[{group:record.group,sender:record.sender,date:record.date,date_iso:record.date_iso,date_order:record.date_order,time:record.time,phone:record.phone,messageId:first.messageId,sourceType:'whatsapp_secondary',sourceChannel:'secondary_number'}];records.push(record);
  }
  return {records,validCount:valid.length,invalid,nonProperty,propertiesDetected:records.length,groupsDetected:new Set(valid.map(x=>x.groupId)).size};
}
