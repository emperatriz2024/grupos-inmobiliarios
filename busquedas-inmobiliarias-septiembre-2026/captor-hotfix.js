(()=>{
'use strict';
const PREFIX2='hola Colega me envías esta opción por favor';
function safePhone(x){try{return phone(x)}catch{return null}}
function safeKey(x){try{return key(x)}catch{return String(x||'').toLowerCase().trim()}}
function resolveCaptor(p){
  const senderPhone=safePhone(p.sender);
  const messagePhone=safePhone(p.raw);
  if(senderPhone){p.phone=senderPhone;p.contactName=p.sender||senderPhone;p.contactSource='número del emisor del grupo';return p}
  if(messagePhone){p.phone=messagePhone;p.contactName=p.sender||'Captador';p.contactSource='número publicado por el captador';return p}
  const sk=safeKey(p.sender);
  let matches=(window.cmap&&window.cmap.get?window.cmap.get(sk):null)||[];
  if(!matches.length&&sk&&window.contacts){
    const maybe=window.contacts.filter(c=>c&&c.k&&c.phone&&c.k.length>=5&&(c.k.includes(sk)||sk.includes(c.k)));
    const uniq=[...new Map(maybe.map(c=>[c.phone,c])).values()];
    if(uniq.length===1)matches=uniq;
  }
  const numbers=[...new Set(matches.map(c=>c.phone).filter(Boolean))];
  if(numbers.length===1){p.phone=numbers[0];p.contactName=matches[0].name||p.sender;p.contactSource='nombre del emisor vinculado a contactos iPhone';return p}
  p.phone=null;p.contactName=p.sender||null;p.contactSource=numbers.length>1?'nombre ambiguo en contactos':'captador sin teléfono vinculado';return p;
}
window.resolve=resolveCaptor;
function esc2(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function cash2(v){return v?'$'+new Intl.NumberFormat('es-VE').format(v):'—'}
function renderCaptor(a){
  const count=document.querySelector('#count'),results=document.querySelector('#results');
  if(count)count.textContent='('+a.length+')';
  if(!results)return;
  if(!a.length){results.className='empty';results.innerHTML='No encontré inventario vigente con esos criterios.';return}
  results.className='';
  results.innerHTML=a.slice(0,250).map(p=>{
    resolveCaptor(p);
    const msg=PREFIX2+'\n\n'+(p.raw||'');
    const wa=p.phone?'https://wa.me/'+p.phone.replace(/\D/g,'')+'?text='+encodeURIComponent(msg):null;
    const L=[p.zona,p.municipio].filter(Boolean).join(' · ')||'Ubicación por confirmar';
    const F=(p.features||[]).slice(0,6).map(x=>'<span class="pill">'+esc2(x)+'</span>').join('');
    const captor=p.phone
      ? '<div style="font-size:12px;line-height:1.45;margin-top:8px;padding:8px 10px;border-radius:10px;background:#f8f7fc;border:1px solid #ece8f6"><b>Captador: '+esc2(p.contactName||p.sender||'Asesor')+'</b><br>'+esc2(p.phone)+' · '+esc2(p.contactSource)+'</div>'
      : '<div style="font-size:12px;line-height:1.45;margin-top:8px;padding:8px 10px;border-radius:10px;background:#faf8ff;border:1px solid #ece8f6"><b>Captador detectado: '+esc2(p.sender||'Emisor sin identificar')+'</b><br>Falta vincular su número. Si el chat muestra el nombre guardado, importa tus contactos del iPhone para resolverlo.</div>';
    const btn=wa
      ? '<button class="primary wa" data-captor-wa="'+esc2(wa)+'">Contactar captador por WhatsApp</button>'
      : '<button class="wa" disabled>Captador sin teléfono vinculado</button>';
    return '<article class="card"><div class="head"><div><div><span class="pill">'+esc2(p.op||'Operación por confirmar')+'</span>'+(p.tipo?'<span class="pill">'+esc2(p.tipo)+'</span>':'')+'</div><div class="loc">'+esc2(L)+'</div><div class="sender">Publicado por: '+esc2(p.sender||'Emisor sin identificar')+'</div></div><div><div class="price">'+cash2(p.precio)+'</div><div class="age">'+(p.age===0?'hoy':p.age===1?'hace 1 día':'hace '+p.age+' días')+'</div></div></div><div class="specs"><div class="spec"><b>'+esc2(p.m2??'—')+'</b><span>m²</span></div><div class="spec"><b>'+esc2(p.h??'—')+'</b><span>HAB</span></div><div class="spec"><b>'+esc2(p.b??'—')+'</b><span>BAÑOS</span></div><div class="spec"><b>'+esc2(p.e??'—')+'</b><span>PUESTOS</span></div></div><div class="features">'+F+'</div>'+captor+btn+'<details><summary>Mensaje original</summary><pre>'+esc2(p.raw)+'</pre></details></article>';
  }).join('');
  document.querySelectorAll('[data-captor-wa]').forEach(b=>b.onclick=()=>location.href=b.dataset.captorWa);
}
window.render=renderCaptor;
function relabel(){
  const h=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='Contactos de asesores');if(h)h.textContent='Directorio de captadores';
  const btn=document.querySelector('#contactBtn');if(btn)btn.textContent='Importar contactos y vincular captadores';
  const st=document.querySelector('#contactStatus');if(st)st.textContent='Si el chat exportado trae un número, se usa directamente. Si trae el nombre guardado del colega, se vincula con tus contactos del iPhone.';
  const labels=[...document.querySelectorAll('.stat span')];labels.forEach(x=>{if(x.textContent.trim()==='WhatsApp directo')x.textContent='captadores resueltos'});
  const notice=document.querySelector('.notice');if(notice)notice.innerHTML='El botón de WhatsApp siempre debe abrir al <b>captador/emisor real</b>. La app no te pedirá escoger un contacto al azar.';
}
function refresh(){
  relabel();
  try{if(window.props&&Array.isArray(window.props)){window.props.forEach(resolveCaptor);if(window.puts)window.puts('properties',window.props).catch(()=>{});renderCaptor(window.props);if(window.stat)window.stat()}}catch(e){console.warn('captor hotfix',e)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,250));else setTimeout(refresh,250);
})();