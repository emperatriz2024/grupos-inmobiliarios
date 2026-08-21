import {validateSecondaryEvent} from '../../secondary-whatsapp/contract.js';

export function isGroupMessage(message={}){
  const remote=message.from||message.id?.remote||'';
  return /@g\.us$/i.test(remote)&&!message.fromMe&&message.type!=='revoked';
}

export async function normalizeWhatsAppMessage(message,{receivedAt=new Date().toISOString()}={}){
  if(!isGroupMessage(message))return null;
  const messageId=message.id?._serialized||message.id?.id,groupId=message.from||message.id?.remote,author=message.author||message.id?.participant||'';
  let timestampMs;try{timestampMs=Number(message.timestamp)*1000;}catch{return null;}
  if(!messageId||!groupId||!Number.isFinite(timestampMs))return null;
  const [chatResult,contactResult]=await Promise.allSettled([message.getChat?.(),message.getContact?.()]);
  const chat=chatResult.status==='fulfilled'?chatResult.value:null,contact=contactResult.status==='fulfilled'?contactResult.value:null;
  let quotedMessageId=null;if(message.hasQuotedMsg){try{quotedMessageId=(await message.getQuotedMessage?.())?.id?._serialized||null;}catch{}}
  const raw={
    messageId,groupId,
    groupName:chat?.name||'',authorId:author,authorIdentifier:author,
    authorDisplayName:contact?.pushname||contact?.name||contact?.shortName||'',
    timestamp:new Date(timestampMs).toISOString(),receivedAt,
    messageType:message.type||'unknown',text:message.body||'',caption:message.caption||'',
    hasMedia:Boolean(message.hasMedia),mediaType:message.hasMedia?(message.type||'unknown'):null,
    quotedMessageId
  };
  const result=validateSecondaryEvent(raw);return result.ok?result.event:null;
}
