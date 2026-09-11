const FIELDS=['id','operation','property_type','municipality_id','municipality','zone_id','zone','zone_detected','residence','complex_detected','price_usd','bedrooms','bathrooms','parking','area_m2','planta_100','planta_electrica','pozo','tanque','amoblado','financiamiento','piscina','phone','resolved_phone','date','date_iso','date_order','appearances','time','text','location_terms','zone_matches','normalized','sender','group'];
const breathe=()=>new Promise(resolve=>setTimeout(resolve,0));
export class SearchWorkerController{
  constructor({workerFactory=()=>new Worker(new URL('./search-worker.js?v=0785',import.meta.url),{type:'module'}),onStatus=()=>{},onMetric=()=>{}}={}){
    this.worker=workerFactory();this.onStatus=onStatus;this.onMetric=onMetric;
    this.revision=0;this.ready=false;this.propertyMap=new Map();this.waiters=new Map();this.pending=null;this.failed=false;
    this.worker.onmessage=({data:m})=>this.receive(m);
    this.worker.onerror=()=>this.fail();this.worker.onmessageerror=()=>this.fail();
  }
  metric(name,started){this.onMetric(name,performance.now()-started);}
  fail(){this.failed=true;this.ready=false;for(const done of this.waiters.values())done(false);this.waiters.clear();if(this.pending){this.pending.reject(new Error('Búsqueda no disponible'));this.pending=null;}this.onStatus('Búsqueda no disponible. Recarga la aplicación.');}
  receive(m){
    if(m.revision!==this.revision)return;
    if(m.type==='error'){this.fail();return;}
    if(m.type==='indexed'){const done=this.waiters.get(m.batch);this.waiters.delete(m.batch);done?.(true);}
    if(m.type==='ready'){this.ready=true;this.onStatus('Búsqueda lista');}
    if(m.type==='result'&&this.pending?.generation===m.generation){const pending=this.pending;this.pending=null;this.onMetric('workerQueryMs',m.durationMs);pending.resolve(m.ids);}
  }
  async rebuild(properties){
    const revision=++this.revision;this.ready=false;
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
      const ack=new Promise(resolve=>this.waiters.set(batch,resolve));
      this.worker.postMessage({type:'batch',revision,batch,records});this.metric('indexTransferTaskMs',started);
      if(!await ack||revision!==this.revision)return;
      this.onStatus(`Preparando búsqueda ${Math.round(offset/properties.length*100)}%`);
    }
    if(revision===this.revision)this.worker.postMessage({type:'ready',revision});
  }
  search(filters,sortMode,generation){
    if(this.failed)return Promise.reject(new Error('Búsqueda no disponible'));
    if(this.pending)this.pending.resolve(null);
    return new Promise((resolve,reject)=>{
      this.pending={generation,resolve,reject};
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
