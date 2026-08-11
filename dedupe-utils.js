import { normLoc } from './location-utils.js?v=0412';
import { propertyTimestamp } from './date-utils.js?v=0412';
import { isDemandRequest } from './intent-utils.js?v=0412';

const STOP=new Set('venta vendo vende alquiler alquilo alquila propiedad inmueble oportunidad precio ref referencia whatsapp colega asesor asesora inmobiliario inmobiliaria carabobo valencia disponible disponibilidad contacto informacion info habitaciones habitacion banos bano puestos puesto estacionamiento estacionamientos mts m2 metros con para por del de la el los las una uno un y en se'.split(' '));
function norm(s=''){return normLoc(String(s)).replace(/\b(?:0412|0414|0416|0424|0426)\s*\d+\b/g,' ').replace(/\b\d{6,}\b/g,' ').replace(/\s+/g,' ').trim();}
function normSender(s=''){return norm(s).replace(/\b(colega|asesor|asesora|inmobiliario|inmobiliaria|remax|rem ax|bienes raices|broker|agente)\b/g,' ').replace(/\s+/g,' ').trim();}
function normResidence(s=''){return norm(s).replace(/\b(residencias?|residencial|resd|res|conjunto|conj|urbanizacion|urb)\b/g,' ').replace(/\s+/g,' ').trim();}
function canonicalText(s=''){
  return norm(String(s))
    .replace(/https?\s*\S+/g,' ')
    .replace(/\b(?:usd|us)\b/g,' ')
    .replace(/\$?\s*\d[\d.,]*\s*(?:mil|k)?\b/g,' # ')
    .replace(/\b(?:0412|0414|0416|0424|0426)\s*\d+/g,' ')
    .replace(/\s+/g,' ').trim();
}
function tokens(s=''){
  return new Set(canonicalText(s).split(' ').filter(x=>x.length>2&&!STOP.has(x)&&!/^\d+$/.test(x)).slice(0,90));
}
function jaccard(a,b){
  const A=tokens(a),B=tokens(b); if(!A.size||!B.size)return 0;
  let inter=0; for(const x of A) if(B.has(x)) inter++;
  return inter/(A.size+B.size-inter);
}
function closeNum(a,b,tol){if(a==null||b==null)return false;return Math.abs(Number(a)-Number(b))<=tol;}
function priceClose(a,b){if(!a||!b)return false;const x=Number(a),y=Number(b);return Math.abs(x-y)/Math.max(x,y)<=0.10;}
function typeKey(p){return norm(p.property_type||'');}
function zoneKey(p){return norm(p.zone||(p.location_terms||[])[0]||'');}
function residenceKey(p){return normResidence(p.residence||'');}
function sourceArray(p){
  const arr=(p.sources&&p.sources.length)?p.sources:[{group:p.group,sender:p.sender,date:p.date,date_iso:p.date_iso,date_order:p.date_order,time:p.time,phone:p.phone}];
  return arr.filter(Boolean);
}
function sourceKey(s){return `${norm(s.sender)}|${norm(s.group)}|${s.date_iso||s.date||''}|${s.time||''}|${s.phone||''}`;}
function coarseBucket(p){
  const t=typeKey(p)||'x',z=zoneKey(p)||'x',r=residenceKey(p);
  if(r) return `R|${t}|${z}|${r}`;
  const a=p.area_m2?Math.round(Number(p.area_m2)/10)*10:0;
  const b=p.bedrooms||0;
  const pr=p.price_usd?Math.round(Number(p.price_usd)/10000)*10000:0;
  return `F|${t}|${z}|${a}|${b}|${pr}`;
}
function sameProperty(a,b){
  if(typeKey(a)&&typeKey(b)&&typeKey(a)!==typeKey(b)) return false;
  const za=zoneKey(a),zb=zoneKey(b); if(za&&zb&&za!==zb&&!za.includes(zb)&&!zb.includes(za)) return false;
  const ca=canonicalText(a.text), cb=canonicalText(b.text);
  if(ca&&cb&&ca===cb) return true;
  const sa=normSender(a.sender), sb=normSender(b.sender);
  const sameSender=!!sa&&sa===sb;
  const samePhone=!!a.phone&&!!b.phone&&String(a.phone).replace(/\D/g,'')===String(b.phone).replace(/\D/g,'');
  const ra=residenceKey(a), rb=residenceKey(b), sameRes=!!ra&&ra===rb;
  const txt=jaccard(a.text,b.text);
  const area=closeNum(a.area_m2,b.area_m2,4);
  const beds=a.bedrooms&&b.bedrooms&&Number(a.bedrooms)===Number(b.bedrooms);
  const baths=a.bathrooms&&b.bathrooms&&Number(a.bathrooms)===Number(b.bathrooms);
  const parking=a.parking&&b.parking&&Number(a.parking)===Number(b.parking);
  const price=priceClose(a.price_usd,b.price_usd);
  const facts=[area,beds,baths,parking,price].filter(Boolean).length;

  // Same captador: repeated reposts commonly change emojis/order but keep core facts.
  if(sameSender && sameRes && facts>=2) return true;
  if(sameSender && facts>=3 && txt>=0.28) return true;
  if(sameSender && price && (area||beds) && txt>=0.38) return true;

  // Different captators: be conservative so unique units are not hidden.
  if(samePhone && facts>=2 && (sameRes||txt>=0.45)) return true;
  if(sameRes && facts>=3 && txt>=0.72) return true;
  return false;
}
function newer(a,b){return propertyTimestamp(a)>=propertyTimestamp(b)?a:b;}
function mergeInto(a,b){
  const latest=newer(a,b), other=latest===a?b:a;
  const map=new Map();
  for(const s of [...sourceArray(a),...sourceArray(b)]) map.set(sourceKey(s),s);
  const sources=[...map.values()].sort((x,y)=>{
    const px={date:x.date,date_iso:x.date_iso,date_order:x.date_order},py={date:y.date,date_iso:y.date_iso,date_order:y.date_order};
    return propertyTimestamp(py)-propertyTimestamp(px)||String(y.time||'').localeCompare(String(x.time||''));
  });
  const ids=[...new Set([...(a.merged_ids||[a.id]),...(b.merged_ids||[b.id])].filter(Boolean))];
  const rich=(k)=>latest[k]??other[k]??null;
  return {...latest,
    area_m2:rich('area_m2'),bedrooms:rich('bedrooms'),bathrooms:rich('bathrooms'),parking:rich('parking'),
    residence:rich('residence'),zone:rich('zone'),location_terms:[...new Set([...(a.location_terms||[]),...(b.location_terms||[])])],
    phone:rich('phone'),sources,appearances:Math.max(1,sources.length),merged_ids:ids,
    planta_electrica:!!(a.planta_electrica||b.planta_electrica),planta_100:!!(a.planta_100||b.planta_100),
    pozo:!!(a.pozo||b.pozo),tanque:!!(a.tanque||b.tanque),amoblado:!!(a.amoblado||b.amoblado),
    financiamiento:!!(a.financiamiento||b.financiamiento),piscina:!!(a.piscina||b.piscina)
  };
}
export function consolidateProperties(records=[]){
  const valid=records.filter(p=>p&&!isDemandRequest(p.text||''));
  valid.sort((a,b)=>propertyTimestamp(b)-propertyTimestamp(a));
  const buckets=new Map();
  const output=[];
  for(const p of valid){
    const key=coarseBucket(p);
    const candidates=buckets.get(key)||[];
    let target=-1;
    for(const idx of candidates){ if(sameProperty(output[idx],p)){target=idx;break;} }
    if(target>=0) output[target]=mergeInto(output[target],p);
    else { const idx=output.length; output.push({...p,merged_ids:[p.id],appearances:Math.max(1,sourceArray(p).length)}); candidates.push(idx); buckets.set(key,candidates); }
  }
  return output;
}
