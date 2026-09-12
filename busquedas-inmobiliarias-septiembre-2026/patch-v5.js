(()=>{
'use strict';
const ENGINE5='V5.0';
const PREFIX5='hola Colega me envías esta opción por favor';
let searchContext5={active:false,op:null};

function n5(x){return String(x||'').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u202f|\u00a0/g,' ').replace(/\s+/g,' ').trim()}
function h5(s){try{return hash(s)}catch{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}}
function e5(s){try{return esc(s)}catch{return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}}
function c5(v){return v?'$'+new Intl.NumberFormat('es-VE').format(v):'—'}
function money5(s){let x=String(s||'').replace(/\s/g,'').replace(/[^\d.,]/g,'');if(!x)return null;const dots=(x.match(/\./g)||[]).length,commas=(x.match(/,/g)||[]).length;if(!dots&&!commas)return +x;if((dots>1&&!commas)||(commas>1&&!dots))return +x.replace(/[.,]/g,'');if(dots&&commas){const i=Math.max(x.lastIndexOf('.'),x.lastIndexOf(',')),aft=x.length-i-1;if(aft<=2)return +(x.slice(0,i).replace(/[.,]/g,'')+'.'+x.slice(i+1));return +x.replace(/[.,]/g,'')}const sep=dots?'.':',',parts=x.split(sep),aft=parts.at(-1).length;if(aft===3)return +parts.join('');if(aft<=2)return +(parts.slice(0,-1).join('')+'.'+parts.at(-1));return +parts.join('')}

function cleanExport5(txt){return String(txt||'').replace(/\r/g,'').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').replace(/\u202f|\u00a0/g,' ')}
function parseStamp5(date,time){
  let d=null;try{d=dateOf(date)}catch{}
  if(!d)return 0;
  const z=String(time||'').toLowerCase().replace(/\./g,'').replace(/\s+/g,'');
  const m=z.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(am|pm)?$/);
  if(!m)return d.getTime();
  let hh=+m[1],mm=+m[2],ss=+(m[3]||0),ap=m[4]||'';
  if(ap==='pm'&&hh<12)hh+=12;if(ap==='am'&&hh===12)hh=0;
  d.setHours(hh,mm,ss,0);return d.getTime();
}
function collectHeaders5(text){
  const s=cleanExport5(text),hits=[];let m;
  const br=/\[(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),\s*([^\]]{1,80})\]\s*(?:-\s*)?([^:\n]{1,180}):\s*/g;
  while((m=br.exec(s)))hits.push({index:m.index,end:br.lastIndex,date:m[1],time:m[2].trim(),sender:m[3].trim(),kind:'br'});
  const pl=/(^|\n)\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),\s*(.{1,50}?)\s+-\s+([^:\n]{1,180}):\s*/gm;
  while((m=pl.exec(s)))hits.push({index:m.index+(m[1]?m[1].length:0),end:pl.lastIndex,date:m[2],time:m[3].trim(),sender:m[4].trim(),kind:'pl'});
  hits.sort((a,b)=>a.index-b.index||a.end-b.end);
  const out=[];let lastEnd=-1;
  for(const h of hits){if(h.index<lastEnd)continue;out.push(h);lastEnd=h.end}
  return{s,headers:out};
}
function splitText5(text,fallback){
  const {s,headers}=collectHeaders5(text);
  if(!headers.length)return fallback?[{date:fallback.date,time:fallback.time||'',sender:fallback.sender,text:s.trim()}]:[];
  const out=[],pre=s.slice(0,headers[0].index).trim();
  if(pre&&fallback)out.push({date:fallback.date,time:fallback.time||'',sender:fallback.sender,text:pre});
  for(let i=0;i<headers.length;i++){
    const h=headers[i],end=i+1<headers.length?headers[i+1].index:s.length,body=s.slice(h.end,end).trim();
    if(body)out.push({date:h.date,time:h.time,sender:h.sender,text:body});
  }
  return out;
}
function robustParse5(txt){return splitText5(txt,null)}
try{parse=robustParse5}catch{}

