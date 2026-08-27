import {radarCoreEnabled} from './config.js';

export class AdditiveIngestionCoordinator{
  constructor({zipImport,secondaryImport,coreWrite,env,logger=()=>{}}){this.zipImport=zipImport;this.secondaryImport=secondaryImport;this.coreWrite=coreWrite;this.env=env;this.logger=logger;}
  async mirror(channel,accountRole,legacy){if(!radarCoreEnabled(this.env)||!this.coreWrite)return;try{await this.coreWrite({channel,accountRole,legacy});}catch(error){this.logger({event:'CORE_UNAVAILABLE',channel,errorName:error?.name||'Error'});}}
  async importZip(input){const legacy=await this.zipImport(input);await this.mirror('WHATSAPP_ZIP','PRIMARY_NUMBER',legacy);return legacy;}
  async importSecondary(input){const legacy=await this.secondaryImport(input);await this.mirror('WHATSAPP_SECONDARY','SECONDARY_NUMBER',legacy);return legacy;}
}
