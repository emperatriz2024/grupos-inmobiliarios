(() => {
'use strict';
// ============================================================
// RADAR INMOBILIARIO -- FASE 1: DEMAND TWIN
// Módulo completamente aparte del motor de importar/buscar (V2/V5/V6).
// Lee de `props` (variable global ya existente) y de las funciones
// puente expuestas en window.RI6. No modifica NADA de lo existente.
// Si window.RI6 no está disponible (V6 no cargó por algún motivo),
// este módulo simplemente no hace nada -- nunca rompe el resto de la app.
// ============================================================

function n7(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim()}

function money7(s){
  let x=String(s||'').replace(/\s/g,'').replace(/[^\d.,]/g,'');if(!x)return null;
  const dots=(x.match(/\./g)||[]).length,commas=(x.match(/,/g)||[]).length;
  if(!dots&&!commas)return +x;
  if((dots>1&&!commas)||(commas>1&&!dots))return +x.replace(/[.,]/g,'');
  if(dots&&commas){const i=Math.max(x.lastIndexOf('.'),x.lastIndexOf(',')),aft=x.length-i-1;if(aft<=2)return +(x.slice(0,i).replace(/[.,]/g,'')+'.'+x.slice(i+1));return +x.replace(/[.,]/g,'')}
  const sep=dots?'.':',',parts=x.split(sep),aft=parts.at(-1).length;
  if(aft===3)return +parts.join('');if(aft<=2)return +(parts.slice(0,-1).join('')+'.'+parts.at(-1));return +parts.join('')
}
function amount7(token,suffix){let v=money7(token),s=n7(suffix);if(!v)return null;if(s==='k'||s==='mil')v*=1000;else if(/^millon/.test(s))v*=1000000;return v}

function m2Range7(raw){
  const x=n7(raw);
  let m=x.match(/(\d{2,4})\s*(?:[-–]|\ba\b)\s*(\d{2,4})\s*m(?:2|²|ts2?|etros)/);
  if(m)return{min:+m[1],max:+m[2]};
  m=x.match(/minimo\s*(?:evaluable)?\s*[:.]?\s*(\d{2,4})\s*m(?:2|²|ts2?)/);
  if(m)return{min:+m[1],max:null};
  m=x.match(/(\d{2,4})\s*m(?:2|²|ts2?|etros)/);
  if(m)return{min:null,max:+m[1]};
  return{min:null,max:null}
}
function zonasInteres7(raw){
  const lines=String(raw||'').split(/\r?\n/);
  const idx=lines.findIndex(l=>/zonas?\s+de\s+inter[eé]s/i.test(l));
  if(idx<0)return null;
  const out=[];
  for(let i=idx+1;i<lines.length&&i<idx+6;i++){
    const l=lines[i].trim();
    if(!l)break;
    if(/^(?:📐|🚗|💰|requerimientos|metraje|canon|precio)/i.test(l))break;
    out.push(l.replace(/^[✅•\-*]\s*/,''))
  }
  return out.length?out.join('; '):null
}

const A7='(\\d{1,3}(?:[.,]\\d{3})+|\\d{1,8}(?:[.,]\\d{1,2})?)\\s*(k|mil|mill[oó]n(?:es)?)?';
function budgetFor7(raw){
  const x=n7(raw);
  const defs=[
    new RegExp('(?:tope(?:\\s+de)?(?:\\s+inversion)?|presupuesto(?:\\s+hasta)?|maximo|max\\.?|no\\s+exceda(?:\\s+de)?|hasta(?:\\s+un\\s+maximo\\s+de)?|hasta)\\s*[:.]?\\s*(?:usd|us\\$|\\$)?\\s*'+A7,'gi'),
    new RegExp('(?:usd|us\\$|\\$)\\s*'+A7,'gi'),
    new RegExp(A7+'\\s*(?:usd|d[oó]lares?|\\$)','gi')
  ];
  for(const re of defs){let m;while((m=re.exec(x))){const v=amount7(m[1],m[2]);if(v&&v>=1000&&v<=5000000)return v}}
  return null
}

function demandExtract7(p){
  const R=window.RI6;if(!R)return null;
  return{tipo:R.type6(p),tiposAll:R.typesAll6?R.typesAll6(p):[R.type6(p)].filter(Boolean),loc:R.loc6(p),municipiosAll:R.municipiosAll6?R.municipiosAll6(p):[R.loc6(p).municipio].filter(Boolean),op:R.op6(p),budget:budgetFor7(R.raw6(p)),captor:R.captor6(p),raw:R.raw6(p)}
}

// Una solicitud se considera vigente solo si tiene 7 días o menos (después de eso, se asume
// que probablemente ya se resolvió o el colega dejó de buscarla activamente).
function freshRequest7(p,R,days){
  const t=R.ts6(p);
  if(!t)return true;
  const ageDays=(Date.now()-t)/86400000;
  return ageDays<=days
}

// Agrupa el inventario a usar por tipo+municipio. Si hay algo cargado en "Mi Inventario",
// se usa ESO exclusivamente (es lo que Empi realmente representa); si no, se usa todo el
// inventario general ya importado y deduplicado, como antes.
function buildInventoryBuckets7(R,opts){
  const useMio=!(opts&&opts.forceGeneral)&&Array.isArray(window.misInmuebles)&&window.misInmuebles.length;
  const source=useMio?window.misInmuebles:R.dedupe6((Array.isArray(props)?props:[]).filter(p=>!R.request6(p)));
  const buckets=new Map();
  for(const it of source){
    const tipos=R.typesAll6?R.typesAll6(it):[R.type6(it)].filter(Boolean);
    const muns=R.municipiosAll6?R.municipiosAll6(it):[R.loc6(it).municipio].filter(Boolean);
    const keys=new Set();
    for(const t of tipos)for(const m of muns)keys.add(t+'|'+m);
    for(const key of keys){
      if(!buckets.has(key))buckets.set(key,[]);
      buckets.get(key).push(it)
    }
  }
  return buckets
}

// Una solicitud puede aceptar varias opciones a la vez (ej. "LOCAL / CASA COMERCIAL",
// o zonas que caen en más de un municipio). Buscamos en TODAS las combinaciones que
// menciona, no solo en la primera que detecta el clasificador general.
function matchKeysFor7(dem){
  const tipos=dem.tiposAll?.length?dem.tiposAll:[dem.tipo||'?'];
  const muns=dem.municipiosAll?.length?dem.municipiosAll:[dem.loc.municipio||'?'];
  const keys=new Set();
  for(const t of tipos)for(const m of muns)keys.add(t+'|'+m);
  return[...keys]
}
function matchesFor7(dem,buckets,R){
  const seen=new Set(),out=[];
  for(const key of matchKeysFor7(dem))for(const it of(buckets.get(key)||[]))if(!seen.has(it)){seen.add(it);out.push(it)}
  return out
}

function opportunities7(){
  const R=window.RI6;if(!R||!Array.isArray(props))return[];
  const buckets=buildInventoryBuckets7(R);
  const solicitudes=props.filter(p=>R.request6(p)&&freshRequest7(p,R,7));
  const out=[];
  for(const sol of solicitudes){
    const dem=demandExtract7(sol);if(!dem)continue;
    let matches=matchesFor7(dem,buckets,R);
    if(dem.budget)matches=matches.filter(inv=>{const pr=R.priceFor6(inv,'Venta')||R.priceFor6(inv,'Alquiler');return!pr||pr<=dem.budget*1.1});
    if(!matches.length)continue;
    matches=matches.slice().sort((a,b)=>{const pa=R.priceFor6(a,'Venta')||R.priceFor6(a,'Alquiler')||1e15,pb=R.priceFor6(b,'Venta')||R.priceFor6(b,'Alquiler')||1e15;return pa-pb});
    out.push({sol,dem,matches:matches.slice(0,5)})
  }
  return out
}

// Agrupa las solicitudes vigentes (últimos 7 días) por tipo+municipio para el resumen de tendencias de demanda.
function demandClusters7(){
  const R=window.RI6;if(!R||!Array.isArray(props))return[];
  const solicitudes=props.filter(p=>R.request6(p)&&freshRequest7(p,R,7));
  const map=new Map();
  for(const sol of solicitudes){
    const dem=demandExtract7(sol);if(!dem)continue;
    const key=(dem.tipo||'Tipo no especificado')+'|'+(dem.loc.municipio||'Municipio no especificado');
    if(!map.has(key))map.set(key,{tipo:dem.tipo,municipio:dem.loc.municipio,count:0,budgets:[]});
    const c=map.get(key);c.count++;if(dem.budget)c.budgets.push(dem.budget)
  }
  return[...map.values()].sort((a,b)=>b.count-a.count)
}

function e7(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function buildProposal7(dem,matches,R){
  const tipo=dem.tipo||'Inmueble',opTxt=dem.op==='Alquiler'?' EN ALQUILER':dem.op==='Venta'?' EN VENTA':'';
  const zonas=zonasInteres7(dem.raw)||[dem.loc.municipio,dem.loc.zona].filter(Boolean).join(', ')||'zona no especificada';
  const m2=m2Range7(dem.raw);
  let m2Txt='';
  if(m2.min&&m2.max)m2Txt='📐 Metraje: '+m2.min+'–'+m2.max+' m²\n';else if(m2.max)m2Txt='📐 Metraje aprox.: '+m2.max+' m²\n';
  const budgetTxt=dem.budget?'💰 '+(dem.op==='Alquiler'?'Canon':'Presupuesto')+': hasta $'+new Intl.NumberFormat('es-VE').format(dem.budget)+'\n':'';
  let out='Hola! Vi tu solicitud de *'+tipo+opTxt+'*\n\n📍 Zona: '+zonas+'\n'+m2Txt+budgetTxt+'\nTe comparto '+matches.length+' opción'+(matches.length===1?'':'es')+' que podría'+(matches.length===1?'':'n')+' servirte:\n\n';
  matches.forEach((m,i)=>{
    const price=R.priceLabel6(m,dem.op||undefined),loc=[R.loc6(m).municipio,R.loc6(m).zona].filter(Boolean).join(', '),c=R.captor6(m),S=R.d6?R.d6(m).stats:null;
    const specs=S?[S.m2?S.m2+'m²':null,S.h?S.h+' hab':null,S.b?S.b+' baños':null].filter(Boolean).join(', '):'';
    const contactTxt=c.phone?'Contacto: '+c.name+' - '+c.phone:'Contacto: '+c.name+' (sin teléfono directo, revisar mensaje original)';
    out+=(i+1)+'. '+(R.type6(m)||'Inmueble')+' en '+(loc||'ubicación por confirmar')+' - '+price+(specs?' ('+specs+')':'')+'\n   '+contactTxt+'\n\n'
  });
  out+='¡Cuéntame si alguna te sirve! 🚀';
  return out
}
function copyText7(text){
  try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text);return true}}catch(e){}
  try{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);return true}catch(e){return false}
}

