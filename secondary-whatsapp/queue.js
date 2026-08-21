import {eventIdKey,eventStorageKey,IDEMPOTENCY_RETENTION_DAYS,RAW_RETENTION_DAYS} from './contract.js';

export class MemoryEventQueue{
  constructor(){this.events=new Map();}
  async put(event){const duplicate=this.events.has(event.messageId);if(!duplicate)this.events.set(event.messageId,event);return {duplicate};}
  async list({cursor='',limit=100}={}){const rows=[...this.events.values()].map(event=>({event,key:eventStorageKey(event)})).sort((a,b)=>a.key.localeCompare(b.key));const start=cursor?rows.findIndex(x=>x.key===cursor)+1:0,page=rows.slice(Math.max(0,start),Math.max(0,start)+Math.min(100,limit));return {events:page.map(x=>x.event),nextCursor:page.at(-1)?.key||cursor,hasMore:start+page.length<rows.length};}
  async purgeExpired({now=Date.now(),rawDays=RAW_RETENTION_DAYS}={}){let removed=0;for(const [id,event] of this.events){if(now-Date.parse(event.receivedAt)>rawDays*86_400_000){this.events.delete(id);removed++;}}return {rawRemoved:removed,idempotencyRemoved:removed};}
}

export async function createNetlifyEventQueue(){
  const {getStore}=await import('@netlify/blobs');const store=getStore({name:'radar-secondary-whatsapp-v061-test',consistency:'strong'});
  return {
    async put(event){const idKey=eventIdKey(event.messageId),exists=await store.getMetadata(idKey);if(exists!==null)return {duplicate:true};const key=eventStorageKey(event);await store.setJSON(key,event);await store.setJSON(idKey,{eventKey:key,receivedAt:event.receivedAt});return {duplicate:false};},
    async list({cursor='',limit=100}={}){const result=await store.list({prefix:'event-'}),keys=result.blobs.map(x=>x.key).sort(),cursorIndex=cursor?keys.indexOf(cursor):-1,start=cursorIndex>=0?cursorIndex+1:0,page=keys.slice(start,start+Math.min(100,limit));const events=(await Promise.all(page.map(key=>store.get(key,{type:'json'})))).filter(Boolean);return {events,nextCursor:page.at(-1)||cursor,hasMore:start+page.length<keys.length};},
    async purgeExpired({now=Date.now(),rawDays=RAW_RETENTION_DAYS,idempotencyDays=IDEMPOTENCY_RETENTION_DAYS}={}){let rawRemoved=0,idempotencyRemoved=0;const raw=await store.list({prefix:'event-'});for(const {key} of raw.blobs){const time=Number(key.slice(6,19));if(Number.isFinite(time)&&now-time>rawDays*86_400_000){await store.delete(key);rawRemoved++;}}const ids=await store.list({prefix:'id-'});for(const {key} of ids.blobs){const value=await store.get(key,{type:'json'}),time=Date.parse(value?.receivedAt);if(Number.isFinite(time)&&now-time>idempotencyDays*86_400_000){await store.delete(key);idempotencyRemoved++;}}return {rawRemoved,idempotencyRemoved};}
  };
}
