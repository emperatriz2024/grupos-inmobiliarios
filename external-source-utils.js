
import { normLoc } from './location-utils.js?v=0522';

const STOP=new Set('venta vendo vende alquiler alquilo alquila propiedad inmueble oportunidad precio ref referencia whatsapp colega asesor asesora inmobiliario inmobiliaria carabobo valencia disponible disponibilidad contacto informacion info habitaciones habitacion banos bano puestos puesto estacionamiento estacionamientos mts m2 metros con para por del de la el los las una uno un y en se'.split(' '));
const norm=s=>normLoc(String(s||'')).replace(/\s+/g,' ').trim();
const normResidence=s=>norm(s).replace(/\b(residencias?|residencial|resd|res|conjunto|conj|urbanizacion|urb|edificio|torre)\b/g,' ').replace(/\s+/g,' ').trim();

function tokens(s=''){
  const x=norm(s).replace(/https?\s*\S+/g,' ').replace(/\$?\s*\d[\d.,]*\s*(?:mil|k)?\b/g,' # ');
  return new Set(x.split(' ').filter(t=>t.length>2&&!STOP.has(t)&&!/^\d+$/.test(t)).slice(0,110));
}
function jaccard(a,b){
  const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;
  let inter=0;for(const x of A)if(B.has(x))inter++;
  return inter/(A.size+B.size-inter);
}
function closeNum(a,b,tol){return a!=null&&b!=null&&Math.abs(Number(a)-Number(b))<=tol;}
function priceDeltaRatio(a,b){
  if(!a||!b)return null;
  const x=Number(a),y=Number(b);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<=0||y<=0)return null;
  return Math.abs(x-y)/Math.max(x,y);
}
function priceClose(a,b){
  const d=priceDeltaRatio(a,b);
  return d!=null&&d<=0.08;
}
function verifiedUsd(parsed={}){
  return String(parsed.price_currency||'').toUpperCase()==='USD' && parsed.price_usd>0;
}
function identity(post={}){
  const phone=String(post.agent_phone||'').replace(/\D/g,'');
  const name=norm(post.agent_name||post.channel_name||'');
  return phone?`p:${phone}`:name?`n:${name}`:'unknown';
}
function ts(v){const t=Date.parse(v||'');return Number.isFinite(t)?t:Number.MAX_SAFE_INTEGER;}

export function findMasterCandidates(parsed={},masters=[],sourcePosts=[]){
  const byMaster=new Map();
  for(const p of sourcePosts||[]){
    if(!p.master_id)continue;
    if(!byMaster.has(p.master_id))byMaster.set(p.master_id,[]);
    byMaster.get(p.master_id).push(p);
  }

  const rows=[];
  for(const m of masters||[]){
    let score=0;const reasons=[];const warnings=[];

    if(parsed.operation&&m.operation){
      if(norm(parsed.operation)!==norm(m.operation))continue;
      score+=8;reasons.push('misma operación');
    }
    if(parsed.property_type&&m.property_type){
      if(norm(parsed.property_type)!==norm(m.property_type))continue;
      score+=12;reasons.push('mismo tipo');
    }

    if(parsed.zone_id&&m.zone_id){
      if(parsed.zone_id!==m.zone_id)continue;
      score+=18;reasons.push('misma zona');
    }else if(parsed.zone&&m.zone&&norm(parsed.zone)===norm(m.zone)){
      score+=14;reasons.push('misma zona');
    }

    const pr=normResidence(parsed.residence),mr=normResidence(m.residence);
    const sameResidence=!!(pr&&mr&&pr===mr);
    if(sameResidence){score+=28;reasons.push('misma residencia/conjunto');}

    const sameArea=closeNum(parsed.area_m2,m.area_m2,4);
    if(sameArea){score+=9;reasons.push('metraje cercano');}

    const sameBeds=parsed.bedrooms&&m.bedrooms&&Number(parsed.bedrooms)===Number(m.bedrooms);
    const sameBaths=parsed.bathrooms&&m.bathrooms&&Number(parsed.bathrooms)===Number(m.bathrooms);
    const sameParking=parsed.parking&&m.parking&&Number(parsed.parking)===Number(m.parking);
    if(sameBeds){score+=7;reasons.push('mismas habitaciones');}
    if(sameBaths){score+=5;reasons.push('mismos baños');}
    if(sameParking){score+=4;reasons.push('mismos puestos');}

    let bestText=0;
    for(const s of byMaster.get(m.id)||[]){
      const sim=jaccard(parsed.text||'',s.original_text||'');
      if(sim>bestText)bestText=sim;
    }
    if(bestText>=.72){score+=18;reasons.push('texto muy similar');}
    else if(bestText>=.50){score+=12;reasons.push('texto similar');}
    else if(bestText>=.32){score+=6;reasons.push('texto parcialmente similar');}

    // Price is only used as a hard comparison when the external price is
    // explicitly confirmed as USD. This avoids treating Marketplace's
    // platform currency label as a factual USD conversion.
    let price_delta_ratio=null;
    if(verifiedUsd(parsed)&&m.price_usd){
      price_delta_ratio=priceDeltaRatio(parsed.price_usd,m.price_usd);
      if(price_delta_ratio!=null){
        if(price_delta_ratio<=0.08){
          score+=10;reasons.push('precio compatible');
        }else if(price_delta_ratio<=0.20){
          score-=8;warnings.push('precio con diferencia moderada');
        }else if(price_delta_ratio<=0.40){
          score-=20;warnings.push('precio con diferencia importante');
        }else{
          // More than 40% difference is a major identity conflict.
          score-=38;warnings.push('precio fuertemente incompatible');
        }

        // >60% difference: discard unless there is unusually strong identity
        // evidence from exact residence + area + specs + very similar source text.
        const strongIdentity =
          sameResidence && sameArea &&
          (sameBeds||parsed.bedrooms==null||m.bedrooms==null) &&
          (sameBaths||parsed.bathrooms==null||m.bathrooms==null) &&
          bestText>=0.65;

        if(price_delta_ratio>0.60&&!strongIdentity)continue;
      }
    }

    if(score>=30){
      rows.push({
        master:m,
        score:Math.max(0,Math.min(100,Math.round(score))),
        reasons,warnings,best_text_similarity:bestText,price_delta_ratio
      });
    }
  }
  return rows.sort((a,b)=>b.score-a.score);
}