function waLead7(dem,proposalText,R){
  const c=dem.captor;if(!c.phone)return null;
  return'https://wa.me/'+c.phone.replace(/\D/g,'')+'?text='+encodeURIComponent(proposalText)
}

function cardHtml7(dem,matches,R,propId,proposals,senderLabel){
  const proposalText=buildProposal7(dem,matches,R);
  proposals.set(propId,proposalText);
  const wa=waLead7(dem,proposalText,R),lead=wa?'<a class="primary" style="display:inline-block;text-decoration:none;text-align:center;padding:10px;border-radius:10px" href="'+wa+'" target="_blank">Enviar propuesta por WhatsApp</a>':'<div class="hint">Sin teléfono vinculado -- copia la propuesta y envíasela por donde corresponda.</div>';
  const capName=e7(dem.captor.name||senderLabel||'Colega');
  const budgetTxt=dem.budget?'hasta $'+new Intl.NumberFormat('es-VE').format(dem.budget):'presupuesto no especificado';
  const matchList=matches.map(m=>{
    const price=R.priceLabel6(m,dem.op||undefined),loc=[R.loc6(m).municipio,R.loc6(m).zona].filter(Boolean).join(' · '),c=R.captor6(m),wa=R.wa6(m,c);
    const contactBtn=wa?'<a href="'+e7(wa)+'" target="_blank" style="display:block;margin-top:4px;font-size:11px;color:#4e20d3;text-decoration:none;font-weight:700">Contactar a '+e7(c.name)+' por WhatsApp</a>':'<span style="display:block;margin-top:4px;font-size:11px;opacity:.6">'+e7(c.name)+' -- sin teléfono</span>';
    return'<div class="spec" style="text-align:left;padding:8px 10px"><b>'+price+'</b><span>'+e7(loc||'Ubicación por confirmar')+'</span>'+contactBtn+'</div>'
  }).join('');
  return'<article class="card"><div class="sender"><b>Solicitante:</b> '+capName+'</div><div class="loc">Busca '+e7(dem.tipo||'inmueble')+(dem.loc.municipio?' en '+e7(dem.loc.municipio):'')+' · '+budgetTxt+'</div><div class="features" style="margin-top:8px">'+matchList+'</div><div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">'+lead+'<button class="copyProp" data-propid="'+propId+'">Copiar propuesta</button></div><details><summary>Mensaje original de la solicitud</summary><pre>'+e7(dem.raw)+'</pre></details></article>'
}
function wireCopyButtons7(root,proposals){
  root.querySelectorAll('.copyProp').forEach(b=>b.onclick=()=>{
    const ok=copyText7(proposals.get(b.getAttribute('data-propid')));
    const prev=b.textContent;b.textContent=ok?'¡Copiado!':'No se pudo copiar';setTimeout(()=>{b.textContent=prev},1500)
  })
}

