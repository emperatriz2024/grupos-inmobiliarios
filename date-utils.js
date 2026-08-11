
export function splitWhatsAppDate(s='') {
  const m=String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(!m) return null;
  let y=Number(m[3]);
  if(y<100) y+=2000;
  return {a:Number(m[1]),b:Number(m[2]),y};
}

export function detectDateOrderFromDates(dates=[], fallback='MDY') {
  let mdy=0,dmy=0;
  for(const s of dates){
    const p=splitWhatsAppDate(s);
    if(!p) continue;
    if(p.a>12 && p.b<=12) dmy++;
    else if(p.b>12 && p.a<=12) mdy++;
  }
  if(mdy>dmy) return 'MDY';
  if(dmy>mdy) return 'DMY';
  return fallback;
}

export function detectDateOrderFromText(text='', fallback='MDY') {
  const dates=[];
  const rx=/^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),/gm;
  let m;
  while((m=rx.exec(String(text)))!==null){
    dates.push(m[1]);
    if(dates.length>=5000) break;
  }
  return detectDateOrderFromDates(dates,fallback);
}

export function parseFlexibleDate(value, order='auto', fallback='MDY') {
  if(!value) return 0;

  // Normalized ISO date is preferred.
  const iso=String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(iso){
    const y=Number(iso[1]), mo=Number(iso[2]), d=Number(iso[3]);
    const dt=new Date(y,mo-1,d);
    if(dt.getFullYear()===y && dt.getMonth()===mo-1 && dt.getDate()===d) return dt.getTime();
    return 0;
  }

  const p=splitWhatsAppDate(value);
  if(!p) return 0;

  let resolved=order;
  if(resolved==='auto' || !resolved){
    if(p.a>12 && p.b<=12) resolved='DMY';
    else if(p.b>12 && p.a<=12) resolved='MDY';
    else resolved=fallback;
  }

  const day=resolved==='MDY' ? p.b : p.a;
  const month=resolved==='MDY' ? p.a : p.b;
  if(month<1 || month>12 || day<1 || day>31) return 0;

  const dt=new Date(p.y,month-1,day);
  // Reject JS overflow dates (e.g. month 31).
  if(dt.getFullYear()!==p.y || dt.getMonth()!==month-1 || dt.getDate()!==day) return 0;
  return dt.getTime();
}

export function toISODate(value, order='auto', fallback='MDY') {
  const ts=parseFlexibleDate(value,order,fallback);
  if(!ts) return null;
  const d=new Date(ts);
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

export function daysOld(value, now=Date.now(), order='auto', fallback='MDY') {
  const ts=parseFlexibleDate(value,order,fallback);
  if(!ts) return 9999;
  const today=new Date(now);
  today.setHours(0,0,0,0);
  const then=new Date(ts);
  then.setHours(0,0,0,0);
  return Math.floor((today.getTime()-then.getTime())/86400000);
}

export function propertyTimestamp(p) {
  if(!p) return 0;
  if(p.date_iso) return parseFlexibleDate(p.date_iso,'auto','MDY');
  return parseFlexibleDate(p.date,p.date_order||'auto','MDY');
}
