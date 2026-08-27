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
  const records=[],nonProperty=[],attachments=valid.filter(event=>event.hasMedia).map(event=>({id:`att_secondary_${event.messageId}`,source_message_id:null,external_message_id:event.messageId,external_media_id:event.messageId,provenance_status:'UNRESOLVED',media_type:/image/i.test(event.mediaType)?'IMAGE':/video/i.test(event.mediaType)?'VIDEO':/audio|ptt/i.test(event.mediaType)?'AUDIO':/document/i.test(event.mediaType)?'DOCUMENT':'UNKNOWN',mime_type:null,original_filename:null,size_bytes:null,width:null,height:null,duration_ms:null,sha256:null,storage_locator:null,media_status:'OBSERVED',received_at:event.receivedAt,ingested_at:new Date().toISOString(),metadata_json:{source_type:event.sourceType,source_channel:event.sourceChannel,group_id:event.groupId,group_name:event.groupName,message_type:event.messageType},created_at:new Date().toISOString()}));
  for(const bundle of groupConsecutiveEvents(valid)){
    if(!looksLikeRealEstate(bundle.text)){nonProperty.push(...bundle.events.map(x=>x.messageId));continue;}
    const first=bundle.events[0],date=new Date(first.timestamp),message={group:first.groupName||first.groupId,sender:first.authorDisplayName||first.authorId||'Autor no verificable',date:date.toLocaleDateString('en-US'),date_iso:date.toISOString().slice(0,10),date_order:'MDY',time:date.toTimeString().slice(0,8),text:bundle.text};
    const record=extractProperty(message,{locationCatalog,sourceType:'whatsapp_secondary',sourceChannel:'secondary_number',sourceId:first.messageId,importedAt:first.receivedAt});
    if(!record){nonProperty.push(...bundle.events.map(x=>x.messageId));continue;}
    record.publisher={observed_name:first.authorDisplayName||null,observed_identifier:first.authorIdentifier||first.authorId||null,observed_phone:first.authorPhone||null,phone_status:first.phoneStatus||'unknown',role:'publisher_observed'};
    record.sources=[{group:record.group,sender:record.sender,date:record.date,date_iso:record.date_iso,date_order:record.date_order,time:record.time,phone:record.phone,messageId:first.messageId,sourceType:'whatsapp_secondary',sourceChannel:'secondary_number'}];records.push(record);
  }
  return {records,attachments,validCount:valid.length,invalid,nonProperty,propertiesDetected:records.length,groupsDetected:new Set(valid.map(x=>x.groupId)).size};
}

export function resolveSecondaryAttachmentSource(attachment,sourceMessage){
  if(!attachment?.external_message_id||attachment.external_message_id!==sourceMessage?.external_message_id)throw new Error('attachment_source_message_mismatch');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(sourceMessage.id||'')))throw new Error('internal_source_message_uuid_required');
  return {...attachment,source_message_id:sourceMessage.id,provenance_status:'RESOLVED'};
}