function showError7(root,err){
  root.innerHTML='<div class="hint" style="color:#b91c1c;background:#fef2f2;padding:10px;border-radius:8px;border:1px solid #fecaca">Ocurrió un error al calcular esto. Manda captura de este mensaje: <br><code style="font-size:11px;white-space:pre-wrap;display:block;margin-top:6px">'+e7(String(err&&err.stack||err))+'</code></div>'
}

function renderOpportunities7(){
  const R=window.RI6,root=document.querySelector('#oppResults'),clustersEl=document.querySelector('#oppClusters');
  if(!root)return;
  if(!R){root.innerHTML='<div class="hint">El módulo de búsqueda todavía no cargó. Espera unos segundos y vuelve a tocar "Actualizar oportunidades".</div>';return}
  try{
    const clusters=demandClusters7();
    if(clustersEl){
      clustersEl.innerHTML=clusters.length?clusters.slice(0,8).map(c=>{
        const avg=c.budgets.length?Math.round(c.budgets.reduce((a,b)=>a+b,0)/c.budgets.length):null;
        return'<div class="pill" style="margin:3px">'+e7(c.tipo||'Tipo?')+' en '+e7(c.municipio||'municipio?')+' · '+c.count+' solicitud'+(c.count===1?'':'es')+(avg?' · promedio $'+new Intl.NumberFormat('es-VE').format(avg):'')+'</div>'
      }).join(''):'<div class="hint">Todavía no hay solicitudes suficientes para ver tendencias.</div>'
    }
    const ops=opportunities7(),proposals=new Map();
    root.innerHTML=ops.length?ops.map(({sol,dem,matches},idx)=>cardHtml7(dem,matches,R,'prop'+idx,proposals,sol.sender)).join(''):'<div class="hint">No encontré coincidencias entre tus solicitudes de colegas y tu inventario todavía. Esto crece a medida que importas más grupos.</div>';
    wireCopyButtons7(root,proposals)
  }catch(err){showError7(root,err)}
}

