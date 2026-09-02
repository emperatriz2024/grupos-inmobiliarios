// Radar Inmobiliario v0.5.3 — Vigencia Inteligente
export const EXTERNAL_MAX_AGE_DAYS = 20;
export const EXTERNAL_VERIFY_TTL_DAYS = 7;

const DAY = 86400000;

export function daysSince(raw, now=Date.now()){
  const t=raw?Date.parse(raw):NaN;
  return Number.isFinite(t)?Math.max(0,Math.floor((now-t)/DAY)):9999;
}

export function sourceFreshness(post={}, now=Date.now()){
  const status=post.availability_status||'unverified';
  const publishedDays=daysSince(post.published_at||post.detected_at,now);
  const verifiedDays=daysSince(post.last_verified_at,now);
  const verifiedUntil=post.verified_until?Date.parse(post.verified_until):NaN;

  if(status==='unavailable'){
    return {code:'unavailable',label:'No disponible',className:'dead',action:true,publishedDays,verifiedDays};
  }
  if(status==='sold'){
    return {code:'sold',label:'Vendida / cerrada',className:'dead',action:true,publishedDays,verifiedDays};
  }
  if(status==='verified' && (Number.isFinite(verifiedUntil)?verifiedUntil>=now:verifiedDays<=EXTERNAL_VERIFY_TTL_DAYS)){
    return {code:'verified',label:'Confirmada vigente',className:'verified',action:false,publishedDays,verifiedDays};
  }
  if(publishedDays<=7){
    return {code:'recent',label:'Recién publicada',className:'recent',action:false,publishedDays,verifiedDays};
  }
  if(publishedDays<=15){
    return {code:'probable',label:'Vigente probable',className:'probable',action:false,publishedDays,verifiedDays};
  }
  if(publishedDays<=EXTERNAL_MAX_AGE_DAYS){
    return {code:'verify',label:'Verificar vigencia',className:'verify',action:true,publishedDays,verifiedDays};
  }
  return {code:'expired',label:'Vencida por antigüedad',className:'expired',action:true,publishedDays,verifiedDays};
}

export function externalFreshnessStats(rows=[]){
  const out={total:rows.length,verified:0,recent:0,action:0,expired:0,unavailable:0};
  for(const r of rows){
    const f=sourceFreshness(r);
    if(f.code==='verified')out.verified++;
    if(['recent','probable'].includes(f.code))out.recent++;
    if(['verify','expired'].includes(f.code))out.action++;
    if(f.code==='expired')out.expired++;
    if(['unavailable','sold'].includes(f.code))out.unavailable++;
  }
  return out;
}

export function masterAvailabilityGate(master={},now=Date.now()){
  const status=master.status||'active_unverified';
  if(['stale','unavailable','sold','inactive'].includes(status))return {pass:false,reason:'Inventario no vigente'};
  const types=master.source_types||[];
  const hasWhatsapp=types.includes('whatsapp');
  if(hasWhatsapp)return {pass:true,reason:null};

  // External-only inventory: a recent manual verification keeps it active.
  const verifiedDays=daysSince(master.last_verified_at,now);
  if(master.last_verified_at && verifiedDays<=EXTERNAL_VERIFY_TTL_DAYS)return {pass:true,reason:'Vigencia confirmada'};

  const lastSeen=daysSince(master.last_seen_at||master.updated_at||master.first_seen_at,now);
  if(types.length && !hasWhatsapp && lastSeen>EXTERNAL_MAX_AGE_DAYS){
    return {pass:false,reason:'Fuente externa vencida'};
  }
  return {pass:true,reason:null};
}
