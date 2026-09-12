(()=>{
'use strict';
const ENGINE6='V6.0';
const PREFIX6='hola Colega me envías esta opción por favor';

function n6(x){return String(x||'').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u202f|\u00a0/g,' ').replace(/\s+/g,' ').trim()}
function e6(x){return String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function cash6(v){return v?'$'+new Intl.NumberFormat('es-VE').format(v):'—'}
function raw6(p){return String((p&&((p.raw??p.text)??p.message))||'')}

const TYPE6=[
 ['Casa comercial',/\bcasa\s+comercial\b/],['Local comercial',/\b(?:local\s+comercial|local\s+en\s+(?:venta|alquiler))\b/],
 ['Penthouse',/\b(?:pent\s*[- ]?house|penthouse|p\.?h\.?)\b/],
 ['Townhouse',/\b(?:town\s*[- ]?house|townhouse|tonwhouse|towhouse|townhause|townhome|town\s*home|stone\s*house|t\.?h\.?)\b/],
 ['Apartamento',/\b(?:apartamento|apto\.?)\b/],['Galpón',/\b(?:galpon|nave\s+industrial)\b/],['Oficina',/\boficina\b/],
 ['Edificio',/\bedificio\b/],['Depósito',/\bdeposito\b/],['Terreno',/\bterreno\b/],['Parcela',/\bparcela\b/],['Casa',/\b(?:casa|quinta)\b/],['Local comercial',/\blocal\b/]
];
function type6(p){const x=n6(raw6(p));for(const[t,r]of TYPE6)if(r.test(x))return t;return p?.tipo||p?.property_type||null}

const LOC6={
 Naguanagua:{'Mañongo':['mañongo','manongo'],'La Granja':['la granja'],Tazajal:['tazajal'],'Piedra Pintada':['piedra pintada']},
 'San Diego':{'Valle de Oro':['valle de oro'],'La Esmeralda':['la esmeralda','altos de la esmeralda','altos de esmeralda'],'Los Faroles':['los faroles'],'La Cumaca':['la cumaca','cumaca'],'Pueblo Viejo':['pueblo viejo'],'Valles del Nogal':['valles del nogal','valle del nogal'],'Paso Real':['paso real'],'El Remanso':['el remanso'],Montemayor:['montemayor'],'Lomas de la Hacienda':['lomas de la hacienda'],Tulipán:['tulipan'],'Terrazas de San Diego':['terrazas de san diego'],'Villas del Campo':['villas del campo'],'Los Frailes':['los frailes'],Amazonia:['amazonia'],'El Polvero':['el polvero'],'La Fuente':['la fuente'],'Villas Paraíso Country':['villas paraiso country'],'Aves del Paraíso':['aves del paraiso'],'Villa Vajegreda':['villa vajegreda','vajegreda'],Yuma:['yuma'],'Villas de Santa Cruz':['villas de santa cruz'],'Las Morochas':['las morochas']},
 Valencia:{'La Trigaleña':['la trigaleña','trigaleña'],'El Trigal':['el trigal','trigal norte','trigal sur','trigal centro'],'El Bosque':['el bosque'],'Las Chimeneas':['las chimeneas','chimeneas'],Prebo:['prebo'],'La Viña':['la viña','la vina'],'El Parral':['el parral'],'Agua Blanca':['agua blanca'],'Campo Alegre':['campo alegre'],'Los Mangos':['los mangos'],Guaparo:['guaparo'],'Valles de Camoruco':['valles de camoruco'],'Sabana Larga':['sabana larga'],'Valle Blanco':['valle blanco'],'Altos de Guataparo':['altos de guataparo'],'La Guacamaya':['la guacamaya']},
 'Los Guayos':{'Los Guayos':['los guayos'],Paraparal:['paraparal']}
};
function loc6(p){const x=n6(raw6(p));for(const[mun,zs]of Object.entries(LOC6))for(const[z,aa]of Object.entries(zs))if(aa.some(a=>x.includes(n6(a))))return{municipio:mun,zona:z};const bares=[['san\\s+diego','San Diego'],['naguanagua','Naguanagua'],['los\\s+guayos','Los Guayos'],['valencia','Valencia']];let best=null,bestIdx=-1;for(const[needle,label]of bares){const m=new RegExp('\\b'+needle+'\\b').exec(x);if(m&&m.index>bestIdx){bestIdx=m.index;best=label}}if(best)return{municipio:best,zona:p?.zona||null};return{municipio:p?.municipio||p?.municipality||null,zona:p?.zona||p?.zone||null}}
function request6(p){const x=n6(raw6(p)),h=x.slice(0,1000);if(/^\W*(?:solicitud|solicito|busco|se busca|cliente busca|requiero|necesito)\b/.test(h))return true;const req=/\b(?:solicitud|solicito|solicita|se solicita|busco|se busca|cliente busca|requiero|requiere|necesito|buscando|busqueda|presupuesto hasta|para la compra|mi cliente quiere|conjuntos de interes)\b/.test(h),listing=/\b(?:se vende|vendo|vende|en venta|se alquila|alquilo|en alquiler|disponible|nueva captacion|ofrece en venta|ofrece en alquiler)\b/.test(h);return req&&!listing}
function op6(p){const x=n6(raw6(p));const sale=/\b(?:se\s+vende|vende|vendo|venta|en\s+venta|precio\s+de\s+venta|venta\s+privada|ofrece\s+en\s+venta)\b/.test(x),rent=/\b(?:se\s+alquila|alquila|alquiler|en\s+alquiler|arrendamiento|renta|canon)\b/.test(x);if(sale&&rent)return'Venta/Alquiler';if(rent)return'Alquiler';if(sale)return'Venta';return p?.op||p?.operation||null}

function phones6(s){const out=[],re=/(?:\+?58[\s().\-]{0,3})?0?(?:412|414|416|424|426)(?:[\s().\-]{0,3}\d){7}/g;let m;while((m=re.exec(String(s||'')))){let d=m[0].replace(/\D/g,'');if(d.startsWith('58'))d=d.slice(2);if(d.startsWith('0'))d=d.slice(1);if(d.length===10&&/^(412|414|416|424|426)/.test(d))out.push('+58'+d)}return[...new Set(out)]}
function cleanPerson6(s){let x=String(s||'').replace(/(?:\+?58[\s().\-]{0,3})?0?(?:412|414|416|424|426)(?:[\s().\-]{0,3}\d){7}/g,' ').replace(/[*_~•📲📞☎️👉➡️✅🔹🔸]/g,' ');x=x.replace(/\b(?:tlf|tel[eé]fono|telefono|celular|whatsapp|contacto|contacta|asesor(?:a)?|inmobiliari[oa]|licda?|lic|econ|realtor)\b[:.\s-]*/gi,' ');return x.replace(/[^\p{L}\s.'-]/gu,' ').replace(/\s+/g,' ').trim()}
function person6(s){const x=cleanPerson6(s),w=x.split(/\s+/).filter(Boolean);if(w.length<2||w.length>6)return null;if(/\b(?:precio|canon|venta|alquiler|casa|town|apartamento|terreno|parcela|habitacion|bano|puesto|pozo|planta|residencia|conjunto|urbanizacion|inversion|ref|codigo|cod|metros|mts|privilege|remax|imagen|video|audio|sticker|gif|multimedia|documento|omitida|omitido|eliminado|eliminaste|editado|contactame|contactanos|contactar|contactenos|contacto|llamar|llame|comunicarse|comuniquese|escribir|escribeme|informacion|whatsapp|inbox|mensaje)\b/i.test(n6(x)))return null;return x}
function senderTokens6(s){return n6(s).replace(/\b(?:colega|asesor|asesora|inmobiliario|inmobiliaria|remax)\b/g,' ').replace(/[^a-z0-9ñ\s]/g,' ').split(/\s+/).filter(w=>w.length>=4)}
function nameKey6(s){return n6(s).replace(/\b(?:colega|asesor|asesora|inmobiliario|inmobiliaria|remax)\b/g,' ').replace(/[^a-z0-9ñ]/g,'')}
function captorDirect6(p){
 const raw=raw6(p),lines=raw.split(/\n/),st=senderTokens6(p?.sender||''),cand=[];
 for(let i=0;i<lines.length;i++){
  const phs=phones6(lines[i]);if(!phs.length)continue;
  const around=[lines[i-2]||'',lines[i-1]||'',lines[i],lines[i+1]||''].join(' '),near=n6(around);
  const names=[person6(lines[i]),person6(lines[i-1]||''),person6(lines[i-2]||''),person6(lines[i+1]||'')].filter(Boolean);
  for(const ph of phs){let score=20;if(/asesor|asesora|contact|whatsapp|tlf|telefono|celular|licda|lic\b|econ|realtor|inmobiliaria/i.test(around))score+=220;if(names.length)score+=90;if(st.some(t=>near.includes(t)))score+=140;score+=Math.round((i/Math.max(1,lines.length-1))*100);cand.push({phone:ph,name:names[0]||null,score,index:i})}
 }
 const senderPh=phones6(p?.sender||'');if(senderPh.length)cand.push({phone:senderPh[0],name:cleanPerson6(p.sender)||p.sender,score:240,index:-1});
 if(cand.length){cand.sort((a,b)=>b.score-a.score||b.index-a.index);const c=cand[0];return{phone:c.phone,name:c.name||p?.contactName||cleanPerson6(p?.sender)||p?.sender||'Captador',source:'número publicado por el captador'}}
 if(p?.phone)return{phone:p.phone,name:p?.contactName||p?.sender||'Captador',source:p?.contactSource||'contacto vinculado'};
 return{phone:null,name:p?.contactName||cleanPerson6(p?.sender)||p?.sender||'Captador por confirmar',source:'sin teléfono vinculado'};
}

let DIR6={forProps:null,map:null};
function captorDirectory6(){
 if(DIR6.forProps===props&&DIR6.map)return DIR6.map;
 const m=new Map();
 for(const p of(Array.isArray(props)?props:[])){
  const d=captorDirect6(p);if(!d.phone)continue;
  const key=nameKey6(d.name||p?.sender||'');if(!key||key.length<4)continue;
  const cur=m.get(key),strong=d.source==='número publicado por el captador';
  if(!cur||(strong&&cur.source!=='número publicado por el captador'))m.set(key,{phone:d.phone,name:d.name,source:d.source})
 }
 DIR6.forProps=props;DIR6.map=m;return m
}
let CDIR6={forContacts:null,map:null};
function contactDirectory6(){
 if(CDIR6.forContacts===contacts&&CDIR6.map)return CDIR6.map;
 const m=new Map();
 for(const c of(Array.isArray(contacts)?contacts:[])){
  const key=nameKey6(c.name||'');if(!key||key.length<4)continue;
  if(!m.has(key))m.set(key,c.phone)
 }
 CDIR6.forContacts=contacts;CDIR6.map=m;return m
}
function captor6(p){
 const d=captorDirect6(p);
 if(d.phone)return d;
 const key=nameKey6(d.name||p?.sender||'');
 if(key&&key.length>=4){
  const hit=captorDirectory6().get(key);
  if(hit)return{phone:hit.phone,name:d.name||hit.name,source:'teléfono visto en otra publicación del mismo captador'}
  const cphone=contactDirectory6().get(key);
  if(cphone)return{phone:cphone,name:d.name,source:'contacto vinculado (VCF)'}
 }
 return d
}
function num6(v){const n=Number(v);return Number.isFinite(n)?n:null}
function stats6(p){return{m2:num6(p?.m2??p?.area),h:num6(p?.h??p?.bedrooms),b:num6(p?.b??p?.bathrooms),e:num6(p?.e??p?.parking)}}
function ts6(p){if(Number.isFinite(+p?.ts)&&+p.ts>0)return+p.ts;const s=String(p?.date||''),m=s.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);if(!m)return 0;let a=+m[1],b=+m[2],y=+m[3];if(y<100)y+=2000;let day,month;if(a>12&&b<=12){day=a;month=b}else if(b>12&&a<=12){day=b;month=a}else{day=a;month=b}return new Date(y,month-1,day,12).getTime()}
function source6(p){return String(p?.source||p?.group||p?.file||'grupo').split('/')[0].trim()||'grupo'}
const STOP6=new Set('se la el en de del y con para por una un los las que su sus esta este es son vende venta alquiler precio inversion ref referencia oportunidad nueva captacion inmueble propiedad casa townhouse town house san diego carabobo disponible negociable metros mts mt m2 habitaciones habitacion banos baño bano puestos puesto estacionamiento codigo cod imagen omitida asesor asesora colega inmobiliaria inmobiliario'.split(/\s+/));
function tokens6(p){let x=n6(raw6(p));x=x.replace(/https?:\/\/\S+/g,' ').replace(/(?:\+?58[\s().\-]{0,3})?0?(?:412|414|416|424|426)(?:[\s().\-]{0,3}\d){7}/g,' ').replace(/\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/g,' ').replace(/\b\d+(?:[.,]\d+)?\b/g,' ').replace(/[^a-zñ\s]/g,' ');return new Set(x.split(/\s+/).filter(w=>w.length>=4&&!STOP6.has(w)))}
function jac6(a,b){if(!a.size||!b.size)return 0;let n=0;for(const x of a)if(b.has(x))n++;return n/(a.size+b.size-n)}
function project6(p){const x=n6(raw6(p));const r=/(?:res(?:idencias?|\.)?|conjunto(?:\s+residencial)?|condominio|urb(?:anizacion|\.)?|edificio|villa(?:s)?|residencial)\s+(?:exclusivo\s+|cerrado\s+)?([a-z0-9ñ ]{3,45})/g;let m,best='';while((m=r.exec(x))){let z=m[1].replace(/\b(?:ubicado|ubicada|en|san diego|valencia|edo|carabobo|cuenta|consta|con|venta|alquiler|moderno|moderna|amplio|amplia|hermoso|hermosa|bonito|bonita|lujoso|lujosa|comodo|comoda|espectacular)\b.*$/,'').replace(/\d.*$/,'').trim();const w0=z.split(/\s+/)[0]||'';if(!z||/^(?:y|que|con|sin|para|por|cuenta|cuentan|cuentas|tiene|tienen|ofrece|dispone|disponen|consta|zonas|ubicado|ubicada|ubicacion)$/.test(w0))continue;if(z.length>best.length)best=z}return best}
function capKey6(p){const c=captor6(p);if(c.phone)return'ph:'+c.phone;const nm=n6(c.name||p?.sender||'').replace(/\b(?:colega|asesor|asesora|inmobiliario|inmobiliaria)\b/g,' ').replace(/[^a-z0-9ñ]/g,'');return'nm:'+nm}
const D6=new WeakMap();
function d6(p){
 let d=D6.get(p);if(d)return d;
 const C=captor6(p),nm=n6(C.name||p?.sender||'').replace(/\b(?:colega|asesor|asesora|inmobiliario|inmobiliaria)\b/g,' ').replace(/[^a-z0-9ñ]/g,'');
 const capKey=C.phone?('ph:'+C.phone):(nm?('nm:'+nm):('uniq:'+(p?.id||n6(raw6(p)).slice(0,140))));
 d={type:type6(p),loc:loc6(p),captor:C,capKey,stats:stats6(p),tokens:tokens6(p),project:n6(project6(p)),op:op6(p)};
 D6.set(p,d);return d
}
function sameListing6(a,b){
 const da=d6(a),db=d6(b);
 if(da.capKey!==db.capKey)return false;if(da.type!==db.type)return false;if(da.loc.municipio&&db.loc.municipio&&da.loc.municipio!==db.loc.municipio)return false;
 const sa=da.stats,sb=db.stats,za=n6(da.loc.zona||''),zb=n6(db.loc.zona||''),pa=da.project,pb=db.project;
 const sameProject=pa&&pb&&(pa===pb||pa.includes(pb)||pb.includes(pa)),diffProject=pa&&pb&&!sameProject;
 if(diffProject)return false;
 const area=sa.m2&&sb.m2&&Math.abs(sa.m2-sb.m2)<=Math.max(2,Math.min(sa.m2,sb.m2)*.015);const beds=sa.h!=null&&sb.h!=null&&sa.h===sb.h,baths=sa.b!=null&&sb.b!=null&&sa.b===sb.b,parks=sa.e!=null&&sb.e!=null&&sa.e===sb.e;
 const j=jac6(da.tokens,db.tokens);
 if(sameProject&&j>=.30)return true;
 if(za&&zb&&za===zb&&area&&(beds||baths)&&j>=.30)return true;
 if(area&&beds&&baths&&(parks||j>=.42))return true;
 if(j>=.70)return true;
 return false;
}
function dedupe6(arr){
 const sorted=[...arr].sort((a,b)=>ts6(b)-ts6(a)),buckets=new Map();
 for(const p of sorted){
  const key=d6(p).capKey;let bucket=buckets.get(key);if(!bucket){bucket=[];buckets.set(key,bucket)}
  let w=bucket.find(x=>sameListing6(x,p));
  if(!w){p._historyCount=1;p._groupSet6=new Set([source6(p)]);p._firstSeen6=ts6(p);p._lastSeen6=ts6(p);bucket.push(p)}
  else{w._historyCount=(w._historyCount||1)+1;w._groupSet6=w._groupSet6||new Set([source6(w)]);w._groupSet6.add(source6(p));w._firstSeen6=Math.min(w._firstSeen6||ts6(w),ts6(p));w._lastSeen6=Math.max(w._lastSeen6||ts6(w),ts6(p))}
 }
 const wins=[];for(const bucket of buckets.values())wins.push(...bucket);
 for(const w of wins)w._groupCount=w._groupSet6?.size||1;
 return wins
}

function intent6(q){const x=n6(q);let t=null;for(const[v,r]of TYPE6)if(r.test(x)){t=v;break}let mun=null,z=null;for(const[m,zs]of Object.entries(LOC6)){for(const[zz,aa]of Object.entries(zs))if(aa.some(a=>x.includes(n6(a)))){mun=m;z=zz;break}if(mun)break}if(!mun){if(/\bsan\s+diego\b/.test(x))mun='San Diego';else if(/\bnaguanagua\b/.test(x))mun='Naguanagua';else if(/\blos\s+guayos\b/.test(x))mun='Los Guayos';else if(/\bvalencia\b/.test(x))mun='Valencia'}let op=null;if(/\b(?:venta|vendo|vende|comprar|compra)\b/.test(x))op='Venta';else if(/\b(?:alquiler|alquilo|alquila|renta|canon)\b/.test(x))op='Alquiler';const free=x.split(/[^a-z0-9ñ]+/).filter(w=>w.length>2);return{type:t,municipio:mun,zona:z,op,free}}
function priceFor6(p,op){const got=d6(p).op;if(op==='Venta')return num6(p?.precioVenta??p?.salePrice??(got==='Venta'?p?.precio:null));if(op==='Alquiler')return num6(p?.precioAlquiler??p?.rentPrice??(got==='Alquiler'?p?.precio:null));return num6(p?.precio??p?.precioVenta??p?.precioAlquiler)}
function eligibleOp6(p,want){const got=d6(p).op;if(!want)return true;if(want==='Venta')return got==='Venta'||got==='Venta/Alquiler';if(want==='Alquiler')return got==='Alquiler'||got==='Venta/Alquiler';return got===want}
function features6(p){return Array.isArray(p?.features)?p.features:[]}

function search6(){
 const q=document.querySelector('#q')?.value||'',it=intent6(q),uiMun=document.querySelector('#municipio')?.value||'',uiZ=document.querySelector('#zona')?.value||'',uiT=document.querySelector('#tipo')?.value||'',uiOp=document.querySelector('#op')?.value||'',wantOp=uiOp&&uiOp!=='?'?uiOp:it.op;
 const pm=+(document.querySelector('#pmax')?.value||0),hm=+(document.querySelector('#hmin')?.value||0),bm=+(document.querySelector('#bmin')?.value||0),em=+(document.querySelector('#emin')?.value||0),mm=+(document.querySelector('#mmin')?.value||0),ft=document.querySelector('#ft')?.value||'';
 const wantMun=uiMun||it.municipio,wantZ=uiZ||it.zona,wantT=uiT||it.type;
 let a=(Array.isArray(props)?props:[]).filter(p=>{if(request6(p))return false;const D=d6(p),L=D.loc,T=D.type,S=D.stats;if(wantMun&&L.municipio!==wantMun)return false;if(wantZ&&L.zona!==wantZ)return false;if(wantT&&T!==wantT)return false;if(uiOp==='?'&&D.op)return false;if(!eligibleOp6(p,wantOp))return false;const pr=priceFor6(p,wantOp);if(pm&&(!pr||pr>pm))return false;if(hm&&(S.h==null||S.h<hm))return false;if(bm&&(S.b==null||S.b<bm))return false;if(em&&(S.e==null||S.e<em))return false;if(mm&&(S.m2==null||S.m2<mm))return false;if(ft&&!features6(p).includes(ft))return false;if(it.free.length){const hay=n6([raw6(p),T,L.municipio,L.zona,D.captor.name,features6(p).join(' ')].join(' '));if(!it.free.every(w=>hay.includes(w)))return false}return true});
 a=dedupe6(a).sort((x,y)=>ts6(y)-ts6(x));render6(a,wantOp);document.querySelector('#resultados')?.scrollIntoView({behavior:'smooth'});
}
function ageLabel6(p){const t=ts6(p);if(!t)return'';const d=Math.max(0,Math.floor((Date.now()-t)/86400000));return d===0?'hoy':d===1?'hace 1 día':'hace '+d+' días'}
function wa6(p,c){if(!c.phone)return null;return'https://wa.me/'+c.phone.replace(/\D/g,'')+'?text='+encodeURIComponent(PREFIX6+'\n\n'+raw6(p))}
function opLabel6(p,want){if(want==='Venta')return'Venta';if(want==='Alquiler')return'Alquiler';return d6(p).op||'Operación por confirmar'}
function priceLabel6(p,want){if(want==='Venta')return cash6(priceFor6(p,'Venta'));if(want==='Alquiler')return cash6(priceFor6(p,'Alquiler'));const o=d6(p).op;if(o==='Venta/Alquiler'){const v=priceFor6(p,'Venta'),a=priceFor6(p,'Alquiler');return[(v?'Venta '+cash6(v):''),(a?'Alquiler '+cash6(a):'')].filter(Boolean).join('<br>')||'—'}return cash6(priceFor6(p,o))}
function render6(a,wantOp){
 const root=document.querySelector('#results'),count=document.querySelector('#count');if(count)count.textContent='('+a.length+')';if(!root)return;if(!a.length){root.className='empty';root.textContent='No encontré inventario vigente con esos criterios.';return}root.className='';
 root.innerHTML=a.slice(0,300).map(p=>{const D=d6(p),L=D.loc,T=D.type,S=D.stats,C=D.captor,wa=wa6(p,C);
  const projRaw=D.project?D.project.split(/\s+/).slice(0,4).join(' '):'',proj=projRaw?projRaw.replace(/\b\w/g,c=>c.toUpperCase()):'',locParts=[L.municipio,L.zona].filter(Boolean);if(proj&&n6(proj)!==n6(L.zona||'')&&n6(proj)!==n6(L.municipio||''))locParts.push(proj);const loc=locParts.join(' · ')||'Ubicación por confirmar';
  const hist=(p._historyCount||1)>1?'<div class="hint" style="margin-top:7px">Última publicación · publicado '+p._historyCount+' veces en '+(p._groupCount||1)+' grupo'+((p._groupCount||1)===1?'':'s')+'</div>':'';
  const STAGE6=['obra gris','obra blanca','a estrenar'],allF=features6(p),stage=allF.filter(x=>STAGE6.includes(x)),rest=allF.filter(x=>!STAGE6.includes(x));
  const stageBadges=stage.map(x=>'<span class="pill" style="background:#fef3c7;border-color:#f59e0b;color:#92400e;font-weight:700">'+e6(x.replace(/\b\w/g,c=>c.toUpperCase()))+'</span>').join('');
  const f=rest.slice(0,7).map(x=>'<span class="pill">'+e6(x)+'</span>').join('');
  const contact=wa?'<button class="primary wa" data-wa6="'+e6(wa)+'">Contactar captador por WhatsApp</button><div class="hint">'+e6(C.source)+'</div>':'<button class="wa" disabled>Captador sin teléfono vinculado</button><div class="hint">Captador: '+e6(C.name)+'</div>';
 return'<article class="card"><div class="head"><div><div><span class="pill">'+e6(opLabel6(p,wantOp))+'</span>'+(T?'<span class="pill">'+e6(T)+'</span>':'')+stageBadges+'</div><div class="loc">'+e6(loc)+'</div><div class="sender"><b>Captador:</b> '+e6(C.name)+'</div></div><div><div class="price">'+priceLabel6(p,wantOp)+'</div><div class="age">'+e6(ageLabel6(p))+'</div></div></div><div class="specs"><div class="spec"><b>'+e6(S.m2??'—')+'</b><span>m²</span></div><div class="spec"><b>'+e6(S.h??'—')+'</b><span>HAB</span></div><div class="spec"><b>'+e6(S.b??'—')+'</b><span>BAÑOS</span></div><div class="spec"><b>'+e6(S.e??'—')+'</b><span>PUESTOS</span></div></div><div class="features">'+f+'</div>'+hist+contact+'<details><summary>Mensaje original</summary><pre>'+e6(raw6(p))+'</pre></details></article>'}).join('');
 root.querySelectorAll('[data-wa6]').forEach(b=>b.onclick=()=>{location.href=b.getAttribute('data-wa6')});
}
function bind6(){
 const sb=document.querySelector('#searchBtn');if(sb)sb.onclick=search6;document.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>{const o=document.querySelector('#op');if(o)o.value=b.dataset.op||'';search6()});document.querySelectorAll('[data-ft]').forEach(b=>b.onclick=()=>{const f=document.querySelector('#ft');if(f)f.value=b.dataset.ft||'';search6()});
 const q6=document.querySelector('#q');if(q6&&!q6.dataset.v6){q6.dataset.v6='1';q6.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search6()}})}
 try{search=search6}catch{}try{render=(a)=>render6(dedupe6((a||[]).filter(p=>!request6(p))),null)}catch{}
 if(Array.isArray(props)&&props.length)render6(dedupe6(props.filter(p=>!request6(p))),null);
 const st=document.querySelector('#status');if(st&&st.textContent&&!st.textContent.includes('V6'))st.textContent=st.textContent+' · Motor V6 activo';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind6,350));else setTimeout(bind6,350);
window.__BI_ENGINE='V6.0';
})();