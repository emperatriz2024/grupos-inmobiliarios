export function installLifecycle({bridge,client,health,lock,logger=()=>{},processRef=process,exit=true}){
  let stopping=null;
  const shutdown=signal=>stopping||(stopping=(async()=>{bridge.setState('SHUTTING_DOWN',{operation:signal});bridge.stopFlushLoop();bridge.stopWatchdog?.();await bridge.flush().catch(()=>{});try{await client?.destroy?.();}catch{}await health?.stop?.();await lock?.release?.();logger('SHUTDOWN_COMPLETE',{operation:signal});if(exit)processRef.exit(0);})());
  processRef.once('SIGTERM',()=>shutdown('SIGTERM'));processRef.once('SIGINT',()=>shutdown('SIGINT'));
  return {shutdown};
}
