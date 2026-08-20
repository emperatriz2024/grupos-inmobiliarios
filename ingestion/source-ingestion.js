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
  constructor(){super({sourceType:SOURCE_TYPES.WHATSAPP_SECONDARY,sourceChannel:'secondary_number',configured:false});}
  capability(){return {...super.capability(),reason:'No hay proveedor oficial, token, webhook ni cuenta Business configurados.'};}
  async ingest(){throw new Error('WhatsApp secundario no está configurado. Se requiere una integración oficial/autorizada.');}
}

export function sourceMetadata(sourceType,sourceChannel,sourceId,publishedAt,importedAt=new Date().toISOString()){
  return {sourceType,sourceChannel,sourceId:sourceId||null,importedAt,publishedAt:publishedAt||null};
}
