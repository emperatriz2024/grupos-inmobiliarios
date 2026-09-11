(()=>{
'use strict';
const ENGINE='V4.0';
const PREFIX4='hola Colega me envías esta opción por favor';
let searchContext={active:false,op:null};

function n4(x){return String(x||'').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u202f|\u00a0/g,' ').replace(/\s+/g,' ').trim()}
function h4(s){try{return hash(s)}catch{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}}
function e4(s){try{return esc(s)}catch{return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]))}}
function c4(v){return v?'$'+new Intl.NumberFormat('es-VE').format(v):'—'}
function money4(s){let x=String(s||'').replace(/\s/g,'').replace(/[^\d.,]/g,'');if(!x)return null;const dots=(x.match(/\./g)||[]).length,commas=(x.match(/,/g)||[]).length;if(!dots&&!commas)return +x;if((dots>1&&!commas)||(commas>1&&!dots))return +x.replace(/[.,]/g,'');if(dots&&commas){const i=Math.max(x.lastIndexOf('.'),x.lastIndexOf(',')),aft=x.length-i-1;if(aft<=2)return +(x.slice(0,i).replace(/[.,]/g,'')+'.'+x.slice(i+1));return +x.replace(/[.,]/g,'')}const sep=dots?'.':',',parts=x.split(sep),aft=parts.at(-1).length;if(aft===3)return +parts.join('');if(aft<=2)return +(parts.slice(0,-1).join('')+'.'+parts.at(-1));return +parts.join('')}

function cleanExport4(txt){return String(txt||'').replace(/\r/g,'').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').replace(/\u202f|\u00a0/g,' ')}
function collectHeaders4(text){
  const s=cleanExport4(text),hits=[];
  const br=/\[(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),\s*([^\]]{1,80})\]\s*(?:-\s*)?([^:\n]{1,160}):\s*/g;
  let m;while((m=br.exec(s)))hits.push({index:m.index,end:br.lastIndex,date:m[1],sender:m[3].trim(),kind:'br'});
  const pl=/(^|\n)\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),\s*([^\n\-]{1,80})\s+-\s+([^:\n]{1,160}):\s*/gm;
  while((m=pl.exec(s)))hits.push({index:m.index+(m[1]?m[1].length:0),end:pl.lastIndex,date:m[2],sender:m[4].trim(),kind:'pl'});
  hits.sort((a,b)=>a.index-b.index||a.end-b.end);
  const out=[];let lastEnd=-1;for(const h of hits){if(h.index<lastEnd)continue;out.push(h);lastEnd=h.end}return{s,headers:out};
}
function splitText4(text,fallback){
  const {s,headers}=collectHeaders4(text);if(!headers.length)return fallback?[{date:fallback.date,sender:fallback.sender,text:s.trim()}]:[];
  const out=[];const pre=s.slice(0,headers[0].index).trim();if(pre&&fallback)out.push({date:fallback.date,sender:fallback.sender,text:pre});
  for(let i=0;i<headers.length;i++){const h=headers[i],end=i+1<headers.length?headers[i+1].index:s.length,body=s.slice(h.end,end).trim();if(body)out.push({date:h.date,sender:h.sender,text:body})}
  return out;
}
function robustParse4(txt){return splitText4(txt,null)}
try{parse=robustParse4}catch{}

function allPhones4(x){const ms=String(x||'').match(/(?:\+?58\s*)?(?:0?)(?:412|414|416|424|426)[\s().-]*\d{3}[\s.-]*\d{4}/g)||[];return[...new Set(ms.map(v=>{let d=v.replace(/\D/g,'').replace(/^58/,'').replace(/^0/,'');return d.length===10?'+58'+d:null}).filter(Boolean))]}
function rawPhone4(raw){for(const line of String(raw||'').split(/\n/)){if(/contact|whatsapp|asesor|asesora|info|telefono|tel[eé]fono|tlf/i.test(line)){const p=allPhones4(line);if(p.length===1)return p[0]}}const a=allPhones4(raw);return a.length===1?a[0]:null}

