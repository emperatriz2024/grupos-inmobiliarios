import { parseFlexibleDate, propertyTimestamp } from './date-utils.js';

const ACCENTS = {á:'a',é:'e',í:'i',ó:'o',ú:'u',ü:'u',ñ:'n'};

export function norm(s='') {
  return String(s).toLowerCase()
    .replace(/[áéíóúüñ]/g, c => ACCENTS[c] || c)
    .replace(/[^\p{L}\p{N}$%+.\-\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseDateDMY(s='', order='auto') {
  return parseFlexibleDate(s,order,'MDY');
}

export function recencyInfo(value, now = Date.now()) {
  let ts=0;
  if(value && typeof value==='object') ts=propertyTimestamp(value);
  else ts=parseFlexibleDate(value,'auto','MDY');

  if(!ts) return {days:9999,label:'Fecha no disponible',cls:'expired'};
  const today=new Date(now); today.setHours(0,0,0,0);
  const then=new Date(ts); then.setHours(0,0,0,0);
  const days=Math.floor((today.getTime()-then.getTime())/86400000);

  // A future date is invalid data, not “Hoy”.
  if(days < 0) return {days:9999,label:'Fecha inválida',cls:'expired'};
  if(days <= 7) return {days,label:days===0?'Hoy':`${days} d`,cls:'recent'};
  if(days <= 21) return {days,label:`${days} d`,cls:'valid'};
  if(days <= 60) return {days,label:`${days} d · verificar`,cls:'verify'};
  return {days,label:`${days} d · fuera de vigencia`,cls:'expired'};
}

export function formatMoney(v) {
  if (v == null || Number.isNaN(Number(v))) return 'Precio no detectado';
  return '$' + Number(v).toLocaleString('es-VE', {maximumFractionDigits: 0});
}

export function whatsappNumber(phone='') {
  let d = String(phone).replace(/\D/g,'');
  if (!d) return '';
  if (d.startsWith('0')) d = '58' + d.slice(1);
  else if (!d.startsWith('58') && d.length === 10) d = '58' + d;
  return d;
}

export function effectivePhone(p) {
  if (p?.phone) return p.phone;
  for (const s of p?.sources || []) if (s.phone) return s.phone;
  return '';
}

export function matchesFilters(p, f={}) {
  // REGLA DURA: ninguna tarjeta con fecha válida >45 días puede aparecer.
  // También ocultamos registros sin fecha interpretable para evitar inventario incierto.
  const hardRecency = recencyInfo(p);
  if (!Number.isFinite(hardRecency.days) || hardRecency.days > 60) return false;

  const hay = norm([
    p.operation, p.property_type, p.zone, p.residence, p.sender, p.group,
    p.text, p.normalized
  ].filter(Boolean).join(' '));

  const q = norm(f.q || '');
  if (q) {
    const tokens = q.split(' ').filter(Boolean);
    if (!tokens.every(t => hay.includes(t))) return false;
  }

  if (f.operation && p.operation !== f.operation) return false;
  if (f.property_type && p.property_type !== f.property_type) return false;
  if (f.zone && norm(p.zone || '') !== norm(f.zone)) return false;

  const residence = norm(f.residence || '');
  if (residence && !norm(p.residence || '').includes(residence) && !norm(p.text || '').includes(residence)) return false;

  const minPrice = Number(f.min_price || 0);
  const maxPrice = Number(f.max_price || 0);
  if (minPrice && (!p.price_usd || Number(p.price_usd) < minPrice)) return false;
  if (maxPrice && (!p.price_usd || Number(p.price_usd) > maxPrice)) return false;

  const minBeds = Number(f.bedrooms || 0);
  if (minBeds && (!p.bedrooms || Number(p.bedrooms) < minBeds)) return false;

  const minBaths = Number(f.bathrooms || 0);
  if (minBaths && (!p.bathrooms || Number(p.bathrooms) < minBaths)) return false;

  const minParking = Number(f.parking || 0);
  if (minParking && (!p.parking || Number(p.parking) < minParking)) return false;

  const minArea = Number(f.min_area || 0);
  const maxArea = Number(f.max_area || 0);
  if (minArea && (!p.area_m2 || Number(p.area_m2) < minArea)) return false;
  if (maxArea && (!p.area_m2 || Number(p.area_m2) > maxArea)) return false;

  for (const key of ['planta_100','planta_electrica','pozo','tanque','amoblado','financiamiento','piscina']) {
    if (f[key] && !p[key]) return false;
  }

  if (f.only_phone && !effectivePhone(p)) return false;
  if (f.max_age_days) {
    const r = recencyInfo(p);
    if (r.days > Number(f.max_age_days)) return false;
  }
  return true;
}

export function sortProperties(list, mode='recent') {
  const arr = [...list];
  if (mode === 'price_asc') {
    arr.sort((a,b) => (a.price_usd ?? Infinity) - (b.price_usd ?? Infinity));
  } else if (mode === 'price_desc') {
    arr.sort((a,b) => (b.price_usd ?? -1) - (a.price_usd ?? -1));
  } else if (mode === 'appearances') {
    arr.sort((a,b) => (b.appearances||0) - (a.appearances||0));
  } else {
    arr.sort((a,b) => propertyTimestamp(b) - propertyTimestamp(a) || String(b.time||'').localeCompare(String(a.time||'')));
  }
  return arr;
}
