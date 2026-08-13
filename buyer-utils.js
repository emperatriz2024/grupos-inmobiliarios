import { masterAvailabilityGate } from './freshness-utils.js?v=0530';

// Radar Inmobiliario v0.5.1 — buyer matching engine.
// Matching is deliberately explainable: every score includes reasons and gaps.

const norm = (v='') => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const num = v => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const bool = v => v === true || v === 1 || v === '1' || v === 'true';

export const BUYER_FEATURES = [
  ['planta_100','Planta 100%'],
  ['planta_electrica','Planta eléctrica'],
  ['pozo','Pozo'],
  ['tanque','Tanque'],
  ['amoblado','Amoblado'],
  ['financiamiento','Financiamiento'],
  ['piscina','Piscina']
];

function criterionScore(value, target, weight, {higherIsBetter=true, tolerance=0}={}) {
  if (target == null) return {earned:0, possible:0, gap:null};
  if (value == null) return {earned:Math.round(weight*.35), possible:weight, gap:'dato no detectado'};
  if (higherIsBetter) {
    if (value >= target) return {earned:weight, possible:weight, gap:null};
    if (tolerance && value >= target-tolerance) return {earned:Math.round(weight*.45), possible:weight, gap:`cerca del mínimo (${value})`};
    return {earned:0, possible:weight, gap:`por debajo del mínimo (${value})`};
  }
  if (value <= target) return {earned:weight, possible:weight, gap:null};
  if (tolerance && value <= target+tolerance) return {earned:Math.round(weight*.45), possible:weight, gap:`ligeramente por encima (${value})`};
  return {earned:0, possible:weight, gap:`por encima del máximo (${value})`};
}

function recencyDays(master={}) {
  const raw = master.last_seen_at || master.updated_at || master.first_seen_at;
  const t = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now()-t)/86400000)) : 999;
}

function locationGate(buyer, master) {
  const zoneIds = new Set(buyer.zone_ids || []);
  const municipalityIds = new Set(buyer.municipality_ids || []);
  if (zoneIds.size) {
    if (master.zone_id && zoneIds.has(master.zone_id)) return {pass:true, earned:30, possible:30, reason:'Zona exacta'};
    return {pass:false, reason:'Fuera de las zonas solicitadas'};
  }
  if (municipalityIds.size) {
    if (master.municipality_id && municipalityIds.has(master.municipality_id)) return {pass:true, earned:24, possible:24, reason:'Municipio solicitado'};
    return {pass:false, reason:'Fuera del municipio solicitado'};
  }
  return {pass:true, earned:0, possible:0, reason:null};
}

function typeGate(buyer, master) {
  const types=(buyer.property_types||[]).map(norm).filter(Boolean);
  if(!types.length) return {pass:true,earned:0,possible:0,reason:null};
  const mt=norm(master.property_type);
  if(types.includes(mt)) return {pass:true,earned:14,possible:14,reason:'Tipo de inmueble exacto'};
  return {pass:false,reason:'Tipo de inmueble distinto'};
}

function operationGate(buyer, master) {
  if(!buyer.operation) return {pass:true,earned:0,possible:0,reason:null};
  if(norm(buyer.operation)===norm(master.operation)) return {pass:true,earned:8,possible:8,reason:`${buyer.operation}`};
  return {pass:false,reason:'Operación distinta'};
}

function priceScore(buyer, master) {
  const min=num(buyer.min_price), max=num(buyer.max_price), p=num(master.price_usd);
  if(min==null && max==null) return {pass:true,earned:0,possible:0,reasons:[],gaps:[]};
  const reasons=[],gaps=[];
  if(p==null) return {pass:true,earned:7,possible:22,reasons:[],gaps:['Precio no detectado']};

  // Extreme over-budget inventory is excluded; <=10% over remains visible as a review match.
  if(max!=null && p>max*1.10) return {pass:false,reason:'Supera el presupuesto máximo por más de 10%'};
  let earned=22;
  if(max!=null && p>max){earned=10;gaps.push(`Sobre presupuesto: $${Math.round(p-max).toLocaleString('es-VE')}`);}
  else if(min!=null && p<min*.75){earned=12;gaps.push('Precio muy por debajo del rango objetivo');}
  else if(min!=null && p<min){earned=17;gaps.push('Precio por debajo del rango objetivo');}
  else reasons.push('Dentro del presupuesto');
  return {pass:true,earned,possible:22,reasons,gaps};
}

