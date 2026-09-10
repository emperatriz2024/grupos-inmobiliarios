import {matchesFilters} from './search-utils.js?v=0784';
import {propertyTimestamp} from './date-utils.js?v=0783';
const breathe=()=>new Promise(resolve=>setTimeout(resolve,0));
// Chunk filtering and stable merge-sort, including the first cold-cache search.
export async function searchPropertiesChunked(properties,filters={},mode='recent',{cancelled=()=>false,yieldTask=breathe}={}){
  let rows=[], work=0, started=performance.now();
  const due=()=>++work>=256 || performance.now()-started>=5;
  const pause=async()=>{await yieldTask();work=0;started=performance.now();};
  await pause();if(cancelled())return null;
  for(const p of properties){
    if(matchesFilters(p,filters))rows.push({p,key:mode==='price_asc'?(p.price_usd??Infinity):mode==='price_desc'?(p.price_usd??-1):mode==='appearances'?(p.appearances||0):propertyTimestamp(p),time:String(p.time||'')});
    if(due()){await pause();if(cancelled())return null;}
  }
  const compare=(a,b)=>mode==='price_asc'?a.key-b.key:mode==='recent'||!['price_desc','appearances'].includes(mode)?b.key-a.key||b.time.localeCompare(a.time):b.key-a.key;
  let buffer=new Array(rows.length);
  for(let width=1;width<rows.length;width*=2){
    for(let start=0;start<rows.length;start+=2*width){
      const middle=Math.min(start+width,rows.length),end=Math.min(start+2*width,rows.length);
      let left=start,right=middle;
      for(let out=start;out<end;out++){
        buffer[out]=left<middle&&(right>=end||!(compare(rows[left],rows[right])>0))?rows[left++]:rows[right++];
        if(due()){await pause();if(cancelled())return null;}
      }
    }
    [rows,buffer]=[buffer,rows];
  }
  const result=[];
  for(const row of rows){result.push(row.p);if(due()){await pause();if(cancelled())return null;}}
  return cancelled()?null:result;
}
