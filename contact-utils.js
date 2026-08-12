
import { listZipEntries, extractZipEntry, decodeChat } from './zip-reader.js?v=0502';
const NOISE=new Set('colega colegas lic licda lcda ing ingeniero ingeniera asesor asesora inmobiliario inmobiliaria realtor broker brokers agente bienes raices real estate remax rem max vende alquila ventas alquileres carabobo valencia'.split(' '));
function noAccents(s=''){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
export function cleanPhone(raw=''){
  let d=String(raw).replace(/\D/g,'');if(!d)return '';
  if(d.startsWith('00'))d=d.slice(2);
  if(d.startsWith('0')&&d.length===11)d='58'+d.slice(1);
  else if(!d.startsWith('58')&&d.length===10&&d.startsWith('4'))d='58'+d;
  if(d.length<10||d.length>15)return '';return d;
}
export function displayPhone(phone=''){
  const d=cleanPhone(phone);const m=d.match(/^58(4\d{2})(\d{3})(\d{4})$/);
  return m?`0${m[1]}-${m[2]}${m[3]}`:(d?`+${d}`:'');
}
export function normalizePersonName(name=''){
  const s=noAccents(name).toLowerCase().replace(/https?:\/\/\S+/g,' ').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
  return s.split(' ').filter(t=>t&&!NOISE.has(t)&&!/^\d+$/.test(t)).join(' ').trim();
}
export function personTokens(name=''){return normalizePersonName(name).split(' ').filter(t=>t.length>=2);}
export function personAliasKeys(name=''){
  const full=normalizePersonName(name),t=personTokens(name),out=new Set();if(full)out.add(full);
  if(t.length>=2){out.add(`${t[0]} ${t[1]}`);out.add(`${t[0]} ${t[t.length-1]}`);if(t.length>=3)out.add(`${t[0]} ${t[1]} ${t[t.length-1]}`);}
  else if(t.length===1&&t[0].length>=5)out.add(t[0]);return [...out].filter(Boolean);
}
function phoneCandidates(text=''){
  const rx=/(?:\+?58[\s().-]*)?(?:0?4(?:12|14|16|24|26))[\s().-]*\d{3}[\s.-]*\d{4}|\+\d[\d\s().-]{8,17}\d/g;
  return [...String(text).matchAll(rx)].map(m=>cleanPhone(m[0])).filter(Boolean);
}
function rec(name,phone,source){
  const p=cleanPhone(phone),n=String(name||'').trim(),keys=personAliasKeys(n);
  return p&&n&&keys.length?{phone:p,display_name:n,aliases:[n],alias_keys:keys,sources:[source]}:null;
}
function dedupe(rows=[]){
  const m=new Map();for(const r of rows.filter(Boolean)){const p=cleanPhone(r.phone);if(!p)continue;
    const x=m.get(p)||{phone:p,display_name:r.display_name||'',aliases:[],alias_keys:[],sources:[]};
    x.display_name=x.display_name||r.display_name||'';
    x.aliases=[...new Set([...x.aliases,...(r.aliases||[]),...(r.display_name?[r.display_name]:[])])];
    x.alias_keys=[...new Set([...x.alias_keys,...(r.alias_keys||[]),...x.aliases.flatMap(personAliasKeys)])];
    x.sources=[...new Set([...x.sources,...(r.sources||[])])];m.set(p,x);}
  return [...m.values()];
}
function uv(s=''){return String(s).replace(/\\n/gi,' ').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\').trim();}
export function parseVCard(text='',source='vcf'){
  const out=[];for(const b of String(text).split(/END:VCARD/i)){if(!/BEGIN:VCARD/i.test(b))continue;
    const fn=(b.match(/^FN(?:;[^:]*)?:(.+)$/mi)||[])[1],n=(b.match(/^N(?:;[^:]*)?:(.+)$/mi)||[])[1];
    let name=uv(fn||'');if(!name&&n){const p=uv(n).split(';').filter(Boolean);name=[p[1],p[0],...p.slice(2)].filter(Boolean).join(' ');}
    const ph=[...b.matchAll(/^TEL(?:;[^:]*)?:(.+)$/gmi)].flatMap(m=>phoneCandidates(m[1]));for(const x of ph)out.push(rec(name,x,source));}
  return dedupe(out);
}
function csvLine(line,d=','){const o=[];let c='',q=false;for(let i=0;i<line.length;i++){const x=line[i];if(x==='"'){if(q&&line[i+1]==='"'){c+='"';i++;}else q=!q;}else if(x===d&&!q){o.push(c);c='';}else c+=x;}o.push(c);return o.map(x=>x.trim());}
function header(h,rx){return h.findIndex(x=>rx.test(noAccents(x).toLowerCase()));}
export function parseCsv(text='',source='csv'){
  const lines=String(text).split(/\r?\n/).filter(x=>x.trim());if(!lines.length)return [];
  const d=lines[0].split(';').length>lines[0].split(',').length?';':(lines[0].split('\t').length>lines[0].split(',').length?'\t':',');
  const h=csvLine(lines[0],d),ni=header(h,/(nombre|name|full name|display name|contacto|contact)/),pi=header(h,/(telefono|phone|mobile|movil|celular|whatsapp)/);
  const start=ni>=0||pi>=0?1:0,out=[];
  for(let i=start;i<lines.length;i++){const cols=csvLine(lines[i],d),ph=pi>=0?phoneCandidates(cols[pi]||''):phoneCandidates(lines[i]);
    let name=ni>=0?(cols[ni]||''):'';if(!name&&ph.length)name=lines[i].replace(/\+?\d[\d\s().-]{8,17}\d/g,' ').replace(/[;,|\t]+/g,' ').replace(/\s+/g,' ').trim();
    for(const x of ph)out.push(rec(name,x,source));}return dedupe(out);
}
function walk(v,source,out){if(Array.isArray(v)){v.forEach(x=>walk(x,source,out));return;}if(!v||typeof v!=='object')return;
  const e=Object.entries(v),find=rx=>e.find(([k])=>rx.test(noAccents(k).toLowerCase()))?.[1];
  const name=find(/^(name|nombre|full_name|fullname|display_name|contact|contacto|sender|remitente)$/),phone=find(/^(phone|telefono|telephone|mobile|movil|celular|whatsapp|wa)$/);
  if(name&&phone){for(const val of (Array.isArray(phone)?phone:[phone]))for(const x of phoneCandidates(String(val)))out.push(rec(String(name),x,source));}
  for(const [,x] of e)if(typeof x==='object')walk(x,source,out);
}
export function parseJson(text='',source='json'){try{const o=[];walk(JSON.parse(text),source,o);return dedupe(o);}catch{return [];}}
export function parsePlainText(text='',source='txt'){
  const out=[];let sender='';const wa=/^\[[^\]]+\]\s*([^:]{2,100}):\s*(.*)$/;
  for(const raw of String(text).split(/\r?\n/)){const line=raw.trim();if(!line)continue;const m=line.match(wa);
    if(m){sender=m[1].trim();for(const x of phoneCandidates(m[2]))out.push(rec(sender,x,source));continue;}
    const ph=phoneCandidates(line);if(!ph.length)continue;let name=line.replace(/\+?\d[\d\s().-]{8,17}\d/g,' ').replace(/[\-–—|,;:\t]+/g,' ').replace(/\s+/g,' ').trim();if(!name)name=sender;
    for(const x of ph)out.push(rec(name,x,source));}return dedupe(out);
}
export function parseContactText(text='',name='contactos.txt'){
  const e=(name.split('.').pop()||'').toLowerCase();if(e==='vcf'||e==='vcard')return parseVCard(text,name);if(e==='csv'||e==='tsv')return parseCsv(text,name);if(e==='json')return parseJson(text,name);return parsePlainText(text,name);
}
const supported=n=>/\.(?:vcf|vcard|csv|tsv|txt|json)$/i.test(n);
export async function parseContactBlob(blob,name='contactos'){
  if(/\.zip$/i.test(name)){const bytes=new Uint8Array(await blob.arrayBuffer()),entries=listZipEntries(bytes).filter(e=>supported(e.name)&&!e.name.endsWith('/'));let all=[];
    for(const e of entries){try{all.push(...parseContactText(decodeChat(await extractZipEntry(bytes,e)),e.name));}catch{}}
    return dedupe(all.map(r=>({...r,sources:[...(r.sources||[]),name]})));}
  return dedupe(parseContactText(await blob.text(),name));
}
export function buildContactIndex(contacts=[]){
  const byId=new Map(),exact=new Map(),tokenMap=new Map(),add=(m,k,id)=>{if(!k)return;const s=m.get(k)||new Set();s.add(id);m.set(k,s);};
  for(const c of contacts){const id=cleanPhone(c.phone);if(!id)continue;byId.set(id,c);for(const a of [...(c.aliases||[]),c.display_name].filter(Boolean)){for(const k of personAliasKeys(a))add(exact,k,id);for(const t of personTokens(a))if(t.length>=3)add(tokenMap,t,id);}}
  return {byId,exact,tokenMap};
}
function inter(sets){if(!sets.length)return new Set();const ss=[...sets].sort((a,b)=>a.size-b.size),o=new Set(ss[0]);for(const s of ss.slice(1))for(const x of [...o])if(!s.has(x))o.delete(x);return o;}
export function resolveContactName(name,index){
  const key=normalizePersonName(name);if(!key||!index)return {status:'none'};const ex=index.exact.get(key);
  if(ex?.size===1){const id=[...ex][0];return {status:'resolved',phone:id,contact:index.byId.get(id),confidence:1,reason:'nombre exacto'};}
  if(ex?.size>1)return {status:'ambiguous',count:ex.size};
  const t=personTokens(name).filter(x=>x.length>=3);
  if(t.length>=2){const ids=inter(t.map(x=>index.tokenMap.get(x)).filter(Boolean));if(ids.size===1){const id=[...ids][0];return {status:'resolved',phone:id,contact:index.byId.get(id),confidence:.92,reason:'nombres coincidentes'};}if(ids.size>1)return {status:'ambiguous',count:ids.size};}
  if(t.length===1&&t[0].length>=5){const ids=index.tokenMap.get(t[0]);if(ids?.size===1){const id=[...ids][0];return {status:'resolved',phone:id,contact:index.byId.get(id),confidence:.78,reason:'nombre único'};}if(ids?.size>1)return {status:'ambiguous',count:ids.size};}
  return {status:'none'};
}
export function resolvePropertyContact(p,index){
  const names=[p?.sender,...(p?.sources||[]).map(s=>s?.sender)].filter(Boolean),seen=new Set();
  for(const name of names){const k=normalizePersonName(name);if(!k||seen.has(k))continue;seen.add(k);const r=resolveContactName(name,index);if(r.status==='resolved')return {...r,matched_name:name};}
  return {status:'none'};
}
