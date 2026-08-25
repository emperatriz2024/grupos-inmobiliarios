import {mkdir,open,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

function pidAlive(pid){if(!Number.isInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true;}catch(error){return error.code==='EPERM';}}

export class RuntimeLock{
  constructor(file,{pid=process.pid,now=Date.now,staleMs=120_000,heartbeatMs=30_000}={}){Object.assign(this,{file,pid,now,staleMs,heartbeatMs});this.owner=crypto.randomUUID();this.timer=null;}
  payload(){return {pid:this.pid,owner:this.owner,updatedAt:this.now()};}
  async acquire(){
    await mkdir(path.dirname(this.file),{recursive:true});
    try{const handle=await open(this.file,'wx',0o600);await handle.writeFile(JSON.stringify(this.payload()));await handle.close();this.startHeartbeat();return this;}
    catch(error){if(error.code!=='EEXIST')throw error;}
    let current;try{current=JSON.parse(await readFile(this.file,'utf8'));}catch{throw new Error('RUNTIME_LOCK_INVALID: revisión manual requerida.');}
    const stale=this.now()-Number(current.updatedAt||0)>this.staleMs;
    if(!stale||pidAlive(Number(current.pid)))throw new Error('RUNTIME_LOCK_ACTIVE: otra instancia utiliza la sesión.');
    await rm(this.file,{force:false});return this.acquire();
  }
  startHeartbeat(){this.timer=setInterval(()=>writeFile(this.file,JSON.stringify(this.payload()),{encoding:'utf8',mode:0o600}).catch(()=>{}),this.heartbeatMs);this.timer.unref?.();}
  async release(){if(this.timer)clearInterval(this.timer);this.timer=null;try{const current=JSON.parse(await readFile(this.file,'utf8'));if(current.owner===this.owner)await rm(this.file,{force:true});}catch(error){if(error.code!=='ENOENT')throw error;}}
}
