export const SOURCE_TYPES=Object.freeze({
  WHATSAPP_ZIP:'whatsapp_zip',DROPBOX:'dropbox',EXTERNAL_WEB:'external_web',WHATSAPP_SECONDARY:'whatsapp_secondary'
});

export class SourceIngestion{
  constructor({sourceType,sourceChannel,configured=true}={}){
    this.sourceType=sourceType;this.sourceChannel=sourceChannel;this.configured=configured;
  }
  capability(){return {available:this.configured,sourceType:this.sourceType,sourceChannel:this.sourceChannel};}
  async ingest(){throw new Error('El adaptador de ingestión no implementa ingest().');}
  metadata({sourceId=null,publishedAt=null,importedAt=new Date().toISOString()}={}){
    return {sourceType:this.sourceType,sourceChannel:this.sourceChannel,sourceId:sourceId||null,importedAt,publishedAt:publishedAt||null};
  }
}

export class WhatsAppZipSource extends SourceIngestion{
  constructor(){super({sourceType:SOURCE_TYPES.WHATSAPP_ZIP,sourceChannel:'primary_number'});}
}
export class DropboxSource extends SourceIngestion{
  constructor(){super({sourceType:SOURCE_TYPES.DROPBOX,sourceChannel:'dropbox'});}
}
export class ExternalWebSource extends SourceIngestion{
  constructor(channel='external_web'){super({sourceType:SOURCE_TYPES.EXTERNAL_WEB,sourceChannel:channel});}
}
export class SecondaryWhatsAppSource extends SourceIngestion{
  constructor({endpoint='',token='',fetchImpl=(...args)=>globalThis.fetch(...args)}={}){super({sourceType:SOURCE_TYPES.WHATSAPP_SECONDARY,sourceChannel:'secondary_number',configured:Boolean(endpoint&&token)});this.endpoint=endpoint;this.token=token;this.fetchImpl=fetchImpl;}
  capability(){return {...super.capability(),reason:this.configured?null:'Configura manualmente URL y token de lectura para esta sesión del navegador.'};}
  async ingest({cursor='',limit=50}={}){
    if(!this.configured)throw new Error('WhatsApp secundario no está configurado.');
    const url=new URL(this.endpoint,globalThis.location?.href||'http://localhost/');url.searchParams.set('limit',String(Math.min(100,limit)));if(cursor)url.searchParams.set('cursor',cursor);
    const response=await this.fetchImpl(url,{method:'GET',headers:{accept:'application/json',authorization:`Bearer ${this.token}`},cache:'no-store',credentials:'omit'});
    if(!response.ok)throw new Error(response.status===401?'Credencial de lectura inválida.':`Sincronización secundaria HTTP ${response.status}.`);
    const data=await response.json();if(!Array.isArray(data.events))throw new Error('Respuesta secundaria inválida.');return {events:data.events,nextCursor:data.nextCursor||cursor,hasMore:Boolean(data.hasMore)};
  }
}

export function sourceMetadata(sourceType,sourceChannel,sourceId,publishedAt,importedAt=new Date().toISOString()){
  return {sourceType,sourceChannel,sourceId:sourceId||null,importedAt,publishedAt:publishedAt||null};
}
