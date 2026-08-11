
const ACCENTS = {á:'a',é:'e',í:'i',ó:'o',ú:'u',ü:'u',ñ:'n'};

export function norm(s='') {
  return String(s).toLowerCase()
    .replace(/[áéíóúüñ]/g, c => ACCENTS[c] || c)
    .replace(/[^\p{L}\p{N}$%+.\-\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseDateDMY(s='') {
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return 0;
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  return new Date(y, Number(m[2])-1, Number(m[1])).getTime();
}

export function recencyInfo(dateStr, now = Date.now()) {
  const ts = parseDateDMY(dateStr);
  if (!ts) return { days: 9999, label: 'Fecha no disponible', cls: 'expired' };
  const days = Math.max(0, Math.floor((now - ts) / 86400000));
  if (days <= 7) return { days, label: days === 0 ? 'Hoy' : `${days} d`, cls: 'recent' };
  if (days <= 14) return { days, label: `${days} d`, cls: 'valid' };
  if (days <= 21) return { days, label: `${days} d · verificar`, cls: 'verify' };
  return { days, label: `${days} d · vencida`, cls: 'expired' };
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
    const r = recencyInfo(p.date);
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
    arr.sort((a,b) => parseDateDMY(b.date) - parseDateDMY(a.date) || String(b.time||'').localeCompare(String(a.time||'')));
  }
  return arr;
}
