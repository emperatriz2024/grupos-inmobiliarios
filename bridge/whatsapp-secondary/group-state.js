import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';

export class DurableGroupState{
  constructor(file){this.file=file;this.groups=new Map();this.loaded=false;}
  async load(){if(this.loaded)return;await mkdir(path.dirname(this.file),{recursive:true});try{const data=JSON.parse(await readFile(this.file,'utf8'));for(const [id,value] of Object.entries(data.groups||{}))this.groups.set(id,value);}catch(error){if(error.code!=='ENOENT')throw error;}this.loaded=true;}
  async has(groupId,messageId){await this.load();return (this.groups.get(groupId)?.recentMessageIds||[]).includes(messageId);}
  async observe(event){await this.load();const previous=this.groups.get(event.groupId)||{recentMessageIds:[]};const recent=[event.messageId,...previous.recentMessageIds.filter(x=>x!==event.messageId)].slice(0,250);this.groups.set(event.groupId,{lastMessageId:event.messageId,lastTimestamp:event.timestamp,recentMessageIds:recent,updatedAt:new Date().toISOString()});const temp=`${this.file}.next`;await writeFile(temp,JSON.stringify({groups:Object.fromEntries(this.groups)}),{encoding:'utf8',mode:0o600});await rename(temp,this.file);}
}

export class MemoryGroupState{
  constructor(){this.groups=new Map();}
  async has(groupId,messageId){return (this.groups.get(groupId)||[]).includes(messageId);}
  async observe(event){this.groups.set(event.groupId,[event.messageId,...(this.groups.get(event.groupId)||[]).filter(x=>x!==event.messageId)].slice(0,250));}
}