export function candidateDecision(candidates=[]){
  const top=candidates[0]||null;
  if(!top)return {mode:'new',label:'No se encontró coincidencia fuerte',confidence:'baja',candidate:null};
  if(top.score>=82)return {mode:'link',label:'Probable inmueble ya existente',confidence:'alta',candidate:top};
  if(top.score>=62)return {mode:'review',label:'Posible duplicado · revisar',confidence:'media',candidate:top};
  return {mode:'new',label:'Coincidencia débil · tratar como nuevo',confidence:'baja',candidate:top};
}

export function probableCaptorForMaster(masterId,sourcePosts=[]){
  const rows=(sourcePosts||[]).filter(p=>p.master_id===masterId);
  if(!rows.length)return null;
  const groups=new Map();
  const ordered=[...rows].sort((a,b)=>ts(a.published_at||a.detected_at)-ts(b.published_at||b.detected_at));
  const firstKey=identity(ordered[0]);
  for(const p of rows){
    const key=identity(p);if(key==='unknown')continue;
    if(!groups.has(key))groups.set(key,{key,name:p.agent_name||p.channel_name||'Sin nombre',phone:p.agent_phone||'',count:0,types:new Set(),first:Number.MAX_SAFE_INTEGER});
    const g=groups.get(key);g.count++;g.types.add(p.source_type||'otro');g.first=Math.min(g.first,ts(p.published_at||p.detected_at));
    if(!g.phone&&p.agent_phone)g.phone=p.agent_phone;
    if((!g.name||g.name==='Sin nombre')&&p.agent_name)g.name=p.agent_name;
  }
  const total=rows.length;
  const ranked=[...groups.values()].map(g=>{
    let score=0;
    if(g.key===firstKey)score+=42;
    score+=Math.min(28,(g.count/Math.max(1,total))*35);
    if(g.phone)score+=12;
    if(g.types.size>=2)score+=10;
    if(g.count>=2)score+=8;
    return {...g,score:Math.min(100,Math.round(score)),source_types:[...g.types]};
  }).sort((a,b)=>b.score-a.score||a.first-b.first);
  const best=ranked[0];if(!best)return null;
  return {
    name:best.name,phone:best.phone,score:best.score,
    confidence:best.score>=80?'alta':best.score>=60?'media':'baja',
    appearances:best.count,source_types:best.source_types,
    note:'Probabilidad basada en antigüedad conocida, recurrencia, teléfono y presencia en varias fuentes. No confirma titularidad de captación.'
  };
}

export function sourceLabel(type='otro'){
  const map={instagram:'Instagram',marketplace:'Marketplace',mercadolibre:'MercadoLibre',remax:'RE/MAX',rentahouse:'Rent-A-House',skygroup:'Sky Group',portal:'Portal',otro:'Otro'};
  return map[type]||type;
}
