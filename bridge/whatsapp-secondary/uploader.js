export class BatchUploader{
  constructor({outbox,endpoint,token,fetchImpl=(...args)=>globalThis.fetch(...args),batchSize=50,logger=()=>{},random=Math.random,circuitThreshold=5,circuitCooldownMs=60_000}){Object.assign(this,{outbox,endpoint,token,fetchImpl,batchSize,logger,random,circuitThreshold,circuitCooldownMs});this.inFlight=null;this.consecutiveFailures=0;this.circuitOpenUntil=0;}
  async flush(now=Date.now()){if(this.inFlight)return this.inFlight;this.inFlight=this.flushOnce(now).finally(()=>{this.inFlight=null;});return this.inFlight;}
  async flushOnce(now=Date.now()){
    if(now<this.circuitOpenUntil)return {uploaded:0,pending:await this.outbox.count(),circuitOpen:true,retryInMs:this.circuitOpenUntil-now};
    const events=await this.outbox.ready(this.batchSize,now);if(!events.length)return {uploaded:0,pending:await this.outbox.count()};
    try{
      const response=await this.fetchImpl(this.endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${this.token}`},body:JSON.stringify({batchId:`${now}-${events[0].messageId}`,events})});
      if(!response.ok){const retryAfter=response.headers?.get?.('retry-after');throw Object.assign(new Error(`HTTP ${response.status}`),{status:response.status,retryAfter});}
      await this.outbox.acknowledge(events.map(x=>x.messageId));this.consecutiveFailures=0;this.circuitOpenUntil=0;this.logger('UPLOADED',{count:events.length});return {uploaded:events.length,pending:await this.outbox.count()};
    }catch(error){const attempt=Math.max(...events.map(x=>Number(x.attempts||0)))+1,retrySeconds=Number(error.retryAfter),base=Number.isFinite(retrySeconds)&&retrySeconds>=0?retrySeconds*1000:Math.min(300_000,1000*2**Math.min(8,attempt)),delay=Math.round(base*(1+this.random()*0.2));this.consecutiveFailures++;if(this.consecutiveFailures>=this.circuitThreshold)this.circuitOpenUntil=now+this.circuitCooldownMs;await this.outbox.retry(events.map(x=>x.messageId),attempt,now,delay);this.logger('SYNC_ERROR',{status:error.status||null,retryInMs:delay});return {uploaded:0,pending:await this.outbox.count(),error:error.message,retryInMs:delay,circuitOpen:this.circuitOpenUntil>now};}
  }
}
