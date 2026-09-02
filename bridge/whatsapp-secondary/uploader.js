export class BatchUploader{
  constructor({outbox,endpoint,token,fetchImpl=globalThis.fetch,batchSize=50,logger=()=>{}}){Object.assign(this,{outbox,endpoint,token,fetchImpl,batchSize,logger});this.inFlight=null;}
  async flush(now=Date.now()){if(this.inFlight)return this.inFlight;this.inFlight=this.flushOnce(now).finally(()=>{this.inFlight=null;});return this.inFlight;}
  async flushOnce(now=Date.now()){
    const events=await this.outbox.ready(this.batchSize,now);if(!events.length)return {uploaded:0,pending:await this.outbox.count()};
    try{
      const response=await this.fetchImpl(this.endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${this.token}`},body:JSON.stringify({batchId:`${now}-${events[0].messageId}`,events})});
      if(!response.ok)throw Object.assign(new Error(`HTTP ${response.status}`),{status:response.status});
      await this.outbox.acknowledge(events.map(x=>x.messageId));this.logger('UPLOADED',{count:events.length});return {uploaded:events.length,pending:await this.outbox.count()};
    }catch(error){const attempt=Math.max(...events.map(x=>Number(x.attempts||0)))+1,delay=await this.outbox.retry(events.map(x=>x.messageId),attempt,now);this.logger('SYNC_ERROR',{status:error.status||null,retryInMs:delay});return {uploaded:0,pending:await this.outbox.count(),error:error.message,retryInMs:delay};}
  }
}