const TYPE_RULES4=[
  ['Casa comercial',/\bcasa\s+comercial\b/],
  ['Local comercial',/\b(?:local\s+comercial|local\s+en\s+(?:venta|alquiler))\b/],
  ['Penthouse',/\b(?:pent\s*house|penthouse)\b/],
  ['Townhouse',/\b(?:town\s*house|townhouse|tonwhouse|town\s*home|stone\s*house|\bth\b)\b/],
  ['Apartamento',/\b(?:apartamento|apto\.?)\b/],
  ['Galpón',/\b(?:galpon|nave\s+industrial)\b/],
  ['Oficina',/\boficina\b/],
  ['Edificio',/\bedificio\b/],
  ['Depósito',/\bdeposito\b/],
  ['Terreno',/\bterreno\b/],
  ['Parcela',/\bparcela\b/],
  ['Casa',/\b(?:casa|quinta)\b/],
  ['Local comercial',/\blocal\b/]
];
function strictType4(raw){const x=n4(raw);for(const [t,r] of TYPE_RULES4)if(r.test(x))return t;return null}

const LOCS4={
  Naguanagua:{'Mañongo':['mañongo','manongo'],'La Granja':['la granja'],Tazajal:['tazajal'],'Piedra Pintada':['piedra pintada']},
  'San Diego':{'Valle de Oro':['valle de oro'],'La Esmeralda':['la esmeralda'],'Los Faroles':['los faroles'],'La Cumaca':['la cumaca','cumaca'],'Pueblo Viejo':['pueblo viejo'],'Valles del Nogal':['valles del nogal','valle del nogal'],'Paso Real':['paso real'],'El Remanso':['el remanso'],Montemayor:['montemayor'],'Lomas de la Hacienda':['lomas de la hacienda'],Tulipán:['tulipan'],'Terrazas de San Diego':['terrazas de san diego'],'Villas del Campo':['villas del campo'],'Los Frailes':['los frailes'],'Valle de Oro':['valle de oro']},
  Valencia:{'La Trigaleña':['la trigaleña','trigaleña'],'El Trigal':['el trigal','trigal norte','trigal sur','trigal centro'],'El Bosque':['el bosque'],'Las Chimeneas':['las chimeneas','chimeneas'],Prebo:['prebo'],'La Viña':['la viña','la vina'],'El Parral':['el parral'],'Agua Blanca':['agua blanca'],'Campo Alegre':['campo alegre'],'Los Mangos':['los mangos'],Guaparo:['guaparo'],'Valles de Camoruco':['valles de camoruco'],'Sabana Larga':['sabana larga'],'Valle Blanco':['valle blanco'],'Altos de Guataparo':['altos de guataparo'],'La Guacamaya':['la guacamaya']},
  'Los Guayos':{'Los Guayos':['los guayos'],Paraparal:['paraparal']}
};
function strictLoc4(raw){const x=n4(raw);for(const [mun,zs] of Object.entries(LOCS4))for(const [z,aa] of Object.entries(zs))if(aa.some(a=>x.includes(n4(a))))return{municipio:mun,zona:z};if(/\bsan\s+diego\b/.test(x))return{municipio:'San Diego',zona:null};if(/\bnaguanagua\b/.test(x))return{municipio:'Naguanagua',zona:null};if(/\blos\s+guayos\b/.test(x))return{municipio:'Los Guayos',zona:null};if(/\bvalencia\b/.test(x))return{municipio:'Valencia',zona:null};return{municipio:null,zona:null}}

function request4(raw){const x=n4(raw),head=x.slice(0,700);if(/^\W*(?:solicitud|solicito|busco|se busca|cliente busca|requiero|necesito)\b/.test(head))return true;const req=/\b(?:solicitud|solicito|solicita|se solicita|busco|se busca|cliente busca|requiero|requiere|necesito|buscando|presupuesto hasta|para la compra)\b/.test(head);const list=/\b(?:se vende|vendo|en venta|se alquila|alquilo|en alquiler|disponible|nueva captacion|nueva captación|ofrece en venta|ofrece en alquiler)\b/.test(head);return req&&!list}
function strictOperation4(raw){const x=n4(raw);const sale=/\b(?:se\s+vende|vende|vendo|venta|en\s+venta|precio\s+de\s+venta|venta\s+privada|inversion)\b/.test(x);const rent=/\b(?:se\s+alquila|alquila|alquiler|arrendamiento|renta|canon)\b/.test(x);if(sale&&rent)return'Venta/Alquiler';if(sale)return'Venta';if(rent)return'Alquiler';return null}

