export const SECONDARY_SOURCE_TYPE='whatsapp_secondary';
export const SECONDARY_SOURCE_CHANNEL='secondary_number';
export const TEST_STORE_NAME='radar-secondary-whatsapp-v061-test';
export const MAX_BATCH_EVENTS=100;
export const MAX_BODY_BYTES=512_000;
export const RAW_RETENTION_DAYS=14;
export const IDEMPOTENCY_RETENTION_DAYS=30;

const MESSAGE_TYPES=new Set(['chat','image','document','audio','video','ptt','sticker','unknown']);
const text=(v,max=4000)=>typeof v==='string'?v.slice(0,max):'';
const iso=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toISOString():null;};

export function normalizePhoneIdentity(raw=''){
  const value=String(raw||'').trim();
  if(!value)return {authorPhone:null,authorIdentifier:null,phoneStatus:'unknown'};
  const user=value.split('@')[0];
  if(/^[1-9]\d{7,14}$/.test(user)&&/@c\.us$/i.test(value))return {authorPhone:user,authorIdentifier:value,phoneStatus:'verified'};
  return {authorPhone:null,authorIdentifier:value,phoneStatus:'unverifiable'};
}

export function validateSecondaryEvent(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))return {ok:false,error:'event_not_object'};
  const messageId=text(input.messageId,240).trim(),groupId=text(input.groupId,240).trim();
  const timestamp=iso(input.timestamp),receivedAt=iso(input.receivedAt);
  if(!messageId)return {ok:false,error:'messageId_required'};
  if(!groupId||!/@g\.us$/i.test(groupId))return {ok:false,error:'groupId_invalid'};
  if(!timestamp||!receivedAt)return {ok:false,error:'timestamp_invalid'};
  const identity=normalizePhoneIdentity(input.authorIdentifier||input.authorId||input.authorPhone||'');
  const event={
    messageId,groupId,groupName:text(input.groupName,300),authorId:text(input.authorId||input.authorIdentifier,240),
    authorDisplayName:text(input.authorDisplayName,300),...identity,timestamp,receivedAt,
    messageType:MESSAGE_TYPES.has(input.messageType)?input.messageType:'unknown',text:text(input.text??input.body,20_000),
    caption:text(input.caption,20_000),hasMedia:Boolean(input.hasMedia),mediaType:text(input.mediaType,100)||null,
    quotedMessageId:text(input.quotedMessageId,240)||null,sourceType:SECONDARY_SOURCE_TYPE,sourceChannel:SECONDARY_SOURCE_CHANNEL
  };
  if(!event.text&&!event.caption&&!event.hasMedia)return {ok:false,error:'empty_event'};
  return {ok:true,event};
}

export function validateBatch(input={}){
  if(!input||typeof input!=='object'||!Array.isArray(input.events))return {ok:false,error:'events_required'};
  if(!input.events.length||input.events.length>MAX_BATCH_EVENTS)return {ok:false,error:'batch_size_invalid'};
  const events=[];for(const raw of input.events){const result=validateSecondaryEvent(raw);if(!result.ok)return result;events.push(result.event);}
  return {ok:true,batchId:text(input.batchId,240)||null,events};
}

export function eventStorageKey(event={}){
  const value=typeof event==='string'?{messageId:event,receivedAt:0}:event;
  const time=Number.isFinite(Date.parse(value.receivedAt))?Date.parse(value.receivedAt):0;
  return `event-${String(time).padStart(13,'0')}-${encodeURIComponent(String(value.messageId||''))}`;
}
export function eventIdKey(messageId=''){return `id-${encodeURIComponent(String(messageId))}`;}
export function validCursor(cursor=''){return cursor===''||/^event-\d{13}-[A-Za-z0-9_.~%!-]{1,720}$/.test(String(cursor));}
