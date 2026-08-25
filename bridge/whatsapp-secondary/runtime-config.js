import os from 'node:os';
import path from 'node:path';

export const BRIDGE_MODES=Object.freeze({TEST:'test',LIVE:'live'});

export function resolveRuntimeConfig(env=process.env,platform=process.platform){
  const mode=String(env.RADAR_BRIDGE_MODE||BRIDGE_MODES.TEST).toLowerCase();
  if(!Object.values(BRIDGE_MODES).includes(mode))throw new Error('RADAR_BRIDGE_MODE debe ser test o live.');
  const cloudDefault='/data/radar-whatsapp-secondary';
  const localDefault=path.join(env.LOCALAPPDATA||os.homedir(),'RadarInmobiliario','whatsapp-secondary');
  const pathApi=platform==='win32'?path.win32:path.posix,runtimeRoot=pathApi.resolve(env.RADAR_BRIDGE_RUNTIME_DIR||(platform==='linux'&&env.FLY_APP_NAME?cloudDefault:localDefault));
  const port=Math.min(65535,Math.max(1,Number(env.PORT||env.RADAR_BRIDGE_HEALTH_PORT)||8080)),healthHost=env.RADAR_BRIDGE_HEALTH_HOST||(env.FLY_APP_NAME?'0.0.0.0':'127.0.0.1');
  return Object.freeze({
    mode,runtimeRoot,port,healthHost,bootstrapMode:String(env.RADAR_BRIDGE_BOOTSTRAP_MODE||'false').toLowerCase()==='true',
    endpoint:env.RADAR_BRIDGE_INGEST_URL||'',token:env.RADAR_BRIDGE_INGEST_TOKEN||'',
    paths:Object.freeze({session:pathApi.join(runtimeRoot,'session'),chromium:pathApi.join(runtimeRoot,'chromium'),outbox:pathApi.join(runtimeRoot,'outbox'),state:pathApi.join(runtimeRoot,'state'),lock:pathApi.join(runtimeRoot,'bridge.lock')})
  });
}

export function assertLiveConfig(config){
  if(config.mode!==BRIDGE_MODES.LIVE)return;
  if(!config.endpoint||!config.token)throw new Error('LIVE requiere RADAR_BRIDGE_INGEST_URL y RADAR_BRIDGE_INGEST_TOKEN fuera de Git.');
}