function amount4(token,suffix){let v=money4(token);const s=n4(suffix);if(!v)return null;if(s==='k'||s==='mil')v*=1000;else if(/^millon/.test(s))v*=1000000;return v}
function taggedAmounts4(raw){const s=String(raw||''),out=[];const A='(\\d{1,3}(?:[.,]\\d{3})+|\\d{1,8}(?:[.,]\\d{1,2})?)\\s*(k|mil|mill[oó]n(?:es)?)?';const defs=[
  ['sale',new RegExp('(?:precio(?:\\s+de\\s+venta|\\s+ref\\.?|\\s+de\\s+oportunidad)?|valor|inversi[oó]n|ref(?:erencia)?|baja|oferta)\\s*[:\\-~.]?\\s*(?:usd|us\\$|\\$)?\\s*'+A+'\\s*(?:usd|d[oó]lares?|\\$)?','gi')],
  ['rent',new RegExp('(?:canon(?:\\s+de\\s+arrendamiento)?|alquiler|renta|arrendamiento)\\s*[:\\-~.]?\\s*(?:usd|us\\$|\\$)?\\s*'+A+'\\s*(?:usd|d[oó]lares?|\\$)?','gi')],
  ['any',new RegExp('(?:usd|us\\$|\\$)\\s*'+A,'gi')],
  ['any',new RegExp(A+'\\s*(?:usd|d[oó]lares?|\\$)','gi')]
];for(const [kind,r] of defs){let m;while((m=r.exec(s))){const v=amount4(m[1],m[2]);if(v&&v>=100&&v<=100000000)out.push({v,kind,index:m.index})}}out.sort((a,b)=>a.index-b.index);return out}
function strictPrices4(raw,op){const a=taggedAmounts4(raw),sale=a.filter(x=>x.kind==='sale').map(x=>x.v),rent=a.filter(x=>x.kind==='rent').map(x=>x.v),any=a.filter(x=>x.kind==='any').map(x=>x.v);let salePrice=sale.length?sale.at(-1):null,rentPrice=rent.length?rent.at(-1):null;if(op==='Venta'&&!salePrice)salePrice=any.find(v=>v>=1000)||null;if(op==='Alquiler'&&!rentPrice)rentPrice=any.find(v=>v>=100&&v<=15000)||null;if(op==='Venta/Alquiler'){if(!salePrice)salePrice=any.find(v=>v>=1000)||null;if(!rentPrice)rentPrice=any.find(v=>v>=100&&v<=15000&&v!==salePrice)||null}return{salePrice,rentPrice}}
function strictArea4(raw){const x=n4(raw),pats=[/(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:m2|m²|mts\s*2|mtrs\s*2|mts2|mtrs2|metros?\s+cuadrados?)/,/(?:metraje|area)\s*[:\-]?\s*(\d{1,5}(?:[.,]\d{1,2})?)/];for(const r of pats){const m=x.match(r);if(m){const v=+m[1].replace(',','.');if(v>=9&&v<=50000)return v}}return null}
function strictCount4(raw,k,typeName){const x=n4(raw),rules={h:[/(\d{1,2})\s*(?:habitaciones?|hab\.?|dormitorios?)\b/,/\b(?:habitaciones?|hab\.?|dormitorios?)\s*[:\-]?\s*(\d{1,2})\b/],b:[/(\d{1,2})\s*(?:banos?|baños?)\b/,/\b(?:banos?|baños?)\s*[:\-]?\s*(\d{1,2})\b/],e:[/(\d{1,2})\s*(?:puestos?(?:\s+de\s+estacionamiento)?|ptos?\.?|estacionamientos?)\b/,/\b(?:puestos?(?:\s+de\s+estacionamiento)?|ptos?\.?|estacionamientos?)\s*[:\-]?\s*(\d{1,2})\b/]};for(const r of rules[k]){const m=x.match(r);if(m){const v=+m[1];if((k==='h'||k==='b')&&v>20)return null;if(k==='e'&&['Apartamento','Penthouse','Townhouse','Casa'].includes(typeName)&&v>12)return null;if(k==='e'&&v>80)return null;return v}}return null}
function strictFeatures4(raw){const x=n4(raw),out=[];const map={pozo:/\bpozo\b/,planta:/\bplanta\s+electrica\b|\bplanta\s+(?:100|50)\s*%?/,piscina:/\bpiscina\b/,amoblado:/\bamoblad[oa]\b|\bamueblad[oa]\b|\bsemi\s*amoblad[oa]\b/,vigilancia:/\bvigilancia\b|\bseguridad\s+24/,financiamiento:/\bfinanciamiento\b|\bfinancia/,vehículo:/\b(?:acepta|recibe)\s+vehiculo\b|\bvehiculo\s+como\s+parte\s+de\s+pago\b/,maletero:/\bmaletero\b/,balcón:/\bbalcon\b/,terraza:/\bterraza\b/,patio:/\bpatio\b/,'gas directo':/\bgas\s+directo\b/,ascensor:/\bascensor\b/,inversor:/\binversor\b/};for(const[k,r]of Object.entries(map))if(r.test(x))out.push(k);return out}

