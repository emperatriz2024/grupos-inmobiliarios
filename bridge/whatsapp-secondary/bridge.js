import {normalizeWhatsAppMessage} from './event-normalizer.js';

export const BRIDGE_STATES=Object.freeze({WAITING_QR:'WAITING_QR',AUTHENTICATED:'AUTHENTICATED',READY:'READY',DISCONNECTED:'DISCONNECTED',RECONNECTING:'RECONNECTING',ERROR:'ERROR'});

export class SecondaryBridge{
  constructor({client,outbox,uploader,groupState=null,logger=()=>{},flushIntervalMs=15_000,scheduleFn=setTimeout}){Object.assign(this,{client,outbox,uploader,groupState,logger,flushIntervalMs,scheduleFn});this.state=BRIDGE_STATES.DISCONNECTED;this.timer=null;this.reconnectAttempt=0;this.stats={startedAt:new Date().toISOString(),groupsSeen:new Set(),messagesReceived:0,messagesQueued:0,messagesUploaded:0,duplicatesSkipped:0,lastMessageAt:null,lastSuccessfulUploadAt:null,backfillAttempts:0,backfillErrors:0};}
  setState(state,detail={}){this.state=state;this.logger(state,detail);}
  async accept(message){const event=await normalizeWhatsAppMessage(message);if(!event)return {ignored:true};this.stats.groupsSeen.add(event.groupId);this.stats.messagesReceived++;this.stats.lastMessageAt=event.receivedAt;this.logger('GROUP_MESSAGE_RECEIVED',{groupId:event.groupId,messageId:event.messageId});if(await this.groupState?.has(event.groupId,event.messageId)){this.stats.duplicatesSkipped++;this.logger('DUPLICATE_SKIPPED',{messageId:event.messageId,scope:'group_cursor'});return {duplicate:true};}const result=await this.outbox.enqueue(event);if(result.duplicate){this.stats.duplicatesSkipped++;this.logger('DUPLICATE_SKIPPED',{messageId:event.messageId});return result;}await this.groupState?.observe(event);this.stats.messagesQueued++;this.logger('QUEUED',{messageId:event.messageId});return result;}
  async flush(){const result=await this.uploader.flush();if(result.uploaded){this.stats.messagesUploaded+=result.uploaded;this.stats.lastSuccessfulUploadAt=new Date().toISOString();}return result;}
  wire(){
    this.client.on('qr',qr=>{this.setState(BRIDGE_STATES.WAITING_QR);this.onQr?.(qr);});
    this.client.on('authenticated',()=>this.setState(BRIDGE_STATES.AUTHENTICATED));
    this.client.on('ready',()=>{this.reconnectAttempt=0;this.setState(BRIDGE_STATES.READY);this.startFlushLoop();this.backfill().catch(()=>{});});
    this.client.on('message',message=>this.accept(message).then(()=>this.flush()).catch(error=>this.setState(BRIDGE_STATES.ERROR,{message:error.message})));
    this.client.on('auth_failure',message=>this.setState(BRIDGE_STATES.ERROR,{operation:'authentication',message}));
    this.client.on('disconnected',reason=>{this.setState(BRIDGE_STATES.DISCONNECTED,{reason});this.stopFlushLoop();this.scheduleReconnect();});
  }
  startFlushLoop(){this.stopFlushLoop();this.timer=setInterval(()=>this.flush().catch(()=>{}),this.flushIntervalMs);this.timer.unref?.();}
  stopFlushLoop(){if(this.timer)clearInterval(this.timer);this.timer=null;}
  scheduleReconnect(){this.reconnectAttempt++;const delay=Math.min(300_000,5000*2**Math.min(6,this.reconnectAttempt-1));this.setState(BRIDGE_STATES.RECONNECTING,{attempt:this.reconnectAttempt,retryInMs:delay});const timer=this.scheduleFn(()=>this.client.initialize().catch(error=>{this.setState(BRIDGE_STATES.ERROR,{operation:'reconnect',message:error.message});this.scheduleReconnect();}),delay);timer?.unref?.();}
  async backfill(){this.stats.backfillAttempts++;try{const chats=await this.client.getChats?.()||[];for(const chat of chats.filter(x=>x.isGroup).slice(0,100)){const messages=await chat.fetchMessages?.({limit:50})||[];for(const message of messages)await this.accept(message);}await this.flush();}catch(error){this.stats.backfillErrors++;this.logger('SYNC_ERROR',{operation:'backfill',message:error.message});}}
  snapshot(){return {...this.stats,groupsSeen:this.stats.groupsSeen.size,uptimeMs:Date.now()-Date.parse(this.stats.startedAt),state:this.state};}
}