function allPhones5(x){
  const s=String(x||''),out=[],re=/(?:^|[^\d])((?:\+?58[\s().\-]{0,3})?0?4\d{2}(?:[\s().\-]{0,3}\d){7})(?=$|[^\d])/g;
  let m;while((m=re.exec(s))){
    let d=m[1].replace(/\D/g,'');if(d.startsWith('58'))d=d.slice(2);if(d.startsWith('0'))d=d.slice(1);
    if(d.length===10&&d[0]==='4')out.push('+58'+d);
  }
  return[...new Set(out)];
}
function cleanName5(s){
  let x=String(s||'').replace(/\+?58[\d\s().\-]+/g,' ').replace(/0?4\d{2}[\d\s().\-]{6,}/g,' ').replace(/[*_~•📲📞☎️👉➡️]/g,' ');
  x=x.replace(/\b(?:tlf|tel[eé]fono|telefono|celular|whatsapp|contacto|contacta|asesor(?:a)?|inmobiliari[oa]|licda?|econ)\b[:.\s-]*/gi,' ');
  return x.replace(/[^\p{L}\s.'-]/gu,' ').replace(/\s+/g,' ').trim();
}
function plausibleName5(s){
  const x=cleanName5(s),w=x.split(/\s+/).filter(Boolean);
  if(w.length<2||w.length>6)return null;
  if(/\b(?:precio|canon|venta|alquiler|casa|town|apartamento|terreno|parcela|habitacion|baño|bano|puesto|pozo|planta|residencia|conjunto|urbanizacion|inversion|ref|codigo|cod)\b/i.test(x))return null;
  return x;
}
function senderKeyTokens5(sender){
  return n5(sender).replace(/\b(?:colega|asesor|asesora|inmobiliario|inmobiliaria)\b/g,' ').replace(/[^a-z0-9ñ\s]/g,' ').split(/\s+/).filter(w=>w.length>=4);
}
function rawContact5(raw,sender){
  const lines=String(raw||'').split(/\n/),senderTokens=senderKeyTokens5(sender),candidates=[];
  for(let i=0;i<lines.length;i++){
    const phones=allPhones5(lines[i]);if(!phones.length)continue;
    const around=[lines[i-1]||'',lines[i],lines[i+1]||''].join(' ');
    const tagged=/contact|whatsapp|asesor|asesora|info|informaci[oó]n|telefono|tel[eé]fono|tlf|celular|llama|escribe/i.test(around);
    let nm=plausibleName5(lines[i])||plausibleName5(lines[i-1]||'')||plausibleName5(lines[i+1]||'');
    for(const ph of phones){
      let score=10+(tagged?100:0);
      const near=n5(around);if(senderTokens.some(t=>near.includes(t)))score+=150;
      if(nm)score+=25;
      candidates.push({phone:ph,name:nm,score,index:i});
    }
  }
  if(!candidates.length){
    const all=allPhones5(raw);if(all.length)return{phone:all[0],name:null,score:1,index:9999};
    return null;
  }
  candidates.sort((a,b)=>b.score-a.score||a.index-b.index);
  return candidates[0];
}

const TYPE_RULES5=[
  ['Casa comercial',/\bcasa\s+comercial\b/],
  ['Local comercial',/\b(?:local\s+comercial|local\s+en\s+(?:venta|alquiler))\b/],
  ['Penthouse',/\b(?:pent\s*house|penthouse)\b/],
  ['Townhouse',/\b(?:town\s*[- ]?house|townhouse|tonwhouse|towhouse|townhause|townhome|town\s*home|stone\s*house|t\.?h\.?)\b/],
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
function strictType5(raw){const x=n5(raw);for(const[t,r]of TYPE_RULES5)if(r.test(x))return t;return null}

const LOCS5={
  Naguanagua:{'Mañongo':['mañongo','manongo'],'La Granja':['la granja'],Tazajal:['tazajal'],'Piedra Pintada':['piedra pintada']},
  'San Diego':{
    'Valle de Oro':['valle de oro'],'La Esmeralda':['la esmeralda','altos de la esmeralda','altos de esmeralda'],'Los Faroles':['los faroles'],
    'La Cumaca':['la cumaca','cumaca'],'Pueblo Viejo':['pueblo viejo'],'Valles del Nogal':['valles del nogal','valle del nogal'],'Paso Real':['paso real'],
    'El Remanso':['el remanso'],Montemayor:['montemayor'],'Lomas de la Hacienda':['lomas de la hacienda'],Tulipán:['tulipan'],
    'Terrazas de San Diego':['terrazas de san diego'],'Villas del Campo':['villas del campo'],'Los Frailes':['los frailes'],
    'Amazonia':['amazonia'],'El Polvero':['el polvero'],'La Fuente':['la fuente'],'Villas Paraíso Country':['villas paraiso country','villas paraíso country'],
    'Aves del Paraíso':['aves del paraiso','aves del paraíso'],'Villa Vajegreda':['villa vajegreda','vajegreda'],'Yuma':['yuma']
  },
  Valencia:{'La Trigaleña':['la trigaleña','trigaleña'],'El Trigal':['el trigal','trigal norte','trigal sur','trigal centro'],'El Bosque':['el bosque'],'Las Chimeneas':['las chimeneas','chimeneas'],Prebo:['prebo'],'La Viña':['la viña','la vina'],'El Parral':['el parral'],'Agua Blanca':['agua blanca'],'Campo Alegre':['campo alegre'],'Los Mangos':['los mangos'],Guaparo:['guaparo'],'Valles de Camoruco':['valles de camoruco'],'Sabana Larga':['sabana larga'],'Valle Blanco':['valle blanco'],'Altos de Guataparo':['altos de guataparo'],'La Guacamaya':['la guacamaya']},
  'Los Guayos':{'Los Guayos':['los guayos'],Paraparal:['paraparal']}
};
function strictLoc5(raw){
  const x=n5(raw);
  for(const[mun,zs]of Object.entries(LOCS5))for(const[z,aa]of Object.entries(zs))if(aa.some(a=>x.includes(n5(a))))return{municipio:mun,zona:z};
  if(/\bsan\s+diego\b/.test(x))return{municipio:'San Diego',zona:null};
  if(/\bnaguanagua\b/.test(x))return{municipio:'Naguanagua',zona:null};
  if(/\blos\s+guayos\b/.test(x))return{municipio:'Los Guayos',zona:null};
  if(/\bvalencia\b/.test(x))return{municipio:'Valencia',zona:null};
  return{municipio:null,zona:null};
}
function request5(raw){
  const x=n5(raw),head=x.slice(0,900);
  if(/^\W*(?:solicitud|solicito|solicito|busco|se busca|cliente busca|requiero|necesito)\b/.test(head))return true;
  const req=/\b(?:solicitud|solicito|solicita|se solicita|busco|se busca|cliente busca|requiero|requiere|necesito|buscando|presupuesto hasta|para la compra)\b/.test(head);
  const listing=/\b(?:se vende|vendo|en venta|se alquila|alquilo|en alquiler|disponible|nueva captacion|ofrece en venta|ofrece en alquiler)\b/.test(head);
  return req&&!listing;
}
function highSaleHint5(raw){
  const x=n5(raw);if(!/\b(?:precio|valor|inversion|ref|referencia|oferta)\b/.test(x))return false;
  const ms=String(raw||'').match(/(?:\$|usd|us\$)\s*[\d.,]+|[\d.,]+\s*(?:\$|usd)/gi)||[];
  return ms.some(v=>{const n=money5(v);return n>=5000});
}
function strictOperation5(raw){
  const x=n5(raw);
  const sale=/\b(?:se\s+vende|vende|vendo|venta|en\s+venta|precio\s+de\s+venta|venta\s+privada|ofrece\s+en\s+venta)\b/.test(x);
  const rent=/\b(?:se\s+alquila|alquila|alquiler|en\s+alquiler|arrendamiento|renta|canon)\b/.test(x);
  if(sale&&rent)return'Venta/Alquiler';
  if(rent)return'Alquiler';
  if(sale||highSaleHint5(raw))return'Venta';
  return null;
}
function amount5(token,suffix){let v=money5(token),s=n5(suffix);if(!v)return null;if(s==='k'||s==='mil')v*=1000;else if(/^millon/.test(s))v*=1000000;return v}
function taggedAmounts5(raw){
  const s=String(raw||''),out=[],A='(\\d{1,3}(?:[.,]\\d{3})+|\\d{1,8}(?:[.,]\\d{1,2})?)\\s*(k|mil|mill[oó]n(?:es)?)?';
  const defs=[
    ['sale',new RegExp('(?:precio(?:\\s+de\\s+venta|\\s+ref\\.?|\\s+de\\s+oportunidad)?|valor|inversi[oó]n|ref(?:erencia)?|baja|oferta)\\s*[:\\-~.]?\\s*(?:usd|us\\$|\\$)?\\s*'+A+'\\s*(?:usd|d[oó]lares?|\\$)?','gi')],
    ['rent',new RegExp('(?:canon(?:\\s+de\\s+arrendamiento)?|alquiler|renta|arrendamiento)\\s*[:\\-~.]?\\s*(?:usd|us\\$|\\$)?\\s*'+A+'\\s*(?:usd|d[oó]lares?|\\$)?','gi')],
    ['any',new RegExp('(?:usd|us\\$|\\$)\\s*'+A,'gi')],
    ['any',new RegExp(A+'\\s*(?:usd|d[oó]lares?|\\$)','gi')],
    ['any',new RegExp('(?:💰|💲|💵)\\s*'+A,'g')],
    ['any',new RegExp(A+'\\s*(?:💰|💲|💵)','g')]
  ];
  for(const[k,r]of defs){let m;while((m=r.exec(s))){const v=amount5(m[1],m[2]);if(v&&v>=100&&v<=100000000)out.push({v,kind:k,index:m.index})}}
  return out.sort((a,b)=>a.index-b.index);
}
function strictPrices5(raw,op){
  const a=taggedAmounts5(raw),sale=a.filter(x=>x.kind==='sale').map(x=>x.v),rent=a.filter(x=>x.kind==='rent').map(x=>x.v),any=a.filter(x=>x.kind==='any').map(x=>x.v);
  let salePrice=sale.length?sale.at(-1):null,rentPrice=rent.length?rent.at(-1):null;
  if(op==='Venta'&&!salePrice)salePrice=any.find(v=>v>=5000)||any.find(v=>v>=1000)||null;
  if(op==='Alquiler'&&!rentPrice)rentPrice=any.find(v=>v>=100&&v<=15000)||null;
  if(op==='Venta/Alquiler'){if(!salePrice)salePrice=any.find(v=>v>=5000)||null;if(!rentPrice)rentPrice=any.find(v=>v>=100&&v<=15000&&v!==salePrice)||null}
  return{salePrice,rentPrice};
}
function strictArea5(raw){
  const x=n5(raw),pats=[
    /(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:m2|m²|mt2|mts\s*2|mtrs\s*2|mts2|mtrs2|metros?\s+cuadrados?)/,
    /(?:metraje|area|área)\s*[:\-]?\s*(\d{1,6}(?:[.,]\d{1,2})?)/
  ];
  for(const r of pats){const m=x.match(r);if(m){const v=+m[1].replace(',','.');if(v>=9&&v<=1000000)return v}}
  return null;
}
function strictCount5(raw,k,typeName){
  const x=n5(raw),rules={
    h:[/(\d{1,2})\s*(?:habitaciones?|hab\.?|dormitorios?)\b/,/\b(?:habitaciones?|hab\.?|dormitorios?)\s*[:\-]?\s*(\d{1,2})\b/,/\b(\d{1,2})\s*h\b/],
    b:[/(\d{1,2})\s*(?:banos?|baños?)\b/,/\b(?:banos?|baños?)\s*[:\-]?\s*(\d{1,2})\b/,/\b(\d{1,2})\s*b\b/],
    e:[/(\d{1,2})\s*(?:puestos?(?:\s+de\s+estacionamiento)?|ptos?\.?|estacionamientos?)\b/,/\b(?:puestos?(?:\s+de\s+estacionamiento)?|ptos?\.?|estacionamientos?)\s*[:\-]?\s*(\d{1,2})\b/,/\b(\d{1,2})\s*(?:p\s*\/?\s*e|pe)\b/]
  };
  for(const r of rules[k]){const m=x.match(r);if(m){const v=+m[1];if((k==='h'||k==='b')&&v>20)return null;if(k==='e'&&['Apartamento','Penthouse','Townhouse','Casa'].includes(typeName)&&v>15)return null;if(k==='e'&&v>100)return null;return v}}
  return null;
}
function strictFeatures5(raw){
  const x=n5(raw),out=[],map={pozo:/\bpozo\b/,planta:/\bplanta\s+electrica\b|\bplanta\s+(?:100|80|75|50)\s*%?/,piscina:/\bpiscina\b/,amoblado:/\bamoblad[oa]\b|\bamueblad[oa]\b|\bsemi\s*amoblad[oa]\b/,vigilancia:/\bvigilancia\b|\bseguridad\s+24/,financiamiento:/\bfinanciamiento\b|\bfinancia/,vehículo:/\b(?:acepta|recibe)\s+vehiculo\b|\bvehiculo\s+como\s+parte\s+de\s+pago\b/,maletero:/\bmaletero\b/,balcón:/\bbalcon\b/,terraza:/\bterraza\b/,patio:/\bpatio\b/,'gas directo':/\bgas\s+directo\b/,ascensor:/\bascensor\b/,inversor:/\binversor\b/};
  for(const[k,r]of Object.entries(map))if(r.test(x))out.push(k);return out;
}

function resolve5(p){
  p.phone=null;p.contactName=null;p.contactPhones=[];
  const sp=allPhones5(p.sender)[0]||null;
  if(sp){p.phone=sp;p.contactPhones=[sp];p.contactName=p.sender;p.contactSource='número del emisor del grupo';return p}
  const rc=rawContact5(p.raw,p.sender);
  if(rc){p.phone=rc.phone;p.contactPhones=allPhones5(p.raw);p.contactName=rc.name||p.sender;p.contactSource='número publicado en la descripción';return p}
  let a=[];try{a=cmap.get(key(p.sender))||[]}catch{}
  const u=[...new Set(a.map(x=>x.phone).filter(Boolean))];
  if(u.length===1){p.phone=u[0];p.contactPhones=u;p.contactName=a[0].name;p.contactSource='contacto iPhone del emisor';return p}
  p.contactSource=u.length>1?'nombre ambiguo en contactos':'captador no resuelto';return p;
}
try{resolve=resolve5}catch{}

function strictReclassify5(p){
  const raw=String(p.raw||'').trim(),t=strictType5(raw),L=strictLoc5(raw),o=strictOperation5(raw),P=strictPrices5(raw,o);
  p.tipo=t;p.municipio=L.municipio;p.zona=L.zona;p.op=o;p.salePrice=P.salePrice;p.rentPrice=P.rentPrice;
  p.precio=o==='Venta'?P.salePrice:o==='Alquiler'?P.rentPrice:(P.salePrice||P.rentPrice||null);
  p.m2=strictArea5(raw);p.h=strictCount5(raw,'h',t);p.b=strictCount5(raw,'b',t);p.e=strictCount5(raw,'e',t);
  p.features=strictFeatures5(raw);p.age=typeof age==='function'?age(p.date):p.age;if(!p.ts)p.ts=parseStamp5(p.date,p.time||'');p._strictV5=ENGINE5;resolve5(p);return p;
}
function looksListing5(p){if(!p||!String(p.raw||'').trim()||request5(p.raw))return false;return !!(p.op&&(p.tipo||p.salePrice||p.rentPrice||p.m2||p.h||p.b||p.e))}

function brokerKey5(p){
  const sp=allPhones5(p.sender)[0]||p.phone||null;if(sp)return'phone:'+sp;
  let s=n5(p.sender).replace(/^[~\s]+/,'').replace(/\b(?:colega|asesor|asesora|inmobiliario|inmobiliaria)\b/g,' ').replace(/[^a-z0-9ñ\s]/g,' ').replace(/\s+/g,' ').trim();
  return s?'sender:'+s:'contact:'+(p.phone||'sin-emisor');
}
function listingCode5(raw){const m=n5(raw).match(/\b(?:cod(?:igo)?)[\s:#.-]*([a-z0-9-]{3,24})\b/);return m?m[1]:null}
function anchor5(raw){
  const x=n5(raw.replace(/\n/g,' | ')),rs=[
    /\b(?:residencias?|res\.?|conjunto residencial|conjunto|urbanizacion|urb\.?|edificio)\s+([a-z0-9ñ .'-]{3,55})/,
    /\b(?:sector|callejon|callejón)\s+([a-z0-9ñ .'-]{3,45})/
  ];
  for(const r of rs){const m=x.match(r);if(m)return m[1].split(/\s+\|\s+|[;,]/)[0].trim()}
  return null;
}
const STOP5=new Set(('para con una uno unos unas del las los el la de en por que se su sus y o un al es esta este esta son como mas muy venta vende vendo alquiler alquila precio inversion valor ref referencia negociable oportunidad inmueble propiedad casa townhouse apartamento terreno parcela hab habitaciones banos baños puestos estacionamiento cocina sala comedor area areas tiene cuenta consta amplio amplia hermosa hermoso nueva nuevo captacion ofrece excelente listo firma registro imagen omitida asesor asesora inmobiliaria inmobiliario').split(/\s+/));
function identityText5(raw){
  let x=String(raw||'').replace(/imagen omitida/gi,' ').replace(/https?:\/\/\S+/gi,' ').replace(/\S+@\S+\.\S+/g,' ');
  for(const p of allPhones5(x))x=x.replace(new RegExp(p.replace(/\D/g,'').split('').join('[\\s().-]*'),'g'),' ');
  x=x.replace(/(?:precio|valor|inversi[oó]n|ref(?:erencia)?|canon|alquiler|baja|oferta)\s*[:\-~.]?\s*(?:usd|us\$|\$)?\s*[\d.,]+\s*(?:k|mil|usd|d[oó]lares?|\$)?/gi,' ');
  return n5(x).replace(/[^a-z0-9ñ\s]/g,' ').replace(/\s+/g,' ').trim();
}
function tokenSet5(raw){return new Set(identityText5(raw).split(/\s+/).filter(w=>w.length>=3&&!STOP5.has(w)))}
function jac5(a,b){if(!a.size||!b.size)return 0;let n=0;for(const x of a)if(b.has(x))n++;return n/(a.size+b.size-n)}
function nearNum5(a,b,tol=0){if(a==null||b==null)return null;return Math.abs(a-b)<=tol}
function sameListing5(a,b){
  if(brokerKey5(a)!==brokerKey5(b))return false;
  strictReclassify5(a);strictReclassify5(b);
  if(a.tipo&&b.tipo&&a.tipo!==b.tipo)return false;
  if(a.municipio&&b.municipio&&a.municipio!==b.municipio)return false;
  if(a.zona&&b.zona&&a.zona!==b.zona)return false;
  const ca=listingCode5(a.raw),cb=listingCode5(b.raw);if(ca&&cb)return ca===cb;
  if(a.m2!=null&&b.m2!=null&&Math.abs(a.m2-b.m2)>Math.max(6,Math.max(a.m2,b.m2)*0.05))return false;
  if(a.h!=null&&b.h!=null&&a.h!==b.h)return false;
  if(a.b!=null&&b.b!=null&&a.b!==b.b)return false;
  if(a.e!=null&&b.e!=null&&a.e!==b.e)return false;
  const ia=identityText5(a.raw),ib=identityText5(b.raw),ta=tokenSet5(a.raw),tb=tokenSet5(b.raw),j=jac5(ta,tb);
  const aa=anchor5(a.raw),ab=anchor5(b.raw),anchorSame=aa&&ab&&(aa===ab||jac5(new Set(aa.split(/\s+/)),new Set(ab.split(/\s+/)))>=0.75);
  let facts=0;if(a.tipo&&b.tipo&&a.tipo===b.tipo)facts++;if(a.municipio&&b.municipio&&a.municipio===b.municipio)facts++;if(a.zona&&b.zona&&a.zona===b.zona)facts++;
  if(nearNum5(a.m2,b.m2,Math.max(3,Math.max(a.m2||0,b.m2||0)*0.03)))facts++;if(nearNum5(a.h,b.h,0))facts++;if(nearNum5(a.b,b.b,0))facts++;if(nearNum5(a.e,b.e,0))facts++;
  const strongSparse=!!(a.zona||a.m2||ca||(a.h!=null&&a.b!=null&&a.e!=null));
  if(ia&&ia===ib&&strongSparse)return true;
  if(j>=0.86)return true;
  if(j>=0.76&&facts>=3)return true;
  if(anchorSame&&j>=0.58&&facts>=4)return true;
  return false;
}
function occurrenceCount5(p){return Math.max(1,Number(p.historyCount)||1)}
function collapseLatest5(list){
  const groups=new Map(),out=[];
  const arr=(list||[]).map(p=>strictReclassify5(p)).filter(looksListing5).sort((a,b)=>(b.ts||0)-(a.ts||0));
  for(const p of arr){
    const bucketKey=[brokerKey5(p),p.tipo||'?',p.municipio||'?'].join('|');
    let bucket=groups.get(bucketKey);if(!bucket){bucket=[];groups.set(bucketKey,bucket)}
    let g=bucket.find(x=>sameListing5(p,x.latest));
    if(!g){
      const q={...p,historyCount:occurrenceCount5(p),historySources:[p.source].filter(Boolean),historyFirstTs:p.ts||0,historyLatestTs:p.ts||0};
      g={latest:q};bucket.push(g);out.push(q);
    }else{
      const q=g.latest;
      q.historyCount=(q.historyCount||1)+occurrenceCount5(p);
      q.historySources=[...new Set([...(q.historySources||[]),...(p.historySources||[]),p.source].filter(Boolean))].slice(0,40);
      q.historyFirstTs=Math.min(q.historyFirstTs||q.ts||0,p.historyFirstTs||p.ts||0);
      q.historyLatestTs=Math.max(q.historyLatestTs||q.ts||0,p.historyLatestTs||p.ts||0);
    }
  }
  return out.sort((a,b)=>(b.ts||0)-(a.ts||0));
}

let baseProp5=null;try{baseProp5=prop}catch{}
if(baseProp5){prop=function(m,src){const p=baseProp5(m,src);if(!p)return p;p.time=m.time||p.time||'';p.ts=parseStamp5(m.date,p.time)||(p.ts||0);return strictReclassify5(p)}}

function queryIntent5(raw){
  const x=n5(raw),typeName=strictType5(x),L=strictLoc5(x);
  const sale=/\b(?:venta|vende|vendo|se\s+vende|compra)\b/.test(x),rent=/\b(?:alquiler|alquila|se\s+alquila|renta|canon)\b/.test(x);
  const op=sale&&rent?'Venta/Alquiler':sale?'Venta':rent?'Alquiler':null,features=strictFeatures5(x);
  const stop=new Set('town house townhouse tonwhouse stone home venta vende vendo compra se en alquiler alquila renta canon san diego naguanagua valencia los guayos apartamento apto casa penthouse local comercial terreno parcela oficina galpon edificio deposito pozo planta electrica piscina amoblado amueblado vigilancia financiamiento vehiculo'.split(' '));
  for(const w of features.flatMap(f=>n5(f).split(' ')))stop.add(w);
  const free=x.split(/[^a-z0-9]+/).filter(w=>w.length>2&&!stop.has(w));
  return{type:typeName,municipio:L.municipio,zona:L.zona,op,features,free};
}
function opMatch5(p,o){if(!o)return true;if(o==='?')return!p.op;if(o==='Venta')return p.op==='Venta'||(p.op==='Venta/Alquiler'&&!!p.salePrice);if(o==='Alquiler')return p.op==='Alquiler'||(p.op==='Venta/Alquiler'&&!!p.rentPrice);return p.op===o}
function priceFor5(p,o){if(o==='Venta')return p.salePrice;if(o==='Alquiler')return p.rentPrice;return p.precio}

function render5(a){
  const count=document.querySelector('#count'),results=document.querySelector('#results');
  if(count)count.textContent='('+a.length+')';if(!results)return;
  if(!a.length){results.className='empty';results.innerHTML='No encontré inventario vigente con esos criterios.';return}
  results.className='';const contextOp=searchContext5.active&&['Venta','Alquiler'].includes(searchContext5.op)?searchContext5.op:null;
  results.innerHTML=a.slice(0,300).map(p=>{
    strictReclassify5(p);
    const shownOp=contextOp||(p.op||'Operación por confirmar');
    let priceHtml;
    if(contextOp)priceHtml='<div class="price">'+c5(priceFor5(p,contextOp))+'</div>';
    else if(p.op==='Venta/Alquiler')priceHtml='<div class="price">'+(p.salePrice?'Venta '+c5(p.salePrice):'Venta —')+(p.rentPrice?'<br><small>Alquiler '+c5(p.rentPrice)+'</small>':'')+'</div>';
    else priceHtml='<div class="price">'+c5(p.precio)+'</div>';
    const L=[p.zona,p.municipio].filter(Boolean).join(' · ')||'Ubicación por confirmar';
    const F=(p.features||[]).slice(0,7).map(x=>'<span class="pill">'+e5(x)+'</span>').join('');
    const capt=e5(p.contactName||p.sender||'Emisor sin identificar'),msg=PREFIX5+'\n\n'+p.raw;
    const contact=p.phone?'<button class="primary wa" data-phone="'+e5(p.phone)+'" data-msg="'+e5(msg)+'">Contactar captador por WhatsApp</button><div class="hint">'+e5(p.contactSource)+'</div>':'<button class="wa" disabled style="opacity:.58">Captador sin teléfono vinculado</button><div class="hint">Emisor: '+e5(p.sender||'sin identificar')+'. No detecté un número móvil en esta publicación; luego podrás vincularlo con tus contactos VCF.</div>';
    const hist=(p.historyCount||1)>1?'<div class="hint" style="margin:7px 0 2px"><b>'+e5(p.historyCount)+' publicaciones agrupadas</b> · mostrando únicamente la más reciente'+((p.historySources||[]).length>1?' · '+e5(p.historySources.length)+' grupos detectados':'')+'</div>':'';
    return'<article class="card"><div class="head"><div><div><span class="pill">'+e5(shownOp)+'</span>'+(p.tipo?'<span class="pill">'+e5(p.tipo)+'</span>':'')+'</div><div class="loc">'+e5(L)+'</div><div class="sender"><b>Captador:</b> '+capt+'</div></div><div>'+priceHtml+'<div class="age">'+(p.age===0?'hoy':p.age===1?'hace 1 día':Number.isFinite(p.age)?'hace '+p.age+' días':'')+'</div></div></div><div class="specs"><div class="spec"><b>'+e5(p.m2??'—')+'</b><span>m²</span></div><div class="spec"><b>'+e5(p.h??'—')+'</b><span>HAB</span></div><div class="spec"><b>'+e5(p.b??'—')+'</b><span>BAÑOS</span></div><div class="spec"><b>'+e5(p.e??'—')+'</b><span>PUESTOS</span></div></div><div class="features">'+F+'</div>'+hist+contact+'<details><summary>Mensaje original</summary><pre>'+e5(p.raw)+'</pre></details></article>';
  }).join('');
  document.querySelectorAll('[data-phone]').forEach(b=>b.onclick=()=>location.href='https://wa.me/'+b.dataset.phone.replace(/\D/g,'')+'?text='+encodeURIComponent(b.dataset.msg));
}
try{render=render5}catch{}

function search5(){
  props=collapseLatest5(props||[]);
  const I=queryIntent5(document.querySelector('#q')?.value||''),pm=+(document.querySelector('#pmax')?.value||0),hm=+(document.querySelector('#hmin')?.value||0),bm=+(document.querySelector('#bmin')?.value||0),em=+(document.querySelector('#emin')?.value||0),mm=+(document.querySelector('#mmin')?.value||0);
  const o=(document.querySelector('#op')?.value||I.op||''),m=(document.querySelector('#municipio')?.value||I.municipio||''),z=(document.querySelector('#zona')?.value||I.zona||''),t=(document.querySelector('#tipo')?.value||I.type||''),fs=[...new Set([document.querySelector('#ft')?.value,...I.features].filter(Boolean))];
  searchContext5={active:true,op:o||null};
  const a=(props||[]).filter(p=>{
    strictReclassify5(p);
    if(m&&p.municipio!==m)return false;if(z&&p.zona!==z)return false;if(t&&p.tipo!==t)return false;if(!opMatch5(p,o))return false;
    const pv=priceFor5(p,o);if(pm&&(!pv||pv>pm))return false;if(hm&&(p.h==null||p.h<hm))return false;if(bm&&(p.b==null||p.b<bm))return false;if(em&&(p.e==null||p.e<em))return false;if(mm&&(p.m2==null||p.m2<mm))return false;
    if(fs.some(f=>!(p.features||[]).includes(f)))return false;
    const hay=n5([p.tipo,p.op,p.municipio,p.zona,p.raw,(p.features||[]).join(' ')].join(' '));return I.free.every(w=>hay.includes(w));
  }).sort((a,b)=>(b.ts||0)-(a.ts||0));
  render5(a);
}
try{search=search5}catch{}

async function persistCollapsed5(){
  props=collapseLatest5(props||[]);
  try{if(typeof clearStore==='function'&&typeof puts==='function'&&db){await clearStore('properties');if(props.length)await puts('properties',props)}}catch(e){console.warn('V5 persist',e)}
  try{if(typeof filters==='function')filters()}catch{}
  try{if(typeof stat==='function')stat()}catch{}
  return props;
}
async function apply5(){
  if(window.__BI_ENGINE){return}
  try{
    if(typeof props==='undefined'||!Array.isArray(props)||typeof db==='undefined'){setTimeout(apply5,500);return}
    const repaired=[];
    for(const p of props||[]){
      const segs=splitText5(p.raw,{date:p.date,time:p.time||'',sender:p.sender});
      for(const seg of segs){
        const raw=String(seg.text||'').trim();if(!raw)continue;
        const q={...p,id:'v5-'+h5(n5(seg.sender||p.sender)+'|'+n5(raw)+'|'+(seg.date||p.date)+'|'+(seg.time||'')),date:seg.date||p.date,time:seg.time||p.time||'',sender:seg.sender||p.sender,raw};
        q.ts=parseStamp5(q.date,q.time)||(p.ts||0);strictReclassify5(q);if(looksListing5(q))repaired.push(q);
      }
    }
    props=collapseLatest5(repaired);
    await persistCollapsed5();

    const sb=document.querySelector('#searchBtn');if(sb)sb.onclick=search5;
    document.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>{const s=document.querySelector('#op');if(s)s.value=b.dataset.op;search5()});
    document.querySelectorAll('[data-ft]').forEach(b=>b.onclick=()=>{const s=document.querySelector('#ft');if(s)s.value=b.dataset.ft;search5()});
    const reset=document.querySelector('#reset');if(reset)reset.onclick=()=>{for(const id of['q','pmax','hmin','bmin','emin','mmin']){const x=document.querySelector('#'+id);if(x)x.value=''}for(const id of['municipio','zona','tipo','op','ft']){const x=document.querySelector('#'+id);if(x)x.value=''}searchContext5={active:false,op:null};render5(props)};
    const q=document.querySelector('#q');if(q&&!q.dataset.v5){q.dataset.v5='1';q.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search5()}})}
    const processBtn=document.querySelector('#process');
    if(processBtn&&!processBtn.dataset.v5){
      processBtn.dataset.v5='1';const old=processBtn.onclick;
      processBtn.onclick=async function(ev){
        const r=old?old.call(this,ev):null;try{await Promise.resolve(r)}catch{}
        await new Promise(res=>setTimeout(res,80));await persistCollapsed5();searchContext5={active:false,op:null};render5(props);
        const st=document.querySelector('#status');if(st)st.textContent+=' · Inventario único V5: '+props.length+' propiedades; repeticiones del mismo corredor agrupadas.';
      };
    }
    searchContext5={active:false,op:null};render5(props);
    const st=document.querySelector('#status');if(st)st.textContent='Motor V5 activo · inventario único por corredor/inmueble · última publicación vigente · teléfonos de la descripción detectados.';
  }catch(e){console.error('patch-v5',e)}
}
function wait5(){if(typeof props==='undefined'||typeof db==='undefined'){setTimeout(wait5,400);return}setTimeout(apply5,900)}
wait5();
})();
