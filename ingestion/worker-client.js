const API='/.netlify/functions/ingestion-jobs';
const request=async(url,options)=>{const response=await fetch(url,options),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`worker_http_${response.status}`);return data;};
export const getWorkerInfo=()=>request(API);
export const startIngestionJob=()=>request(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'start'})});
export const getIngestionBatch=batchId=>request(`${API}?batch=${encodeURIComponent(batchId)}`);
export const getIngestionResultChunk=(jobId,index)=>request(`${API}?job=${encodeURIComponent(jobId)}&chunk=${index}`);
export const retryIngestionJob=jobId=>request(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'retry',job_id:jobId})});