function resolve4(p){p.phone=null;p.contactName=null;const sp=allPhones4(p.sender)[0]||null;if(sp){p.phone=sp;p.contactSource='número del emisor';return p}let a=[];try{a=cmap.get(key(p.sender))||[]}catch{}const u=[...new Set(a.map(x=>x.phone).filter(Boolean))];if(u.length===1){p.phone=u[0];p.contactName=a[0].name;p.contactSource='contacto iPhone del emisor';return p}const rp=rawPhone4(p.raw);if(rp){p.phone=rp;p.contactSource='número publicado por el captador';return p}p.contactSource=u.length>1?'nombre ambiguo en contactos':'captador no resuelto';return p}
try{resolve=resolve4}catch{}

function strictReclassify4(p){const raw=String(p.raw||'').trim(),t=strictType4(raw),L=strictLoc4(raw),o=strictOperation4(raw),P=strictPrices4(raw,o);p.tipo=t;p.municipio=L.municipio;p.zona=L.zona;p.op=o;p.salePrice=P.salePrice;p.rentPrice=P.rentPrice;p.precio=o==='Venta'?P.salePrice:o==='Alquiler'?P.rentPrice:(P.salePrice||P.rentPrice||null);p.m2=strictArea4(raw);p.h=strictCount4(raw,'h',t);p.b=strictCount4(raw,'b',t);p.e=strictCount4(raw,'e',t);p.features=strictFeatures4(raw);p.age=typeof age==='function'?age(p.date):p.age;p._strictV4=ENGINE;resolve4(p);return p}
function looksListing4(p){if(!p||!String(p.raw||'').trim()||request4(p.raw))return false;return !!(p.op&&(p.tipo||p.salePrice||p.rentPrice||p.m2||p.h||p.b||p.e))}
function canonical4(raw){return n4(String(raw||'').replace(/imagen omitida/gi,' ').replace(/\s+/g,' '))}
function repairRecords4(list){const out=[],seen=new Set();for(const p of list||[]){const segs=splitText4(p.raw,{date:p.date,sender:p.sender});for(const seg of segs){const raw=String(seg.text||'').trim();if(!raw)continue;const sig=n4(seg.sender||p.sender)+'|'+canonical4(raw);if(seen.has(sig))continue;const q={...p,id:'v4-'+h4(sig),date:seg.date||p.date,sender:seg.sender||p.sender,raw,ts:(typeof dateOf==='function'&&dateOf(seg.date))?dateOf(seg.date).getTime():(p.ts||Date.now())};strictReclassify4(q);if(!looksListing4(q))continue;seen.add(sig);out.push(q)}}return out.sort((a,b)=>(b.ts||0)-(a.ts||0))}