function areaScore(buyer, master){
  const min=num(buyer.min_area),max=num(buyer.max_area),a=num(master.area_m2);
  if(min==null&&max==null)return {earned:0,possible:0,reasons:[],gaps:[]};
  const reasons=[],gaps=[];let earned=7;
  if(a==null)return {earned:2,possible:7,reasons,gaps:['Metraje no detectado']};
  if(min!=null&&a<min){earned=1;gaps.push(`Metraje menor al mínimo (${a} m²)`);}
  else if(max!=null&&a>max){earned=2;gaps.push(`Metraje mayor al máximo (${a} m²)`);}
  else reasons.push('Metraje dentro del rango');
  return {earned,possible:7,reasons,gaps};
}

function featuresScore(buyer, master){
  const required=buyer.required_features||[],desired=buyer.desired_features||[];
  let possible=0,earned=0;const reasons=[],gaps=[];
  if(required.length){
    const w=12/required.length;
    for(const f of required){
      possible+=w;
      if(bool(master[f])){earned+=w;reasons.push(BUYER_FEATURES.find(x=>x[0]===f)?.[1]||f);}
      else gaps.push(`No confirmado: ${BUYER_FEATURES.find(x=>x[0]===f)?.[1]||f}`);
    }
  }
  if(desired.length){
    const w=6/desired.length;
    for(const f of desired){
      possible+=w;
      if(bool(master[f])){earned+=w;reasons.push(`Deseable: ${BUYER_FEATURES.find(x=>x[0]===f)?.[1]||f}`);}
    }
  }
  return {earned,possible,reasons,gaps};
}

