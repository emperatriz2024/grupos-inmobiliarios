import {createSearchRecord, matchesSearchRecord, prepareFilters} from './search-index.js?v=0786';

// Persistent, isolated from ZIP ingestion. All derived inventory stays in this worker.
export function installSearchWorker(port){
  let revision=0, records=[], ready=false, latest=null, running=false;
  const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
  const send=message=>port.postMessage(message);
  async function pump(){
    if(running||!ready||!latest)return;
    running=true;
    try{
      while(ready&&latest){
        const query=latest;latest=null;
        const epoch=revision,started=performance.now(),filters=prepareFilters(query.filters);
        const cancelled=()=>epoch!==revision||latest!==null;
        let rows=[];
        for(let i=0;i<records.length;i++){
          if(cancelled())break;
          if(matchesSearchRecord(records[i],filters))rows.push(records[i]);
          if(i%250===249)await yieldTask();
        }
        if(cancelled())continue;
        const mode=query.sortMode;
        const compare=(a,b)=>mode==='price_asc'?(a.price_usd??Infinity)-(b.price_usd??Infinity):mode==='price_desc'?(b.price_usd??-1)-(a.price_usd??-1):mode==='appearances'?(b.appearances||0)-(a.appearances||0):b.timestamp-a.timestamp||b.time.localeCompare(a.time);
        let buffer=new Array(rows.length),work=0;
        for(let width=1;width<rows.length&&!cancelled();width*=2){
          for(let start=0;start<rows.length&&!cancelled();start+=width*2){
            const middle=Math.min(start+width,rows.length),end=Math.min(start+width*2,rows.length);let left=start,right=middle;
            for(let out=start;out<end;out++){
              buffer[out]=left<middle&&(right>=end||!(compare(rows[left],rows[right])>0))?rows[left++]:rows[right++];
              if(++work%2048===0){await yieldTask();if(cancelled())break;}
            }
          }
          [rows,buffer]=[buffer,rows];
        }
        if(!cancelled())send({type:'result',revision:epoch,generation:query.generation,ids:rows.map(p=>p.id),durationMs:performance.now()-started});
      }
    }catch{
      send({type:'error',revision,message:'No se pudo completar la búsqueda.'});
    }finally{running=false;if(ready&&latest)pump();}
  }
  port.onmessage=async({data:m})=>{
    try{
      if(m.type==='reset'){revision=m.revision;records=[];ready=false;latest=null;return;}
      if(m.revision!==revision)return;
      if(m.type==='batch'){
        const epoch=revision;let deadline=performance.now()+8;
        for(let i=0;i<m.records.length;i++){
          if(epoch!==revision)return;
          records.push(createSearchRecord(m.records[i]));
          if(performance.now()>=deadline){await yieldTask();deadline=performance.now()+8;}
        }
        if(epoch===revision)send({type:'indexed',revision,batch:m.batch,count:records.length});
      }else if(m.type==='ready'){
        ready=true;send({type:'ready',revision,count:records.length});pump();
      }else if(m.type==='query'){latest=m;pump();}
    }catch{send({type:'error',revision,message:'No se pudo preparar la búsqueda.'});}
  };
}
if(typeof self!=='undefined')installSearchWorker(self);