let baseProp4=null;try{baseProp4=prop}catch{}
if(baseProp4){prop=function(m,src){const p=baseProp4(m,src);return p?strictReclassify4(p):p}}

function queryIntent4(raw){const x=n4(raw),typeName=strictType4(x),L=strictLoc4(x);const sale=/\b(?:venta|vende|vendo|se\s+vende|compra)\b/.test(x),rent=/\b(?:alquiler|alquila|se\s+alquila|renta|canon)\b/.test(x),op=sale&&rent?'Venta/Alquiler':sale?'Venta':rent?'Alquiler':null,features=strictFeatures4(x);const stop=new Set('town house townhouse tonwhouse stone home venta vende vendo compra se en alquiler alquila renta canon san diego naguanagua valencia los guayos apartamento apto casa penthouse local comercial terreno parcela oficina galpon edificio deposito pozo planta electrica piscina amoblado amueblado vigilancia financiamiento vehiculo'.split(' '));for(const w of features.flatMap(f=>n4(f).split(' ')))stop.add(w);const free=x.split(/[^a-z0-9]+/).filter(w=>w.length>2&&!stop.has(w));return{type:typeName,municipio:L.municipio,zona:L.zona,op,features,free}}
function opMatch4(p,o){if(!o)return true;if(o==='?')return !p.op;if(o==='Venta')return p.op==='Venta'||(p.op==='Venta/Alquiler'&&!!p.salePrice);if(o==='Alquiler')return p.op==='Alquiler'||(p.op==='Venta/Alquiler'&&!!p.rentPrice);return p.op===o}
function priceFor4(p,o){if(o==='Venta')return p.salePrice;if(o==='Alquiler')return p.rentPrice;return p.precio}

function render4(a){const count=document.querySelector('#count'),results=document.querySelector('#results');if(count)count.textContent='('+a.length+')';if(!results)return;if(!a.length){results.className='empty';results.innerHTML='No encontré inventario vigente con esos criterios.';return}results.className='';const contextOp=searchContext.active&&['Venta','Alquiler'].includes(searchContext.op)?searchContext.op:null;results.innerHTML=a.slice(0,250).map(p=>{strictReclassify4(p);const shownOp=contextOp||(p.op||'Operación por confirmar');let priceHtml;if(contextOp)priceHtml='<div class="price">'+c4(priceFor4(p,contextOp))+'</div>';else if(p.op==='Venta/Alquiler')priceHtml='<div class="price">'+(p.salePrice?'Venta '+c4(p.salePrice):'Venta —')+(p.rentPrice?'<br><small>Alquiler '+c4(p.rentPrice)+'</small>':'')+'</div>';else priceHtml='<div class="price">'+c4(p.precio)+'</div>';const L=[p.zona,p.municipio].filter(Boolean).join(' · ')||'Ubicación por confirmar',F=(p.features||[]).slice(0,6).map(x=>'<span class="pill">'+e4(x)+'</span>').join(''),capt=e4(p.contactName||p.sender||'Emisor sin identificar'),msg=PREFIX4+'\n\n'+p.raw,contact=p.phone?'<button class="primary wa" data-phone="'+e4(p.phone)+'" data-msg="'+e4(msg)+'">Contactar captador por WhatsApp</button><div class="hint">'+e4(p.contactSource)+'</div>':'<button class="wa" disabled style="opacity:.58">Captador sin teléfono vinculado</button><div class="hint">Emisor: '+capt+'. Importa tus contactos VCF si este nombre está guardado en tu iPhone.</div>';return'<article class="card"><div class="head"><div><div><span class="pill">'+e4(shownOp)+'</span>'+(p.tipo?'<span class="pill">'+e4(p.tipo)+'</span>':'')+'</div><div class="loc">'+e4(L)+'</div><div class="sender"><b>Captador:</b> '+capt+'</div></div><div>'+priceHtml+'<div class="age">'+(p.age===0?'hoy':p.age===1?'hace 1 día':Number.isFinite(p.age)?'hace '+p.age+' días':'')+'</div></div></div><div class="specs"><div class="spec"><b>'+e4(p.m2??'—')+'</b><span>m²</span></div><div class="spec"><b>'+e4(p.h??'—')+'</b><span>HAB</span></div><div class="spec"><b>'+e4(p.b??'—')+'</b><span>BAÑOS</span></div><div class="spec"><b>'+e4(p.e??'—')+'</b><span>PUESTOS</span></div></div><div class="features">'+F+'</div>'+contact+'<details><summary>Mensaje original</summary><pre>'+e4(p.raw)+'</pre></details></article>'}).join('');document.querySelectorAll('[data-phone]').forEach(b=>b.onclick=()=>location.href='https://wa.me/'+b.dataset.phone.replace(/\D/g,'')+'?text='+encodeURIComponent(b.dataset.msg))}
try{render=render4}catch{}

