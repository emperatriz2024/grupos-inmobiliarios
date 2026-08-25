import {copyFile,mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';

export class DurableOutbox{
  constructor(file){this.file=file;this.items=new Map();this.loaded=false;}
  async load(){if(this.loaded)return;await mkdir(path.dirname(this.file),{recursive:true});try{const rows=JSON.parse(await readFile(this.file,'utf8'));for(const row of rows)this.items.set(row.messageId,row);}catch(error){if(error.code!=='ENOENT'){try{const rows=JSON.parse(await readFile(`${this.file}.bak`,'utf8'));for(const row of rows)this.items.set(row.messageId,row);}catch{throw Object.assign(new Error('OUTBOX_CORRUPT: archivos conservados para recuperación manual.'),{cause:error});}}}this.loaded=true;}
  async persist(){const temp=`${this.file}.next`;await writeFile(temp,JSON.stringify([...this.items.values()]),{encoding:'utf8',mode:0o600});try{await copyFile(this.file,`${this.file}.bak`);}catch(error){if(error.code!=='ENOENT')throw error;}await rename(temp,this.file);}
  async enqueue(event){await this.load();const duplicate=this.items.has(event.messageId);if(!duplicate){this.items.set(event.messageId,{...event,attempts:0,nextAttemptAt:0});await this.persist();}return {duplicate};}
  async ready(limit=50,now=Date.now()){await this.load();return [...this.items.values()].filter(x=>Number(x.nextAttemptAt||0)<=now).slice(0,limit);}
  async acknowledge(ids=[]){await this.load();for(const id of ids)this.items.delete(id);await this.persist();}
  async retry(ids=[],attempt=1,now=Date.now(),requestedDelay=null){await this.load();const delay=requestedDelay??Math.min(300_000,1000*2**Math.min(8,attempt));for(const id of ids){const row=this.items.get(id);if(row)this.items.set(id,{...row,attempts:attempt,nextAttemptAt:now+delay});}await this.persist();return delay;}
  async count(){await this.load();return this.items.size;}
}

export class MemoryOutbox{
  constructor(){this.items=new Map();}
  async enqueue(event){const duplicate=this.items.has(event.messageId);if(!duplicate)this.items.set(event.messageId,{...event,attempts:0,nextAttemptAt:0});return {duplicate};}
  async ready(limit=50,now=Date.now()){return [...this.items.values()].filter(x=>x.nextAttemptAt<=now).slice(0,limit);}
  async acknowledge(ids){ids.forEach(id=>this.items.delete(id));}
  async retry(ids,attempt=1,now=Date.now(),requestedDelay=null){const delay=requestedDelay??Math.min(300_000,1000*2**Math.min(8,attempt));ids.forEach(id=>{const x=this.items.get(id);if(x)this.items.set(id,{...x,attempts:attempt,nextAttemptAt:now+delay});});return delay;}
  async count(){return this.items.size;}
}
