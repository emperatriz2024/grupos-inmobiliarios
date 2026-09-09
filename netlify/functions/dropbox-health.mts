import {createServerDropbox} from '../../ingestion/server-dropbox.js';
import {validWorkerToken} from '../../ingestion/worker-security.js';

export default async function(request){
  const headers={'cache-control':'no-store'};
  if(request.method!=='GET')return Response.json({error:'method_not_allowed'},{status:405,headers});
  const env={RADAR_INGESTION_WORKER_TOKEN:process.env.RADAR_DROPBOX_DIAGNOSTIC_TOKEN||process.env.RADAR_INGESTION_WORKER_TOKEN};
  try{
    const entries=await createServerDropbox().listPending();
    return Response.json({ok:true,operation:'listPending',zipCount:entries.length,totalBytes:entries.reduce((n,row)=>n+Number(row.size||0),0)},{headers});
  }catch{
    return Response.json({ok:false,error:'dropbox_read_check_failed'},{status:503,headers});
  }
}
