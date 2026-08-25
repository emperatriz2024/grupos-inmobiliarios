import {EventEmitter} from 'node:events';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {DurableOutbox} from './outbox.js';
import {BatchUploader} from './uploader.js';
import {SecondaryBridge} from './bridge.js';
import {DurableGroupState} from './group-state.js';
import {resolveRuntimeConfig,assertLiveConfig,BRIDGE_MODES} from './runtime-config.js';
import {RuntimeLock} from './runtime-lock.js';
import {createHealthServer} from './health-server.js';
import {installLifecycle} from './lifecycle.js';
import {discoverChromium} from './chromium-discovery.js';
import {createQrBootstrapServer} from './bootstrap-server.js';

const LOG_FIELDS=new Set(['state','count','status','retryInMs','operation','attempt','durationMs','scope','errorName']);
const sanitizeLogValue=value=>typeof value==='string'?value.replace(/Bearer\s+\S+/gi,'Bearer [redacted]').replace(/\b(token|secret|password)\s*[:=]\s*\S+/gi,'$1=[redacted]').replace(/https?:\/\/\S+/gi,'[url]').replace(/\b\d{8,15}\b/g,'[number]').slice(0,120):value;
export const safeLog=(event,data={})=>console.log(JSON.stringify({at:new Date().toISOString(),event:String(event).slice(0,80),...Object.fromEntries(Object.entries(data).filter(([key])=>LOG_FIELDS.has(key)).map(([key,value])=>[key,sanitizeLogValue(value)]))}));
class TestClient extends EventEmitter{async destroy(){}}

export async function createBridgeRuntime({env=process.env,clientFactory=null,logger=safeLog,startHealth=true,acquireLock=true,installSignals=true}={}){
  const config=resolveRuntimeConfig(env);assertLiveConfig(config);
  await Promise.all([config.paths.session,config.paths.chromium,config.paths.outbox,config.paths.state].map(value=>mkdir(value,{recursive:true})));
  const lock=new RuntimeLock(config.paths.lock);if(acquireLock)await lock.acquire();
  let client,showQr=null,bootstrap=null;
  if(clientFactory)client=await clientFactory(config);
  else if(config.mode===BRIDGE_MODES.LIVE){
    process.env.PUPPETEER_CACHE_DIR=config.paths.chromium;const executablePath=await discoverChromium(env);
    const whatsappModule=await import('whatsapp-web.js'),{Client,LocalAuth}=whatsappModule.default||whatsappModule;
    client=new Client({authStrategy:new LocalAuth({clientId:'radar-v063-secondary',dataPath:config.paths.session}),puppeteer:{headless:true,executablePath,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']}});
    if(config.bootstrapMode){const qrcode=await import('qrcode'),token=env.RADAR_BRIDGE_BOOTSTRAP_TOKEN;if(!token)throw new Error('BOOTSTRAP_TOKEN_REQUIRED');bootstrap=createQrBootstrapServer({token,host:env.RADAR_BRIDGE_BOOTSTRAP_HOST||'127.0.0.1',port:Number(env.RADAR_BRIDGE_BOOTSTRAP_PORT)||8090,renderQr:value=>qrcode.toString(value,{type:'svg',margin:2})});await bootstrap.start();showQr=value=>bootstrap.setQr(value);client.once('authenticated',()=>bootstrap.invalidate().catch(()=>{}));client.once('ready',()=>bootstrap.invalidate().catch(()=>{}));}
  }else client=new TestClient();
  const outbox=new DurableOutbox(path.join(config.paths.outbox,'events.json'));
  const uploader=new BatchUploader({outbox,endpoint:config.endpoint,token:config.token,logger});
  const groupState=new DurableGroupState(path.join(config.paths.state,'groups.json'));
  const bridge=new SecondaryBridge({client,outbox,uploader,groupState,logger});
  bridge.onQr=value=>{if(showQr)showQr(value);else logger('AUTH_REQUIRED',{state:'WAITING_QR'});};bridge.wire();
  const health=createHealthServer({bridge,outbox,host:config.healthHost,port:config.port,logger});if(startHealth)await health.start();
  const lifecycle=installSignals?installLifecycle({bridge,client,health:startHealth?health:null,lock:acquireLock?lock:null,logger}):null;
  return {config,client,outbox,uploader,groupState,bridge,health,lock,lifecycle,bootstrap};
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const runtime=await createBridgeRuntime();if(runtime.config.mode===BRIDGE_MODES.LIVE)await runtime.client.initialize();else safeLog('TEST_MODE',{state:'STARTING'});}
