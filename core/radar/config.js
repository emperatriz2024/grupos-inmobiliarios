export const RADAR_CORE_FLAG='RADAR_CORE_ENABLED';

export function radarCoreEnabled(env=globalThis.process?.env||{}){
  return /^(1|true|on|yes)$/i.test(String(env?.[RADAR_CORE_FLAG]||''));
}

export function coreFallback(operation,legacyOperation,{env,logger=()=>{}}={}){
  if(!radarCoreEnabled(env))return legacyOperation();
  return Promise.resolve().then(operation).catch(error=>{
    logger({event:'CORE_UNAVAILABLE',errorName:error?.name||'Error'});
    return legacyOperation();
  });
}
