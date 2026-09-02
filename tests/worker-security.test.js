import test from 'node:test';
import assert from 'node:assert/strict';
import {deploymentOrigin,sameDeploymentOrigin,validWorkerToken} from '../ingestion/worker-security.js';
import {dispatchJob} from '../netlify/functions/ingestion-jobs.js';
import {handler as backgroundHandler} from '../netlify/functions/ingestion-worker-background.js';

const env={DEPLOY_PRIME_URL:'https://radar-preview.example/path',RADAR_INGESTION_WORKER_TOKEN:'private-test-token'};
test('dispatcher usa URL de despliegue confiable, no Host de usuario',async()=>{let call;await dispatchJob('job-1',{env,fetchImpl:async(url,options)=>{call={url,options};return{ok:true}}});assert.equal(call.url,'https://radar-preview.example/.netlify/functions/ingestion-worker-background');assert.equal(call.options.headers['x-radar-worker-token'],'private-test-token');assert.ok(!call.url.includes('attacker'));});
test('mutación solo acepta el origen del despliegue',()=>{assert.equal(deploymentOrigin(env),'https://radar-preview.example');assert.equal(sameDeploymentOrigin({headers:{origin:'https://radar-preview.example',host:'attacker.example'}},env),true);assert.equal(sameDeploymentOrigin({headers:{origin:'https://attacker.example'}},env),false);assert.equal(sameDeploymentOrigin({headers:{}},env),false);});
test('worker interno exige secreto server-side',async()=>{assert.equal(validWorkerToken({headers:{'x-radar-worker-token':'private-test-token'}},env),true);assert.equal(validWorkerToken({headers:{'x-radar-worker-token':'wrong'}},env),false);const response=await backgroundHandler({headers:{},body:JSON.stringify({job_id:'x'})});assert.equal(response.statusCode,401);});