export function scoreBuyerMaster(buyer, master) {
  const availability=masterAvailabilityGate(master);
  if(!availability.pass)return null;
  const reasons=[],gaps=[],hardFails=[],unknownHard=[];
  if(availability.reason)reasons.push(availability.reason);
  const tolerance=Math.max(0,Math.min(10,Number(buyer.budget_tolerance||0)))/100;

  // Hard gates: operation, type, exact selected location.
  const op=operationGate(buyer,master);
  if(!op.pass)return null;if(op.reason)reasons.push(op.reason);

  const type=typeGate(buyer,master);
  if(!type.pass)return null;if(type.reason)reasons.push(type.reason);

  const loc=locationGate(buyer,master);
  if(!loc.pass)return null;if(loc.reason)reasons.push(loc.reason);

  // Budget is hard in strict mode. Small over-budget options may survive only as alternatives.
  const minP=num(buyer.min_price),maxP=num(buyer.max_price),price=num(master.price_usd);
  if(minP!=null||maxP!=null){
    if(price==null) unknownHard.push('Precio no detectado');
    else{
      if(maxP!=null&&price>maxP*(1+tolerance)){
        const over=(price-maxP)/maxP;
        if(over>.15)return null;
        hardFails.push(`Sobre presupuesto: $${Math.round(price-maxP).toLocaleString('es-VE')}`);
      }else if(minP!=null&&price<minP) gaps.push('Precio por debajo del rango objetivo');
      else reasons.push('Dentro del presupuesto');
    }
  }

  const hardMinimums=[
    ['Habitaciones',num(master.bedrooms),num(buyer.min_bedrooms)],
    ['Baños',num(master.bathrooms),num(buyer.min_bathrooms)],
    ['Puestos',num(master.parking),num(buyer.min_parking)]
  ];
  for(const [label,value,target] of hardMinimums){
    if(target==null)continue;
    if(value==null)unknownHard.push(`${label}: dato no detectado`);
    else if(value<target)hardFails.push(`${label}: ${value}, mínimo ${target}`);
    else reasons.push(`${label} cumplen`);
  }

  // Required features are hard. False means "not confirmed in text", not necessarily physically absent.
  for(const f of buyer.required_features||[]){
    const label=BUYER_FEATURES.find(x=>x[0]===f)?.[1]||f;
    if(bool(master[f]))reasons.push(`${label} confirmado`);
    else unknownHard.push(`${label}: no confirmado`);
  }

  // Area remains a soft criterion unless explicitly supplied.
  let soft=0,softPossible=0;
  const minA=num(buyer.min_area),maxA=num(buyer.max_area),area=num(master.area_m2);
  if(minA!=null||maxA!=null){
    softPossible+=3;
    if(area==null)gaps.push('Metraje no detectado');
    else if((minA!=null&&area<minA)||(maxA!=null&&area>maxA))gaps.push(`Metraje fuera del rango (${area} m²)`);
    else{soft+=3;reasons.push('Metraje dentro del rango');}
  }

  const desired=buyer.desired_features||[];
  if(desired.length){
    softPossible+=3;
    const hits=desired.filter(f=>bool(master[f]));
    soft+=3*(hits.length/desired.length);
    for(const f of hits.slice(0,3))reasons.push(`Deseable: ${BUYER_FEATURES.find(x=>x[0]===f)?.[1]||f}`);
  }

  softPossible+=4;
  const days=recencyDays(master);
  if(days<=7){soft+=4;reasons.push('Publicado esta semana');}
  else if(days<=21){soft+=3.5;reasons.push('Publicación reciente');}
  else if(days<=45)soft+=2;
  else if(days<=60)soft+=1;

  let score,tier,match_kind,strict_ok=false;

  if(hardFails.length){
    // Known violation of a hard rule. Visible only as a commercial alternative.
    score=Math.min(69,55+Math.round((softPossible?soft/softPossible:0)*14));
    tier='alternativa';match_kind='alternativa';
    gaps.unshift(...hardFails);
  }else if(unknownHard.length){
    // Potential match, but missing evidence means it cannot be "excellent".
    score=Math.min(79,70+Math.round((softPossible?soft/softPossible:0)*9));
    tier='revisar';match_kind='por_verificar';
    gaps.unshift(...unknownHard);
  }else{
    // Every hard criterion that the buyer asked for is known and satisfied.
    strict_ok=true;match_kind='estricto';tier='excelente';
    const bonus=softPossible?Math.round((soft/softPossible)*8):8;
    score=Math.min(100,92+bonus);
  }

  return {
    score,tier,match_kind,strict_ok,
    reasons:[...new Set(reasons)].slice(0,10),
    gaps:[...new Set(gaps)].slice(0,8),
    recency_days:days
  };
}

export function calculateBuyerMatches(buyer, masters=[]) {
  return masters.map(master=>{
    const scored=scoreBuyerMaster(buyer,master);
    return scored?{master,...scored}:null;
  }).filter(Boolean).sort((a,b)=>
    Number(b.strict_ok)-Number(a.strict_ok) ||
    b.score-a.score ||
    a.recency_days-b.recency_days
  );
}

export function buyerCriteriaText(buyer={}, locationCatalog={}) {
  const bits=[];
  if(buyer.operation)bits.push(buyer.operation);
  if((buyer.property_types||[]).length)bits.push((buyer.property_types||[]).join(', '));
  const zoneNames=(buyer.zone_ids||[]).map(id=>(locationCatalog.zones||[]).find(z=>z.id===id)?.nombre).filter(Boolean);
  const munNames=(buyer.municipality_ids||[]).map(id=>(locationCatalog.municipalities||[]).find(m=>m.id===id)?.nombre).filter(Boolean);
  if(zoneNames.length)bits.push(zoneNames.slice(0,3).join(' · ')+(zoneNames.length>3?` +${zoneNames.length-3}`:''));
  else if(munNames.length)bits.push(munNames.join(' · '));
  if(buyer.max_price)bits.push(`hasta $${Number(buyer.max_price).toLocaleString('es-VE')}`);
  if(buyer.min_bedrooms)bits.push(`${buyer.min_bedrooms}+ hab`);
  return bits.join(' · ')||'Criterios por definir';
}

export function buyerWhatsAppHref(buyer={}){
  const digits=String(buyer.phone||'').replace(/\D/g,'');
  if(!digits)return '';
  const normalized=digits.startsWith('0')?`58${digits.slice(1)}`:digits.length===10?`58${digits}`:digits;
  return `https://wa.me/${normalized}`;
}
