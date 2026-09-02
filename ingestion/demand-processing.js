import {parseDemandRequest} from '../core/radar/demand-engine.js';

export function processZipDemandMessages(messages=[],{resolveTerritory=null}={}){
  return messages.map(message=>parseDemandRequest({
    ...message,text:message.text,source_channel:'primary_number',
    source_id:message.source_id||message.messageId||`${message.date_iso||message.date}|${message.time||''}|${message.sender||''}`
  },{origin:'MARKET',sourceChannel:'primary_number',resolveTerritory})).filter(Boolean);
}
