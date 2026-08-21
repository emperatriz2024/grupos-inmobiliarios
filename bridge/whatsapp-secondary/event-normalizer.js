import {validateSecondaryEvent} from '../../secondary-whatsapp/contract.js';

export function isGroupMessage(message={}){
  const remote=message.from||message.id?.remote||'';
  return /@g\.us$/i.test(remote)&&!message.fromMe&&message.type!=='revoked';
}

export async function normalizeWhatsAppMessage(message,{receivedAt=new Date().toISOString()}={}){
  if(!isGroupMessage(message))return null;
  const chat=await message.getChat?.(),contact=await message.getContact?.();
  const author=message.author||message.id?.participant||'';
  const raw={
    messageId:message.id?._serialized||message.id?.id,groupId:message.from||message.id?.remote,
    groupName:chat?.name||'',authorId:author,authorIdentifier:author,
    authorDisplayName:contact?.pushname||contact?.name||contact?.shortName||'',
    timestamp:new Date(Number(message.timestamp)*1000).toISOString(),receivedAt,
    messageType:message.type||'unknown',text:message.body||'',caption:message.caption||'',
    hasMedia:Boolean(message.hasMedia),mediaType:message.hasMedia?(message.type||'unknown'):null,
    quotedMessageId:message.hasQuotedMsg?(await message.getQuotedMessage?.())?.id?._serialized:null
  };
  const result=validateSecondaryEvent(raw);return result.ok?result.event:null;
}
