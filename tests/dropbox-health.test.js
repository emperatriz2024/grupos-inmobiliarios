import test from 'node:test';
import assert from 'node:assert/strict';
import health from '../netlify/functions/dropbox-health.mts';

test('Dropbox health only lists files behind worker authentication',async()=>{
 const saved={...process.env},oldFetch=globalThis.fetch;
 Object.assign(process.env,{RADAR_INGESTION_WORKER_TOKEN:'test-worker',RADAR_DROPBOX_APP_KEY:'app',RADAR_DROPBOX_REFRESH_TOKEN:'refresh'});
 const urls=[];
 globalThis.fetch=async url=>{urls.push(url);return Response.json(url.includes('oauth2')?{access_token:'access'}:{entries:[{'.tag':'file',name:'chat.zip',size:12}],has_more:false});};
 try{
  assert.equal((await health(new Request('https://radar.test/health'))).status,401);
  assert.equal(urls.length,0);
  const response=await health(new Request('https://radar.test/health',{headers:{'x-radar-worker-token':'test-worker'}}));
  assert.deepEqual(await response.json(),{ok:true,operation:'listPending',zipCount:1,totalBytes:12});
  assert.ok(urls.every(url=>url.endsWith('/oauth2/token')||url.endsWith('/files/list_folder')));
 }finally{globalThis.fetch=oldFetch;for(const k of ['RADAR_INGESTION_WORKER_TOKEN','RADAR_DROPBOX_APP_KEY','RADAR_DROPBOX_REFRESH_TOKEN']){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});