function search4(){const I=queryIntent4(document.querySelector('#q')?.value||''),pm=+(document.querySelector('#pmax')?.value||0),hm=+(document.querySelector('#hmin')?.value||0),bm=+(document.querySelector('#bmin')?.value||0),em=+(document.querySelector('#emin')?.value||0),mm=+(document.querySelector('#mmin')?.value||0),o=(document.querySelector('#op')?.value||I.op||''),m=(document.querySelector('#municipio')?.value||I.municipio||''),z=(document.querySelector('#zona')?.value||I.zona||''),t=(document.querySelector('#tipo')?.value||I.type||''),fs=[...new Set([document.querySelector('#ft')?.value,...I.features].filter(Boolean))];searchContext={active:true,op:o||null};const a=(props||[]).filter(p=>{strictReclassify4(p);if(m&&p.municipio!==m)return false;if(z&&p.zona!==z)return false;if(t&&p.tipo!==t)return false;if(!opMatch4(p,o))return false;const pv=priceFor4(p,o);if(pm&&(!pv||pv>pm))return false;if(hm&&(p.h==null||p.h<hm))return false;if(bm&&(p.b==null||p.b<bm))return false;if(em&&(p.e==null||p.e<em))return false;if(mm&&(p.m2==null||p.m2<mm))return false;if(fs.some(f=>!(p.features||[]).includes(f)))return false;const hay=n4([p.tipo,p.op,p.municipio,p.zona,p.raw,(p.features||[]).join(' ')].join(' '));return I.free.every(w=>hay.includes(w))}).sort((a,b)=>(b.ts||0)-(a.ts||0));render4(a)}
try{search=search4}catch{}

async function apply4(){try{if(typeof props==='undefined'||!Array.isArray(props)||typeof db==='undefined'){setTimeout(apply4,250);return}const repaired=repairRecords4(props);props=repaired;try{if(typeof clearStore==='function'&&typeof puts==='function'&&db){await clearStore('properties');if(props.length)await puts('properties',props)}}catch(e){console.warn('V4 persist',e)}try{if(typeof filters==='function')filters()}catch{}const sb=document.querySelector('#searchBtn');if(sb)sb.onclick=search4;document.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>{const s=document.querySelector('#op');if(s)s.value=b.dataset.op;search4()});document.querySelectorAll('[data-ft]').forEach(b=>b.onclick=()=>{const s=document.querySelector('#ft');if(s)s.value=b.dataset.ft;search4()});const reset=document.querySelector('#reset');if(reset)reset.onclick=()=>{for(const id of['q','pmax','hmin','bmin','emin','mmin']){const x=document.querySelector('#'+id);if(x)x.value=''}for(const id of['municipio','zona','tipo','op','ft']){const x=document.querySelector('#'+id);if(x)x.value=''}searchContext={active:false,op:null};render4(props)};const q=document.querySelector('#q');if(q&&!q.dataset.v4){q.dataset.v4='1';q.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search4()}})}searchContext={active:false,op:null};render4(props);try{if(typeof stat==='function')stat()}catch{}const st=document.querySelector('#status');if(st)st.textContent='Motor V4 activo · mensajes separados y filtros estrictos por tipo, ubicación y operación.'}catch(e){console.error('patch-v4',e)}}
function wait4(){if(typeof props==='undefined'||typeof db==='undefined'){setTimeout(wait4,250);return}setTimeout(apply4,250)}
wait4();
})();