// --- Solicitud pegada a mano: no pasa por prop()/el filtro de puntaje de importación,
// porque aquí ya sabemos con certeza que es una solicitud (no hace falta clasificarla).
function todayStr7(){const d=new Date();return d.getDate()+'/'+(d.getMonth()+1)+'/'+String(d.getFullYear()).slice(2)}
function matchAdhoc7(text){
  const R=window.RI6;if(!R)return null;
  const p={raw:text,sender:'',date:todayStr7()};
  const dem=demandExtract7(p);if(!dem)return null;
  const buckets=buildInventoryBuckets7(R,{forceGeneral:true});
  let matches=matchesFor7(dem,buckets,R);
  if(dem.budget)matches=matches.filter(inv=>{const pr=R.priceFor6(inv,'Venta')||R.priceFor6(inv,'Alquiler');return!pr||pr<=dem.budget*1.1});
  matches=matches.slice().sort((a,b)=>{const pa=R.priceFor6(a,'Venta')||R.priceFor6(a,'Alquiler')||1e15,pb=R.priceFor6(b,'Venta')||R.priceFor6(b,'Alquiler')||1e15;return pa-pb});
  return{dem,matches:matches.slice(0,5)}
}
function runPasteSearch7(){
  const R=window.RI6,ta=document.querySelector('#oppPaste'),root=document.querySelector('#oppPasteResults');
  if(!root)return;
  root.innerHTML='<div class="hint">Buscando...</div>';
  if(!R){root.innerHTML='<div class="hint">El módulo de búsqueda todavía no cargó. Espera unos segundos e inténtalo de nuevo.</div>';return}
  const text=(ta?.value||'').trim();
  if(!text){root.innerHTML='<div class="hint">Pega primero el texto de la solicitud.</div>';return}
  try{
    const res=matchAdhoc7(text);
    if(!res){root.innerHTML='<div class="hint">No pude leer esa solicitud.</div>';return}
    const proposals=new Map();
    root.innerHTML=res.matches.length?cardHtml7(res.dem,res.matches,R,'pasteprop',proposals,'Solicitud pegada'):'<div class="hint">No encontré en tu inventario nada que calce con esta solicitud ('+e7(res.dem.tipo||'tipo no identificado')+(res.dem.loc.municipio?' en '+e7(res.dem.loc.municipio):'')+').</div>';
    wireCopyButtons7(root,proposals)
  }catch(err){showError7(root,err)}
}

