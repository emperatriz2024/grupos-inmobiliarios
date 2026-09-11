(()=>{
'use strict';
const ENGINE='V3.1';
const PREFIX3='hola Colega me envías esta opción por favor';
let activeOp=null;

function n3(x){return String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u202f|\u00a0/g,' ').replace(/\s+/g,' ').trim()}
function h3(s){try{return hash(s)}catch{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}}
function e3(s){try{return esc(s)}catch{return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}}
function c3(v){try{return cash(v)}catch{return v?'$'+new Intl.NumberFormat('es-VE').format(v):'—'}}
function money3(s){try{return money(s)}catch{let x=String(s||'').replace(/\s/g,'').replace(/[^\d.,]/g,'');if(!x)return null;if(/[.,]\d{3}$/.test(x))return +x.replace(/[.,]/g,'');return +x.replace(',','.')}}

function robustParse3(txt){
  const lines=String(txt||'').replace(/\r/g,'').replace(/\u202f/g,' ').replace(/\u00a0/g,' ').split('\n');
  const out=[];let cur=null;
  const d='(\\d{1,2}[\\/.\\-]\\d{1,2}[\\/.\\-]\\d{2,4})';
  const br=new RegExp('^\\['+d+',\\s*([^\\]]+)\\]\\s*(?:-\\s*)?(.+?):\\s?(.*)$');
  const pl=new RegExp('^'+d+',\\s*(.+?)\\s+-\\s+(.+?):\\s?(.*)$');
  for(const line of lines){const m=line.match(br)||line.match(pl);if(m){if(cur&&cur.text.trim())out.push(cur);cur={date:m[1],sender:m[3].trim(),text:m[4]||''}}else if(cur)cur.text+='\n'+line}
  if(cur&&cur.text.trim())out.push(cur);return out;
}
try{parse=robustParse3}catch{}

function allPhones3(x){const ms=String(x||'').match(/(?:\+?58\s*)?(?:0?)(?:412|414|416|424|426)[\s().-]*\d{3}[\s.-]*\d{4}/g)||[];return[...new Set(ms.map(v=>{let d=v.replace(/\D/g,'').replace(/^58/,'').replace(/^0/,'');return d.length===10?'+58'+d:null}).filter(Boolean))]}
function rawPhone3(raw){const a=allPhones3(raw);if(a.length===1)return a[0];for(const line of String(raw||'').split(/\n/)){if(/contact|whatsapp|asesor|asesora|info|telefono|tel[eé]fono|tlf/i.test(line)){const p=allPhones3(line);if(p.length===1)return p[0]}}return null}

const TYPE_RULES=[
  ['Casa comercial',/\bcasa\s+comercial\b/],
  ['Local comercial',/\b(?:local\s+comercial|local\s+en\s+(?:venta|alquiler)|local)\b/],
  ['Penthouse',/\b(?:pent\s*house|penthouse)\b/],
  ['Townhouse',/\b(?:town\s*house|townhouse|tonwhouse|town\s*home)\b/],
  ['Apartamento',/\b(?:apartamento|apto\.?)\b/],
  ['Galpón',/\b(?:galpon|nave\s+industrial)\b/],
  ['Oficina',/\boficina\b/],
  ['Edificio',/\bedificio\b/],
  ['Depósito',/\bdeposito\b/],
  ['Terreno',/\bterreno\b/],
  ['Parcela',/\bparcela\b/],
  ['Casa',/\b(?:casa|quinta)\b/]
];
function strictType(raw){const x=n3(raw);for(const [t,r] of TYPE_RULES)if(r.test(x))return t;return null}

function strictLoc(raw){const x=n3(raw);
  const extra={
    Naguanagua:{'Mañongo':['mañongo','manongo'],'La Granja':['la granja'],Tazajal:['tazajal'],'Piedra Pintada':['piedra pintada']},
    'San Diego':{'Valle de Oro':['valle de oro'],'La Esmeralda':['la esmeralda'],'Los Faroles':['los faroles'],'La Cumaca':['la cumaca','cumaca'],'Pueblo Viejo':['pueblo viejo'],'Valles del Nogal':['valles del nogal','valle del nogal'],'Paso Real':['paso real'],'El Remanso':['el remanso'],Montemayor:['montemayor'],'Lomas de la Hacienda':['lomas de la hacienda'],Tulipán:['tulipan'],'Terrazas de San Diego':['terrazas de san diego'],'Villas del Campo':['villas del campo'],'Los Frailes':['los frailes']},
    Valencia:{'La Trigaleña':['la trigaleña','trigaleña'],'El Trigal':['el trigal','trigal norte','trigal sur','trigal centro'],'El Bosque':['el bosque'],'Las Chimeneas':['las chimeneas','chimeneas'],Prebo:['prebo'],'La Viña':['la viña','la vina'],'El Parral':['el parral'],'Agua Blanca':['agua blanca'],'Campo Alegre':['campo alegre'],'Los Mangos':['los mangos'],Guaparo:['guaparo'],'Valles de Camoruco':['valles de camoruco'],'Sabana Larga':['sabana larga'],'Valle Blanco':['valle blanco'],'Altos de Guataparo':['altos de guataparo']},
    'Los Guayos':{'Los Guayos':['los guayos'],Paraparal:['paraparal']}
  };
  for(const [mun,zs] of Object.entries(extra))for(const [z,aa] of Object.entries(zs))if(aa.some(a=>x.includes(n3(a))))return{municipio:mun,zona:z};
  if(/\bsan\s+diego\b/.test(x))return{municipio:'San Diego',zona:null};
  if(/\bnaguanagua\b/.test(x))return{municipio:'Naguanagua',zona:null};
  if(/\blos\s+guayos\b/.test(x))return{municipio:'Los Guayos',zona:null};
  if(/\bvalencia\b/.test(x))return{municipio:'Valencia',zona:null};
  return{municipio:null,zona:null};
}

function strictOperation(raw){const x=n3(raw);const sale=/\b(?:se\s+vende|vende|vendo|venta|en\s+venta|precio\s+de\s+venta|ref(?:erencia)?\s+inversion|inversion)\b/.test(x);const rent=/\b(?:se\s+alquila|alquila|alquiler|arrendamiento|renta|canon)\b/.test(x);if(sale&&rent)return'Venta/Alquiler';if(sale)return'Venta';if(rent)return'Alquiler';return null}
function isRequest3(raw){const x=n3(raw);return /\b(?:solicito|solicita|solicitó|busco|busca|se\s+busca|requiero|requiere|necesito|cliente\s+busca|buscando)\b/.test(x)&&!/\b(?:ofrece|vendo|vende|se\s+vende|alquilo|alquila|se\s+alquila|disponible|captacion|captación)\b/.test(x)}

function taggedAmounts(raw){const s=String(raw||''),out=[];const add=(m,kind)=>{let v=money3(m[1]);if(v&&m[2])v*=1000;if(v&&v>=100&&v<=50000000)out.push({v,kind})};
  const pats=[
    {kind:'sale',r:/(?:precio(?:\s+de\s+venta)?|valor|inversi[oó]n|ref(?:erencia)?\s+inversi[oó]n)\s*[:\-~]?\s*(?:usd|us\$|\$)?\s*(\d{1,3}(?:[.,]\d{3})+|\d{3,7})(?:\s*(k|mil))?\s*(?:usd|d[oó]lares?|\$)?/gi},
    {kind:'rent',r:/(?:canon|alquiler|renta|arrendamiento)\s*[:\-~]?\s*(?:usd|us\$|\$)?\s*(\d{1,3}(?:[.,]\d{3})+|\d{2,6})(?:\s*(k|mil))?\s*(?:usd|d[oó]lares?|\$)?/gi},
    {kind:'any',r:/(?:usd|us\$|\$)\s*(\d{1,3}(?:[.,]\d{3})+|\d{3,7})(?:\s*(k|mil))?/gi},
    {kind:'any',r:/(\d{1,3}(?:[.,]\d{3})+|\d{3,7})(?:\s*(k|mil))?\s*(?:usd|d[oó]lares?|\$)/gi}
  ];
  for(const {kind,r} of pats){let m;while((m=r.exec(s)))add(m,kind)}return out;
}
function strictPrices(raw,op){const a=taggedAmounts(raw),sale=a.filter(x=>x.kind==='sale').map(x=>x.v),rent=a.filter(x=>x.kind==='rent').map(x=>x.v),any=a.filter(x=>x.kind==='any').map(x=>x.v);let salePrice=sale[0]||null,rentPrice=rent[0]||null;
  if(op==='Venta'&&!salePrice){const c=any.filter(v=>v>=1000);salePrice=c[0]||null}
  if(op==='Alquiler'&&!rentPrice){const c=any.filter(v=>v>=100&&v<=15000);rentPrice=c[0]||null}
  if(op==='Venta/Alquiler'){
    if(!salePrice){const c=any.filter(v=>v>=1000);salePrice=c[0]||null}
    if(!rentPrice){const c=any.filter(v=>v>=100&&v<=15000&&v!==salePrice);rentPrice=c[0]||null}
  }
  return{salePrice,rentPrice};
}
function strictArea(raw){const x=n3(raw);const pats=[/(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:m2|m²|mts\s*2|mtrs\s*2|mts2|mtrs2|metros?\s+cuadrados?)/,/(?:metraje|area|área)\s*[:\-]?\s*(\d{1,4}(?:[.,]\d{1,2})?)/];for(const r of pats){const m=x.match(r);if(m){let v=+m[1].replace(',','.');if(v>=10&&v<=50000)return v}}return null}
function strictCount3(raw,k,typeName){const x=n3(raw);const rules={h:[/(\d{1,2})\s*(?:habitaciones?|dormitorios?)\b/,/\b(?:habitaciones?|dormitorios?)\s*[:\-]?\s*(\d{1,2})\b/],b:[/(\d{1,2})\s*(?:banos?|baños?)\b/,/\b(?:banos?|baños?)\s*[:\-]?\s*(\d{1,2})\b/],e:[/(\d{1,2})\s*(?:puestos?(?:\s+de\s+estacionamiento)?|estacionamientos?)\b/,/\b(?:puestos?(?:\s+de\s+estacionamiento)?|estacionamientos?)\s*[:\-]?\s*(\d{1,2})\b/]};for(const r of rules[k]){const m=x.match(r);if(m){const v=+m[1];if((k==='h'||k==='b')&&v>20)return null;if(k==='e'&&['Apartamento','Penthouse','Townhouse','Casa'].includes(typeName)&&v>12)return null;if(k==='e'&&v>80)return null;return v}}return null}
function strictFeatures(raw){const x=n3(raw),out=[];const map={pozo:/\bpozo\b/,planta:/\bplanta\s+electrica\b|\bplanta\s+(?:100|50)\s*%?/,piscina:/\bpiscina\b/,amoblado:/\bamoblad[oa]\b|\bamueblad[oa]\b/,vigilancia:/\bvigilancia\b|\bseguridad\s+24/,financiamiento:/\bfinanciamiento\b|\bfinancia/,vehículo:/\b(?:acepta|recibe)\s+vehiculo\b|\bvehiculo\s+como\s+parte\s+de\s+pago\b/,maletero:/\bmaletero\b/,balcón:/\bbalcon\b/,terraza:/\bterraza\b/,patio:/\bpatio\b/,'gas directo':/\bgas\s+directo\b/,ascensor:/\bascensor\b/,inversor:/\binversor\b/};for(const[k,r]of Object.entries(map))if(r.test(x))out.push(k);return out}

function resolve3(p){p.phone=null;p.contactName=null;const sp=allPhones3(p.sender)[0]||null;if(sp){p.phone=sp;p.contactSource='número del emisor';return p}let a=[];try{a=cmap.get(key(p.sender))||[]}catch{}const u=[...new Set(a.map(x=>x.phone).filter(Boolean))];if(u.length===1){p.phone=u[0];p.contactName=a[0].name;p.contactSource='contacto iPhone del emisor';return p}const rp=rawPhone3(p.raw);if(rp){p.phone=rp;p.contactSource='número publicado por el captador';return p}p.contactSource=u.length>1?'nombre ambiguo en contactos':'captador no resuelto';return p}
try{resolve=resolve3}catch{}

function strictReclassify(p){const raw=String(p.raw||'').trim();const t=strictType(raw),L=strictLoc(raw),o=strictOperation(raw),P=strictPrices(raw,o);p.tipo=t;p.municipio=L.municipio;p.zona=L.zona;p.op=o;p.salePrice=P.salePrice;p.rentPrice=P.rentPrice;p.precio=o==='Venta'?P.salePrice:o==='Alquiler'?P.rentPrice:(P.salePrice||P.rentPrice||null);p.m2=strictArea(raw);p.h=strictCount3(raw,'h',t);p.b=strictCount3(raw,'b',t);p.e=strictCount3(raw,'e',t);p.features=strictFeatures(raw);p.age=typeof age==='function'?age(p.date):p.age;p._strictV3=ENGINE;resolve3(p);return p}
function looksListing(p){if(!p||!String(p.raw||'').trim()||isRequest3(p.raw))return false;return !!(p.op&&(p.tipo||p.salePrice||p.rentPrice||p.m2||p.h||p.b||p.e))}

function splitStored(p){const raw=String(p.raw||'').replace(/\r/g,'');const lines=raw.split('\n');const d='(\\d{1,2}[\\/.\\-]\\d{1,2}[\\/.\\-]\\d{2,4})';const br=new RegExp('^\\['+d+',\\s*([^\\]]+)\\]\\s*(?:-\\s*)?(.+?):\\s?(.*)$');const pl=new RegExp('^'+d+',\\s*(.+?)\\s+-\\s+(.+?):\\s?(.*)$');let cur={date:p.date,sender:p.sender,text:''},out=[];for(const line of lines){const m=line.match(br)||line.match(pl);if(m){if(cur.text.trim())out.push(cur);cur={date:m[1],sender:m[3].trim(),text:m[4]||''}}else cur.text+=(cur.text?'\n':'')+line}if(cur.text.trim())out.push(cur);return out}
function repairRecords(list){const out=[],seen=new Set();for(const p of list||[]){for(const seg of splitStored(p)){const raw=String(seg.text||'').trim();if(!raw)continue;const sig=n3([seg.date,seg.sender,raw].join('|'));if(seen.has(sig))continue;const q={...p,id:'v3-'+h3(sig),date:seg.date||p.date,sender:seg.sender||p.sender,raw,ts:(typeof dateOf==='function'&&dateOf(seg.date))?dateOf(seg.date).getTime():(p.ts||Date.now())};strictReclassify(q);if(!looksListing(q))continue;seen.add(sig);out.push(q)}}return out.sort((a,b)=>(b.ts||0)-(a.ts||0))}

let baseProp=null;try{baseProp=prop}catch{}
if(baseProp){prop=function(m,src){const p=baseProp(m,src);return p?strictReclassify(p):p}}

function queryIntent3(raw){const x=n3(raw);let typeName=strictType(x),L=strictLoc(x),sale=/\b(?:venta|vende|vendo|se\s+vende)\b/.test(x),rent=/\b(?:alquiler|alquila|se\s+alquila|renta|canon)\b/.test(x),op=sale&&rent?'Venta/Alquiler':sale?'Venta':rent?'Alquiler':null;const features=strictFeatures(x);const stop=new Set('town house townhouse tonwhouse venta vende vendo se en alquiler alquila renta canon san diego naguanagua valencia los guayos apartamento apto casa penthouse local comercial terreno parcela oficina galpon edificio deposito pozo planta electrica piscina amoblado amueblado vigilancia financiamiento vehiculo'.split(' '));for(const w of features.flatMap(f=>n3(f).split(' ')))stop.add(w);const free=x.split(/[^a-z0-9]+/).filter(w=>w.length>2&&!stop.has(w));return{type:typeName,municipio:L.municipio,zona:L.zona,op,features,free}}
function opMatch3(p,o){if(!o)return true;if(o==='?')return !p.op;if(o==='Venta')return p.op==='Venta'||p.op==='Venta/Alquiler';if(o==='Alquiler')return p.op==='Alquiler'||p.op==='Venta/Alquiler';return p.op===o}
function priceFor3(p,o){if(o==='Venta')return p.salePrice;if(o==='Alquiler')return p.rentPrice;return p.precio}

function render3(a){const count=document.querySelector('#count'),results=document.querySelector('#results');if(count)count.textContent='('+a.length+')';if(!results)return;if(!a.length){results.className='empty';results.innerHTML='No encontré inventario vigente con esos criterios.';return}results.className='';results.innerHTML=a.slice(0,250).map(p=>{strictReclassify(p);const contextOp=activeOp&&activeOp!=='?'?activeOp:null;const shownOp=contextOp||(p.op||'Operación por confirmar');let priceHtml='';if(contextOp){priceHtml='<div class="price">'+c3(priceFor3(p,contextOp))+'</div>'}else if(p.op==='Venta/Alquiler'){priceHtml='<div class="price">'+(p.salePrice?'Venta '+c3(p.salePrice):'Venta —')+(p.rentPrice?'<br><small>Alquiler '+c3(p.rentPrice)+'</small>':'')+'</div>'}else priceHtml='<div class="price">'+c3(p.precio)+'</div>';
  const L=[p.zona,p.municipio].filter(Boolean).join(' · ')||'Ubicación por confirmar';const F=(p.features||[]).slice(0,6).map(x=>'<span class="pill">'+e3(x)+'</span>').join('');const capt=e3(p.contactName||p.sender||'Emisor sin identificar');const msg=PREFIX3+'\n\n'+p.raw;const contact=p.phone?'<button class="primary wa" data-phone="'+e3(p.phone)+'" data-msg="'+e3(msg)+'">Contactar captador por WhatsApp</button><div class="hint">'+e3(p.contactSource)+'</div>':'<button class="wa" disabled style="opacity:.58">Captador sin teléfono vinculado</button><div class="hint">Emisor: '+capt+'. Importa tus contactos VCF si este nombre está guardado en tu iPhone.</div>';
  return'<article class="card"><div class="head"><div><div><span class="pill">'+e3(shownOp)+'</span>'+(p.tipo?'<span class="pill">'+e3(p.tipo)+'</span>':'')+'</div><div class="loc">'+e3(L)+'</div><div class="sender"><b>Captador:</b> '+capt+'</div></div><div>'+priceHtml+'<div class="age">'+(p.age===0?'hoy':p.age===1?'hace 1 día':'hace '+p.age+' días')+'</div></div></div><div class="specs"><div class="spec"><b>'+e3(p.m2??'—')+'</b><span>m²</span></div><div class="spec"><b>'+e3(p.h??'—')+'</b><span>HAB</span></div><div class="spec"><b>'+e3(p.b??'—')+'</b><span>BAÑOS</span></div><div class="spec"><b>'+e3(p.e??'—')+'</b><span>PUESTOS</span></div></div><div class="features">'+F+'</div>'+contact+'<details><summary>Mensaje original</summary><pre>'+e3(p.raw)+'</pre></details></article>'}).join('');document.querySelectorAll('[data-phone]').forEach(b=>b.onclick=()=>location.href='https://wa.me/'+b.dataset.phone.replace(/\D/g,'')+'?text='+encodeURIComponent(b.dataset.msg))}
try{render=render3}catch{}

function search3(){const I=queryIntent3(document.querySelector('#q')?.value||''),pm=+(document.querySelector('#pmax')?.value||0),hm=+(document.querySelector('#hmin')?.value||0),bm=+(document.querySelector('#bmin')?.value||0),em=+(document.querySelector('#emin')?.value||0),mm=+(document.querySelector('#mmin')?.value||0),o=(document.querySelector('#op')?.value||I.op||''),m=(document.querySelector('#municipio')?.value||I.municipio||''),z=(document.querySelector('#zona')?.value||I.zona||''),t=(document.querySelector('#tipo')?.value||I.type||''),fs=[...new Set([document.querySelector('#ft')?.value,...I.features].filter(Boolean))];activeOp=o||null;const a=(props||[]).filter(p=>{strictReclassify(p);if(m&&p.municipio!==m)return false;if(z&&p.zona!==z)return false;if(t&&p.tipo!==t)return false;if(!opMatch3(p,o))return false;const pv=priceFor3(p,o);if(pm&&(!pv||pv>pm))return false;if(hm&&(p.h==null||p.h<hm))return false;if(bm&&(p.b==null||p.b<bm))return false;if(em&&(p.e==null||p.e<em))return false;if(mm&&(p.m2==null||p.m2<mm))return false;if(fs.some(f=>!(p.features||[]).includes(f)))return false;const hay=n3([p.tipo,p.op,p.municipio,p.zona,p.raw,(p.features||[]).join(' ')].join(' '));return I.free.every(w=>hay.includes(w))}).sort((a,b)=>(b.ts||0)-(a.ts||0));render3(a)}
try{search=search3}catch{}

async function apply3(){try{
  if(typeof props==='undefined'||!Array.isArray(props)){setTimeout(apply3,250);return}
  const repaired=repairRecords(props);if(repaired.length){props=repaired;try{if(typeof clearStore==='function'&&typeof puts==='function'&&db){await clearStore('properties');await puts('properties',props)}}catch(e){console.warn('V3 persist',e)}}
  const sb=document.querySelector('#searchBtn');if(sb)sb.onclick=search3;
  document.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>{const s=document.querySelector('#op');if(s)s.value=b.dataset.op;search3()});
  document.querySelectorAll('[data-ft]').forEach(b=>b.onclick=()=>{const s=document.querySelector('#ft');if(s)s.value=b.dataset.ft;search3()});
  const reset=document.querySelector('#reset');if(reset)reset.onclick=()=>{for(const id of['q','pmax','hmin','bmin','emin','mmin']){const x=document.querySelector('#'+id);if(x)x.value=''}for(const id of['municipio','zona','tipo','op','ft']){const x=document.querySelector('#'+id);if(x)x.value=''}activeOp=null;render3(props)};
  render3(props);try{if(typeof stat==='function')stat()}catch{}
  const st=document.querySelector('#status');if(st)st.textContent='Motor V3 estricto activo · cada tarjeta se calcula solo desde su propio mensaje.';
}catch(e){console.error('patch-v3',e)}}
function wait(){if(typeof props==='undefined'||typeof db==='undefined'){setTimeout(wait,250);return}setTimeout(apply3,200)}
wait();
})();
