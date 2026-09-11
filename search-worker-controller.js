const FIELDS=['id','operation','property_type','municipality_id','municipality','zone_id','zone','zone_detected','residence','complex_detected','price_usd','bedrooms','bathrooms','parking','area_m2','planta_100','planta_electrica','pozo','tanque','amoblado','financiamiento','piscina','phone','resolved_phone','date','date_iso','date_order','appearances','time','text','location_terms','zone_matches','normalized','sender','group'];
const breathe=()=>new Promise(resolve=>setTimeout(resolve,0));
export class SearchWorkerController{
  constructor({workerFactory=(classic=false)=>new Worker(new URL(classic?'./search-worker-classic.js?v=0786':'./search-worker.js?v=0786',import.meta.url),classic?{}:{type:'module'}),onStatus=()=>{},onMetric=()=>{}}={}){
    this.workerFactory=workerFactory;this.classic=false;this.timers=new Set();try{this.worker=workerFactory();}catch(error){this.classic=true;this.worker=workerFactory(true);}this.onStatus=onStatus;this.onMetric=onMetric;
    this.revision=0;this.ready=false;this.propertyMap=new Map();this.waiters=new Map();this.pending=null;this.failed=false;
    this.worker.onmessage=({data:m})=>this.receive(m);
    this.worker.onerror=e=>this.fail(e.error||Object.assign(new Error(e.message||'Worker load error'),{name:'WorkerError'}));this.worker.onmessageerror=e=>this.fail(Object.assign(new Error(e.message||'No se pudo decodificar el mensaje del worker'),{name:'DataCloneError'}));
  }
  metric(name,started){this.onMetric(name,performance.now()-started);}
  deadline(label,run){const timer=setTimeout(()=>{this.timers.delete(timer);run();},5000);this.timers.add(timer);return timer;}
  clearTimer(timer){clearTimeout(timer);this.timers.delete(timer);}
  fail(error=new Error('Worker no disponible')){
    const detail=(error.name||'Error')+': '+String(error.message||error).replace(/Bearer\s+\S+/gi,'[secreto]').slice(0,180);
    for(const timer of this.timers)clearTimeout(timer);this.timers.clear();
    if(!this.classic&&this.lastProperties){
      this.classic=true;const pending=this.pending;this.pending=null;
      for(const done of this.waiters.values())done(false);this.waiters.clear();
      this.worker.terminate?.();this.onStatus(detail+' · reintentando worker clásico');
      try{this.worker=this.workerFactory(true);this.worker.onmessage=({data:m})=>this.receive(m);this.worker.onerror=e=>this.fail(e.error||new Error(e.message||'Classic worker error'));this.worker.onmessageerror=()=>this.fail(Object.assign(new Error('Mensaje inválido'),{name:'DataCloneError'}));
        const rebuilding=this.rebuild(this.lastProperties);if(pending)this.search(pending.filters,pending.sortMode,pending.generation).then(pending.resolve,pending.reject);rebuilding.catch(e=>this.fail(e));return;
      }catch(e){pending?.reject(e);error=e;}
    }
    this.failed=true;this.ready=false;for(const done of this.waiters.values())done(false);this.waiters.clear();if(this.pending){this.pending.reject(error);this.pending=null;}this.onStatus(detail);
  }
  receive(m){
    if(m.revision!==this.revision)return;
    if(m.type==='error'){this.fail(Object.assign(new Error(m.message),{name:m.name||'WorkerError'}));return;}
    if(m.type==='indexed'){const done=this.waiters.get(m.batch);this.waiters.delete(m.batch);done?.(true);}
    if(m.type==='ready'){this.clearTimer(this.readyTimer);this.ready=true;this.onStatus('Búsqueda lista');}
    if(m.type==='result'&&this.pending?.generation===m.generation){const pending=this.pending;this.pending=null;this.onMetric('workerQueryMs',m.durationMs);pending.resolve(m.ids);}
  }
  async rebuild(properties){
    const revision=++this.revision;this.ready=false;this.lastProperties=properties;
    if(this.failed)throw new Error('Búsqueda no disponible');
    for(const done of this.waiters.values())done(false);this.waiters.clear();
    if(this.pending){this.pending.resolve(null);this.pending=null;}
    this.propertyMap=new Map();this.onStatus('Preparando búsqueda 0%');
    this.worker.postMessage({type:'reset',revision});
    for(let offset=0,batch=0;offset<properties.length;batch++){
      await breathe();if(revision!==this.revision||this.failed)return;
      const started=performance.now(),records=[];
      // At most 250 compact records; never clone photos, attachments or original objects.
      do{
        const p=properties[offset++],projection={};for(const key of FIELDS)projection[key]=p[key];
        if(!projection.phone)projection.phone=p.sources?.find(s=>s.phone)?.phone;
        records.push(projection);this.propertyMap.set(p.id,p);
      }while(offset<properties.length&&records.length<250&&performance.now()-started<8);
      const ack=new Promise(resolve=>{const timer=this.deadline('batch',()=>{if(revision===this.revision)this.fail(Object.assign(new Error('Sin ACK durante 5 segundos · batch '+batch),{name:'TimeoutError'}));});this.waiters.set(batch,value=>{this.clearTimer(timer);resolve(value);});});
      this.worker.postMessage({type:'batch',revision,batch,records});this.metric('indexTransferTaskMs',started);
      if(!await ack||revision!==this.revision)return;
      this.onStatus(`Preparando búsqueda ${Math.round(offset/properties.length*100)}%`);
    }
    if(revision===this.revision){this.readyTimer=this.deadline('ready',()=>this.fail(Object.assign(new Error('Sin READY durante 5 segundos'),{name:'TimeoutError'})));this.worker.postMessage({type:'ready',revision});}
  }
  search(filters,sortMode,generation){
    if(this.failed)return Promise.reject(new Error('Búsqueda no disponible'));
    if(this.pending)this.pending.resolve(null);
    return new Promise((resolve,reject)=>{
      this.pending={generation,filters,sortMode,resolve,reject};
      this.worker.postMessage({type:'query',revision:this.revision,generation,filters,sortMode});
    });
  }
  async propertiesForIds(ids,cancelled){
    const rows=[];
    for(let start=0;start<ids.length;start+=250){
      await breathe();if(cancelled())return null;
      const started=performance.now();
      for(const id of ids.slice(start,start+250)){const p=this.propertyMap.get(id);if(p)rows.push(p);}
      this.metric('resultMappingTaskMs',started);
    }
    return rows;
  }
}