function bind7(){
  const btn=document.querySelector('#oppRefresh');
  if(btn)btn.onclick=renderOpportunities7;
  const pasteBtn=document.querySelector('#oppPasteBtn');
  if(pasteBtn)pasteBtn.onclick=runPasteSearch7;
  const miBtn=document.querySelector('#misInmueblesBtn');
  if(miBtn)miBtn.onclick=saveMisInmuebles7;
  renderMisInmueblesList7();
  // Si ya hay datos cargados al entrar, mostrar algo de una vez.
  if(Array.isArray(props)&&props.length)renderOpportunities7()
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind7,500));
else setTimeout(bind7,500);

// --- Mi Inventario: propiedades que Empi misma representa, separadas por una línea "---".
// Se guardan en su propio almacén de IndexedDB (misInmuebles), aparte de todo lo importado.
function splitMisInmuebles7(text){
  return String(text||'').split(/\n\s*-{3,}\s*\n/).map(s=>s.trim()).filter(Boolean)
}
function classifyMisInmueble7(raw,id){
  let p=null;
  try{p=prop({date:todayStr7(),sender:'Mi Inventario',text:raw},'mi-inventario')}catch(e){}
  if(!p)p={raw,sender:'Mi Inventario',date:todayStr7()};
  p.id=id;
  return p
}
function deleteMisInmueble7(id){
  return new Promise((resolve,reject)=>{
    try{const t=db.transaction('misInmuebles','readwrite');t.objectStore('misInmuebles').delete(id);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error)}catch(e){reject(e)}
  })
}
function renderMisInmueblesList7(){
  const root=document.querySelector('#misInmueblesList'),R=window.RI6;
  if(!root)return;
  const items=Array.isArray(window.misInmuebles)?window.misInmuebles:[];
  if(!items.length){root.innerHTML='Todavía no has cargado nada aquí. Mientras esté vacío, las búsquedas usan todo tu inventario importado.';return}
  root.innerHTML=items.map((it,idx)=>{
    const tipo=R?(R.type6(it)||'Inmueble'):'Inmueble',loc=R?[R.loc6(it).municipio,R.loc6(it).zona].filter(Boolean).join(' · '):'',price=R?R.priceLabel6(it,undefined):'';
    return'<div class="spec" style="display:flex;justify-content:space-between;align-items:center;gap:8px;text-align:left;padding:8px 10px;margin-bottom:6px"><span><b>'+e7(tipo)+'</b> '+e7(loc||'ubicación por confirmar')+' · '+e7(price||'')+'</span><button class="delMiInmueble" data-idx="'+idx+'" style="width:auto;padding:5px 10px;font-size:12px">Quitar</button></div>'
  }).join('');
  root.querySelectorAll('.delMiInmueble').forEach(b=>b.onclick=async()=>{
    const idx=+b.getAttribute('data-idx'),item=window.misInmuebles[idx];
    window.misInmuebles=window.misInmuebles.filter((_,i)=>i!==idx);
    try{await deleteMisInmueble7(item.id)}catch(e){}
    renderMisInmueblesList7()
  })
}
function saveMisInmuebles7(){
  const ta=document.querySelector('#misInmueblesPaste'),text=(ta?.value||'').trim();
  if(!text)return;
  const chunks=splitMisInmuebles7(text);
  if(!chunks.length)return;
  const nuevos=chunks.map((raw,i)=>classifyMisInmueble7(raw,'mi'+Date.now()+'-'+i));
  window.misInmuebles=(Array.isArray(window.misInmuebles)?window.misInmuebles:[]).concat(nuevos);
  puts('misInmuebles',nuevos).then(()=>{if(ta)ta.value='';renderMisInmueblesList7()}).catch(()=>{})
}

// Respaldo a prueba de fallos: un solo listener de clics en TODO el documento, puesto de
// inmediato (sin esperar setTimeout ni a que el botón ya exista en el DOM). Así, sin importar
// ninguna condición de carrera de tiempos, tocar estos botones siempre hace algo.
document.addEventListener('click',function(e){
  const t=e.target&&e.target.closest;
  if(!t)return;
  if(e.target.closest('#oppPasteBtn'))runPasteSearch7();
  else if(e.target.closest('#oppRefresh'))renderOpportunities7();
  else if(e.target.closest('#misInmueblesBtn'))saveMisInmuebles7()
});
})();
