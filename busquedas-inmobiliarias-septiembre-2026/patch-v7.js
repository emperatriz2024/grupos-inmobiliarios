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
  return{tipo:R.type6(p),loc:R.loc6(p),op:R.op6(p),budget:budgetFor7(R.raw6(p)),captor:R.captor6(p),raw:R.raw6(p)}
}

// Agrupa el inventario vigente (no-solicitudes, ya deduplicado) por tipo+municipio
// para poder buscar coincidencias rápido sin recorrer todo por cada solicitud.
function buildInventoryBuckets7(R){
  const inv=R.dedupe6((Array.isArray(props)?props:[]).filter(p=>!R.request6(p)));
  const buckets=new Map();
  for(const it of inv){
    const d=R.d6(it),key=(d.type||'?')+'|'+(d.loc.municipio||'?');
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(it)
  }
  return buckets
}

function opportunities7(){
  const R=window.RI6;if(!R||!Array.isArray(props))return[];
  const buckets=buildInventoryBuckets7(R);
  const solicitudes=props.filter(p=>R.request6(p));
  const out=[];
  for(const sol of solicitudes){
    const dem=demandExtract7(sol);if(!dem)continue;
    const key=(dem.tipo||'?')+'|'+(dem.loc.municipio||'?');
    let matches=buckets.get(key)||[];
    if(dem.budget)matches=matches.filter(inv=>{const pr=R.priceFor6(inv,'Venta')||R.priceFor6(inv,'Alquiler');return!pr||pr<=dem.budget*1.1});
    if(!matches.length)continue;
    matches=matches.slice().sort((a,b)=>{const pa=R.priceFor6(a,'Venta')||R.priceFor6(a,'Alquiler')||1e15,pb=R.priceFor6(b,'Venta')||R.priceFor6(b,'Alquiler')||1e15;return pa-pb});
    out.push({sol,dem,matches:matches.slice(0,5)})
  }
  return out
}

// Agrupa las solicitudes por tipo+municipio para el resumen de tendencias de demanda.
function demandClusters7(){
  const R=window.RI6;if(!R||!Array.isArray(props))return[];
  const solicitudes=props.filter(p=>R.request6(p));
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

function renderOpportunities7(){
  const R=window.RI6,root=document.querySelector('#oppResults'),clustersEl=document.querySelector('#oppClusters');
  if(!root)return;
  if(!R){root.innerHTML='<div class="hint">El módulo de búsqueda todavía no cargó. Espera unos segundos y vuelve a tocar "Actualizar oportunidades".</div>';return}
  const clusters=demandClusters7();
  if(clustersEl){
    clustersEl.innerHTML=clusters.length?clusters.slice(0,8).map(c=>{
      const avg=c.budgets.length?Math.round(c.budgets.reduce((a,b)=>a+b,0)/c.budgets.length):null;
      return'<div class="pill" style="margin:3px">'+e7(c.tipo||'Tipo?')+' en '+e7(c.municipio||'municipio?')+' · '+c.count+' solicitud'+(c.count===1?'':'es')+(avg?' · promedio $'+new Intl.NumberFormat('es-VE').format(avg):'')+'</div>'
    }).join(''):'<div class="hint">Todavía no hay solicitudes suficientes para ver tendencias.</div>'
  }
  const ops=opportunities7(),proposals=new Map();
  root.innerHTML=ops.length?ops.map(({sol,dem,matches},idx)=>{
    const propId='prop'+idx,proposalText=buildProposal7(dem,matches,R);
    proposals.set(propId,proposalText);
    const wa=waLead7(dem,proposalText,R),lead=wa?'<a class="primary" style="display:inline-block;text-decoration:none;text-align:center;padding:10px;border-radius:10px" href="'+wa+'" target="_blank">Enviar propuesta por WhatsApp</a>':'<div class="hint">Sin teléfono del colega -- copia la propuesta y envíasela por donde te contactó.</div>';
    const capName=e7(dem.captor.name||sol.sender||'Colega');
    const budgetTxt=dem.budget?'hasta $'+new Intl.NumberFormat('es-VE').format(dem.budget):'presupuesto no especificado';
    const matchList=matches.map(m=>{
      const price=R.priceLabel6(m,dem.op||undefined),loc=[R.loc6(m).municipio,R.loc6(m).zona].filter(Boolean).join(' · ');
      return'<div class="spec" style="text-align:left;padding:8px 10px"><b>'+price+'</b><span>'+e7(loc||'Ubicación por confirmar')+'</span></div>'
    }).join('');
    return'<article class="card"><div class="sender"><b>Colega:</b> '+capName+'</div><div class="loc">Busca '+e7(dem.tipo||'inmueble')+(dem.loc.municipio?' en '+e7(dem.loc.municipio):'')+' · '+budgetTxt+'</div><div class="features" style="margin-top:8px">'+matchList+'</div><div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">'+lead+'<button class="copyProp" data-propid="'+propId+'">Copiar propuesta</button></div><details><summary>Mensaje original de la solicitud</summary><pre>'+e7(dem.raw)+'</pre></details></article>'
  }).join(''):'<div class="hint">No encontré coincidencias entre tus solicitudes de colegas y tu inventario todavía. Esto crece a medida que importas más grupos.</div>';
  root.querySelectorAll('.copyProp').forEach(b=>b.onclick=()=>{
    const ok=copyText7(proposals.get(b.getAttribute('data-propid')));
    const prev=b.textContent;b.textContent=ok?'¡Copiado!':'No se pudo copiar';setTimeout(()=>{b.textContent=prev},1500)
  })
}

function bind7(){
  const btn=document.querySelector('#oppRefresh');
  if(btn)btn.onclick=renderOpportunities7;
  // Si ya hay datos cargados al entrar, mostrar algo de una vez.
  if(Array.isArray(props)&&props.length)renderOpportunities7()
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind7,500));
else setTimeout(bind7,500);
})();
