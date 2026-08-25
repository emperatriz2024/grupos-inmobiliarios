import http from 'node:http';

const json=(response,status,body)=>{response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','x-content-type-options':'nosniff'});response.end(JSON.stringify(body));};
export function safeMetrics(bridge,outboxPending=0){const snap=bridge.snapshot();return {state:snap.state,uptime:snap.uptimeMs,groupsSeen:snap.groupsSeen,messagesReceived:snap.messagesReceived,messagesQueued:snap.messagesQueued,messagesUploaded:snap.messagesUploaded,duplicatesSkipped:snap.duplicatesSkipped,lastMessageAt:snap.lastMessageAt,lastSuccessfulUploadAt:snap.lastSuccessfulUploadAt,outboxPending,backfillAttempts:snap.backfillAttempts,backfillErrors:snap.backfillErrors};}
export function createHealthServer({bridge,outbox,host='0.0.0.0',port=8080,logger=()=>{}}){
  const server=http.createServer(async(request,response)=>{
    if(request.method!=='GET')return json(response,405,{error:'method_not_allowed'});
    if(request.url==='/health')return json(response,200,{status:'ok'});
    if(request.url==='/ready')return json(response,bridge.state==='READY'?200:503,{ready:bridge.state==='READY'});
    if(request.url==='/metrics'){let pending=0;try{pending=await outbox.count();}catch{}return json(response,200,safeMetrics(bridge,pending));}
    return json(response,404,{error:'not_found'});
  });
  return {server,start:()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{logger('HEALTH_LISTENING',{status:200});resolve(server.address());});}),stop:()=>new Promise(resolve=>server.close(()=>resolve()))};
}
