
import {
  mergeProperties, addImport, getStats, getRecentImports, clearDatabase,
  getAllProperties, getFavoriteIds, toggleFavorite, getPropertiesByIds, purgeOldProperties
} from './db.js';
import {
  matchesFilters, sortProperties, formatMoney, recencyInfo, effectivePhone,
  whatsappNumber
} from './search-utils.js';
import {
  getDropboxSettings, saveDropboxSettings, startDropboxOAuth, finishDropboxOAuthIfPresent,
  disconnectDropbox as dropboxDisconnect, listPendingZips, downloadDropboxFile, moveDropboxFile,
  redirectUri as dropboxRedirectUri
} from './dropbox.js';

const $ = (q) => document.querySelector(q);
let selectedFile = null;
let allProperties = [];
let favoriteIds = new Set();
let currentResults = [];
let visibleCount = 30;
const SEARCH_SCROLL_KEY='gi_search_scroll_v042';
const SEARCH_CARD_KEY='gi_search_card_v042';
const SEARCH_STATE_KEY='gi_search_state_v042';

function rememberSearchPosition(cardId='') {
  try {
    sessionStorage.setItem(SEARCH_SCROLL_KEY,String(window.scrollY||0));
    if(cardId) sessionStorage.setItem(SEARCH_CARD_KEY,cardId);
    sessionStorage.setItem(SEARCH_STATE_KEY,JSON.stringify({
      visibleCount,
      q:$('#q')?.value||'', operation:$('#operation')?.value||'', propertyType:$('#propertyType')?.value||'',
      zone:$('#zone')?.value||'', residence:$('#residence')?.value||'', minPrice:$('#minPrice')?.value||'',
      maxPrice:$('#maxPrice')?.value||'', bedrooms:$('#bedrooms')?.value||'', bathrooms:$('#bathrooms')?.value||'',
      parking:$('#parking')?.value||'', minArea:$('#minArea')?.value||'', maxArea:$('#maxArea')?.value||'',
      maxAge:$('#maxAge')?.value||'', sortMode:$('#sortMode')?.value||'recent',
      planta100:!!$('#planta100')?.checked, planta:!!$('#planta')?.checked, pozo:!!$('#pozo')?.checked,
      tanque:!!$('#tanque')?.checked, amoblado:!!$('#amoblado')?.checked, financiamiento:!!$('#financiamiento')?.checked,
      piscina:!!$('#piscina')?.checked, onlyPhone:!!$('#onlyPhone')?.checked
    }));
  } catch {}
}

function restoreSearchFormState(){
  try{
    const s=JSON.parse(sessionStorage.getItem(SEARCH_STATE_KEY)||'null');
    if(!s) return false;
    const v=(id,val)=>{const el=$('#'+id); if(el) el.value=val??'';};
    const c=(id,val)=>{const el=$('#'+id); if(el) el.checked=!!val;};
    v('q',s.q);v('operation',s.operation);v('propertyType',s.propertyType);v('zone',s.zone);v('residence',s.residence);
    v('minPrice',s.minPrice);v('maxPrice',s.maxPrice);v('bedrooms',s.bedrooms);v('bathrooms',s.bathrooms);v('parking',s.parking);
    v('minArea',s.minArea);v('maxArea',s.maxArea);v('maxAge',s.maxAge);v('sortMode',s.sortMode);
    c('planta100',s.planta100);c('planta',s.planta);c('pozo',s.pozo);c('tanque',s.tanque);c('amoblado',s.amoblado);
    c('financiamiento',s.financiamiento);c('piscina',s.piscina);c('onlyPhone',s.onlyPhone);
    visibleCount=Math.max(30,Number(s.visibleCount||30));
    return true;
  }catch{return false;}
}

function restoreSearchPosition(){
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    try{
      const cardId=sessionStorage.getItem(SEARCH_CARD_KEY);
      const y=Number(sessionStorage.getItem(SEARCH_SCROLL_KEY)||0);
      if(cardId){
        const card=document.querySelector(`.propertyCard[data-id="${CSS.escape(cardId)}"]`);
        if(card){
          card.scrollIntoView({block:'center'});
          card.classList.add('cardAnchorFlash');
          setTimeout(()=>card.classList.remove('cardAnchorFlash'),1000);
          return;
        }
      }
      if(y>0) window.scrollTo({top:y,behavior:'auto'});
    }catch{}
  }));
}

function prettySize(n = 0) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function esc(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[c]));
}
function groupFromName(name = '') {
  return name.replace(/\.zip$/i, '').replace(/^WhatsApp Chat\s*-?\s*/i, '').trim() || 'Grupo inmobiliario';
}
function setStatus(text, pct = null) {
  $('#statusBox').hidden = false;
  $('#statusText').textContent = text;
  if (pct == null) $('#progress').removeAttribute('value');
  else { $('#progress').value = pct; $('#progress').max = 100; }
}
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
  document.querySelectorAll('.bottomNav button').forEach(b => b.classList.toggle('active', b.dataset.view === id));
  if (id === 'viewSaved') renderSaved();
}
document.querySelectorAll('.bottomNav button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));

function featureLabels(p) {
  const out = [];
  if (p.planta_100) out.push('⚡ Planta 100%');
  else if (p.planta_electrica) out.push('⚡ Planta');
  if (p.pozo) out.push('💧 Pozo');
  if (p.tanque) out.push('Tanque');
  if (p.amoblado) out.push('Amoblado');
  if (p.financiamiento) out.push('Financiamiento');
  if (p.piscina) out.push('Piscina');
  return out;
}
function propertyTitle(p) {
  return p.residence || p.property_type || 'Propiedad';
}
function sourceText(p) {
  const s = (p.sources || [])[0] || {};
  return `${s.sender || p.sender || 'Corredor'} · ${s.group || p.group || 'Grupo'} · ${p.date || ''}`;
}
function cardHTML(p) {
  const r=recencyInfo(p.date);
  const phone=effectivePhone(p);
  const fav=favoriteIds.has(p.id);
  const metas=[];
  if(p.area_m2) metas.push(`${p.area_m2} m²`);
  if(p.bedrooms) metas.push(`${p.bedrooms} Hab`);
  if(p.bathrooms) metas.push(`${p.bathrooms} Baños`);
  if(p.parking) metas.push(`${p.parking} Puestos`);
  const src=(p.sources||[])[0]||{};
  const sender=src.sender||p.sender||'Corredor';
  const group=src.group||p.group||'Grupo';
  const original=(p.text||'').trim();
  const needsExpand=original.length>420 || original.split('\n').length>7;

  return `
  <article class="propertyCard" data-id="${esc(p.id)}">
    <div class="propertyTop">
      <div class="chips">
        ${p.operation?`<span class="chip gold">${esc(p.operation)}</span>`:''}
        ${p.property_type?`<span class="chip">${esc(p.property_type)}</span>`:''}
        ${(p.appearances||1)>1?`<span class="chip">${p.appearances} apariciones</span>`:''}
      </div>
      <span class="recency ${r.cls}">${esc(r.label)}</span>
    </div>
    <h3>${esc(propertyTitle(p))}</h3>
    <div class="zone">${esc(p.zone||'Zona no detectada')}</div>
    <div class="price">${esc(formatMoney(p.price_usd))}</div>
    ${metas.length?`<div class="meta">${metas.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}
    ${featureLabels(p).length?`<div class="features">${featureLabels(p).map(x=>`<span class="feature">${esc(x)}</span>`).join('')}</div>`:''}
    <div class="quickFacts">
      <div class="who"><b>${esc(sender)}</b><small>${esc(group)}</small></div>
      <span class="seen">${esc(p.date||'')} ${esc(p.time||'')}</span>
    </div>
    <div class="originalInline">
      <div class="originalInlineHead"><b>Mensaje original del chat</b><span>${original.length.toLocaleString('es-VE')} caracteres</span></div>
      <div class="originalPreview">${esc(original||'Sin texto original disponible.')}</div>
      ${needsExpand?`<button class="expandOriginal" data-id="${esc(p.id)}">Mostrar mensaje completo ↓</button>`:''}
    </div>
    <div class="cardActions v042">
      <button class="action detail" data-id="${esc(p.id)}">Ver ficha</button>
      <button class="action whatsapp" data-id="${esc(p.id)}" ${phone?'':'disabled'}>WhatsApp</button>
      <button class="action favorite ${fav?'active':''}" data-id="${esc(p.id)}">${fav?'♥':'♡'}</button>
    </div>
  </article>`;
}

function bindCardActions(container) {
  container.querySelectorAll('.expandOriginal').forEach(btn=>btn.onclick=()=>{
    const box=btn.closest('.originalInline');
    const card=btn.closest('.propertyCard');
    if(!box) return;
    const expanded=box.classList.toggle('expanded');
    btn.textContent=expanded?'Contraer mensaje ↑':'Mostrar mensaje completo ↓';
    if(card) rememberSearchPosition(card.dataset.id);
  });
  container.querySelectorAll('.detail').forEach(btn => btn.onclick = () => {
    rememberSearchPosition(btn.dataset.id);
    openDetail(btn.dataset.id);
  });
  container.querySelectorAll('.favorite').forEach(btn => btn.onclick = async () => {
    const nowFav = await toggleFavorite(btn.dataset.id);
    if (nowFav) favoriteIds.add(btn.dataset.id); else favoriteIds.delete(btn.dataset.id);
    btn.classList.toggle('active', nowFav);
    btn.textContent = nowFav ? '♥' : '♡';
    await refreshStatsOnly();
    if ($('#viewSaved').classList.contains('active')) renderSaved();
  });
  container.querySelectorAll('.whatsapp').forEach(btn => btn.onclick = () => {
    rememberSearchPosition(btn.dataset.id);
    const p = allProperties.find(x => x.id === btn.dataset.id);
    const num = whatsappNumber(effectivePhone(p));
    if (!num) return;
    const msg = encodeURIComponent(`Hola, vi tu publicación de ${p.property_type || 'una propiedad'}${p.zone ? ' en '+p.zone : ''}${p.residence ? ', '+p.residence : ''}. ¿Sigue disponible?`);
    window.location.href = `https://wa.me/${num}?text=${msg}`;
  });
}

function getFilters() {
  return {
    q: $('#q').value,
    operation: $('#operation').value,
    property_type: $('#propertyType').value,
    zone: $('#zone').value,
    residence: $('#residence').value,
    min_price: $('#minPrice').value,
    max_price: $('#maxPrice').value,
    bedrooms: $('#bedrooms').value,
    bathrooms: $('#bathrooms').value,
    parking: $('#parking').value,
    min_area: $('#minArea').value,
    max_area: $('#maxArea').value,
    max_age_days: $('#maxAge').value,
    planta_100: $('#planta100').checked,
    planta_electrica: $('#planta').checked,
    pozo: $('#pozo').checked,
    tanque: $('#tanque').checked,
    amoblado: $('#amoblado').checked,
    financiamiento: $('#financiamiento').checked,
    piscina: $('#piscina').checked,
    only_phone: $('#onlyPhone').checked
  };
}

function runSearch(resetVisible=true) {
  if (resetVisible) visibleCount = 30;
  const f = getFilters();
  currentResults = sortProperties(allProperties.filter(p => matchesFilters(p, f)), $('#sortMode').value);
  $('#resultCount').textContent = currentResults.length.toLocaleString('es-VE');
  $('#resultHint').textContent = currentResults.length ? 'Base local · orden aplicada' : 'Sin coincidencias';
  renderResults();
  rememberSearchPosition();
}
function renderResults() {
  const box = $('#results');
  const items = currentResults.slice(0, visibleCount);
  box.innerHTML = items.length ? items.map(cardHTML).join('') : `<div class="empty">No encontré propiedades con esos filtros.</div>`;
  bindCardActions(box);
  $('#loadMore').hidden = currentResults.length <= visibleCount;
}
$('#loadMore').onclick = () => { visibleCount += 30; renderResults(); rememberSearchPosition(); };
$('#searchBtn').onclick = () => runSearch();
$('#q').addEventListener('keydown', e => { if(e.key === 'Enter') { e.preventDefault(); runSearch(); }});
$('#sortMode').onchange = () => runSearch();
$('#clearFilters').onclick = () => {
  ['q','operation','propertyType','zone','residence','minPrice','maxPrice','bedrooms','bathrooms','parking','minArea','maxArea','maxAge'].forEach(id => $('#'+id).value='');
  ['planta100','planta','pozo','tanque','amoblado','financiamiento','piscina','onlyPhone'].forEach(id => $('#'+id).checked=false);
  runSearch();
};

function buildZoneOptions() {
  const zones = [...new Set(allProperties.map(p=>p.zone).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  $('#zone').innerHTML = `<option value="">Todas</option>` + zones.map(z=>`<option>${esc(z)}</option>`).join('');
}

async function openDetail(id) {
  const p = allProperties.find(x=>x.id===id);
  if (!p) return;
  $('#detailType').textContent = [p.operation,p.property_type,p.zone].filter(Boolean).join(' · ');
  $('#detailTitle').textContent = propertyTitle(p);
  const phone = effectivePhone(p);
  const grid = [
    ['Precio',formatMoney(p.price_usd)],['m²',p.area_m2||'—'],['Habitaciones',p.bedrooms||'—'],
    ['Baños',p.bathrooms||'—'],['Puestos',p.parking||'—'],['Teléfono',phone||'No detectado']
  ];
  $('#detailContent').innerHTML = `
    <div class="detailBody">
      <div class="detailPrice">${esc(formatMoney(p.price_usd))}</div>
      <div class="features">${featureLabels(p).map(x=>`<span class="feature">${esc(x)}</span>`).join('')}</div>
      <div class="detailGrid">${grid.map(([a,b])=>`<div><small>${esc(a)}</small><b>${esc(b)}</b></div>`).join('')}</div>
      ${phone ? `<button id="detailWhatsApp" class="primary">Contactar por WhatsApp</button>` : ''}
      <h4>Publicación original</h4>
      <div class="originalText">${esc(p.text || '')}</div>
      <div class="sources"><h4>Fuentes encontradas (${(p.sources||[]).length || 1})</h4>
        ${(p.sources||[]).map(s=>`<div class="sourceItem"><b>${esc(s.sender||'Corredor')}</b><br>${esc(s.group||'Grupo')} · ${esc(s.date||'')} ${esc(s.time||'')}</div>`).join('')}
      </div>
    </div>`;
  $('#detailDialog').showModal();
  if (phone) $('#detailWhatsApp').onclick = () => {
    const num = whatsappNumber(phone);
    const msg = encodeURIComponent(`Hola, vi tu publicación de ${p.property_type || 'una propiedad'}${p.zone ? ' en '+p.zone : ''}${p.residence ? ', '+p.residence : ''}. ¿Sigue disponible?`);
    window.location.href = `https://wa.me/${num}?text=${msg}`;
  };
}
$('#closeDialog').onclick = () => { $('#detailDialog').close(); restoreSearchPosition(); };
$('#detailDialog').addEventListener('close',()=>restoreSearchPosition());

async function renderSaved() {
  const box = $('#savedResults');
  const items = sortProperties(allProperties.filter(p=>favoriteIds.has(p.id)),'recent');
  $('#savedEmpty').hidden = items.length > 0;
  box.innerHTML = items.map(cardHTML).join('');
  bindCardActions(box);
}


function processZipWithWorker(file, group, progressCb) {
  return new Promise((resolve,reject)=>{
    const worker = new Worker('./worker.js',{type:'module'});
    worker.onmessage = async (e)=>{
      const m=e.data;
      if(m.type==='status'){ progressCb?.({phase:m.step,text:m.text,bytes:m.bytes}); return; }
      if(m.type==='error'){ worker.terminate(); reject(new Error(m.message)); return; }
      if(m.type==='done'){ worker.terminate(); resolve(m); }
    };
    worker.onerror=(e)=>{worker.terminate();reject(new Error(e.message||'Error del procesador'));};
    worker.postMessage({file,group});
  });
}

async function saveProcessedResult(m, group, fileName, progressCb) {
  const saved = await mergeProperties(m.result.unique,(done,total)=>progressCb?.({phase:'save',done,total}));
  const summary={group,file_name:fileName,chat_file:m.entryName,
    messages:m.result.messages,
    messages_total:m.result.messages_total ?? m.result.messages,
    skipped_age:m.result.messages_skipped_age ?? 0,
    max_age_days:m.result.max_age_days ?? 45,
    cutoff_date:m.result.cutoff_date ?? null,
    detected:m.result.properties_detected,unique:m.result.unique.length,
    added:saved.added,updated:saved.updated};
  await addImport(summary);
  return summary;
}

async function importOneZip(file, group, progressCb) {
  const m = await processZipWithWorker(file,group,progressCb);
  const summary = await saveProcessedResult(m,group,file.name,progressCb);
  return {m,summary};
}

const fileInput = $('#zipInput');
fileInput.addEventListener('change', () => {
  selectedFile = fileInput.files?.[0] || null;
  if (!selectedFile) return;
  $('#fileName').textContent = selectedFile.name;
  $('#fileMeta').textContent = `${prettySize(selectedFile.size)} · listo para procesar`;
  $('#fileCard').hidden = false;
  $('#importBtn').disabled = false;
  $('#resultBox').hidden = true;
});

$('#importBtn').addEventListener('click', async () => {
  if (!selectedFile) return;
  $('#importBtn').disabled = true; fileInput.disabled = true; $('#resultBox').hidden = true;
  try {
    const group = groupFromName(selectedFile.name);
    setStatus('Preparando importación…');
    const {summary} = await importOneZip(selectedFile,group,(p)=>{
      if(p.phase==='zip') setStatus('Abriendo ZIP…',12);
      else if(p.phase==='decode') setStatus(p.bytes?`Leyendo chat… ${prettySize(p.bytes)}`:'Leyendo chat…',28);
      else if(p.phase==='process') setStatus('Detectando propiedades…',48);
      else if(p.phase==='save') setStatus(`Guardando base local… ${p.done.toLocaleString('es-VE')} / ${p.total.toLocaleString('es-VE')}`,60+Math.round((p.done/Math.max(p.total,1))*35));
    });
    setStatus('Importación completada',100);
    $('#resultBox').innerHTML = `<div class="successMark">✓</div><h3>Importación completada</h3>
      <div class="summaryGrid"><div><b>${summary.messages.toLocaleString('es-VE')}</b><span>mensajes ≤45 días</span></div>
      <div><b>${summary.skipped_age.toLocaleString('es-VE')}</b><span>antiguos omitidos</span></div>
      <div><b>${summary.detected.toLocaleString('es-VE')}</b><span>publicaciones</span></div>
      <div><b>${summary.added.toLocaleString('es-VE')}</b><span>nuevas en base</span></div></div>`;
    $('#resultBox').hidden=false; await loadData();
  } catch(e) { setStatus(`Error: ${e.message}`,0); }
  finally { $('#importBtn').disabled=false; fileInput.disabled=false; }
});

async function refreshStatsOnly() {
  const s = await getStats();
  $('#propertyCount').textContent = s.properties.toLocaleString('es-VE');
  $('#importCount').textContent = s.imports.toLocaleString('es-VE');
  $('#favoriteCount').textContent = s.favorites.toLocaleString('es-VE');
}
async function refreshRecent() {
  const recent = await getRecentImports();
  $('#recent').innerHTML = recent.length ? recent.map(r=>`<div class="recentItem"><div><b>${esc(r.group)}</b>
    <small>${new Date(r.imported_at).toLocaleString('es-VE')} · ${Number(r.messages||0).toLocaleString('es-VE')} recientes${r.skipped_age?` · ${Number(r.skipped_age).toLocaleString('es-VE')} omitidos`:''}</small></div><span>+${Number(r.added||0).toLocaleString('es-VE')}</span></div>`).join('')
    : '<p class="muted">Aún no has importado grupos.</p>';
}
async function loadData() {
  await purgeOldProperties(45);
  allProperties = await getAllProperties();
  favoriteIds = await getFavoriteIds();
  await refreshStatsOnly();
  await refreshRecent();
  buildZoneOptions();
  const restored=restoreSearchFormState();
  if(restored){
    currentResults=sortProperties(allProperties.filter(p=>matchesFilters(p,getFilters())),$('#sortMode').value);
    $('#resultCount').textContent=currentResults.length.toLocaleString('es-VE');
    $('#resultHint').textContent='Búsqueda restaurada';
  }else{
    currentResults=sortProperties(allProperties,'recent');
    $('#resultCount').textContent=currentResults.length.toLocaleString('es-VE');
    $('#resultHint').textContent='Mostrando las más recientes';
    visibleCount=30;
  }
  renderResults();
  if(restored) restoreSearchPosition();
  if ($('#viewSaved').classList.contains('active')) renderSaved();
}
$('#resetBtn').onclick = async () => {
  if (!confirm('¿Eliminar propiedades, importaciones y guardadas de este dispositivo?')) return;
  await clearDatabase(); allProperties=[]; favoriteIds=new Set(); await loadData();
  $('#resultBox').hidden=true; $('#statusBox').hidden=true;
};


let pendingDropboxFiles = [];

function renderDropboxState() {
  const s=getDropboxSettings();
  $('#dropboxAppKey').value=s.appKey;
  $('#pendingPath').value=s.pendingPath;
  $('#processedPath').value=s.processedPath;
  $('#redirectUri').textContent=dropboxRedirectUri();
  $('#dropboxDisconnected').hidden=s.connected;
  $('#dropboxConnected').hidden=!s.connected;
  if(s.connected) $('#dropboxFolderLabel').textContent=`${s.pendingPath} → ${s.processedPath}`;
}
function renderPendingList() {
  $('#pendingCount').textContent=pendingDropboxFiles.length.toLocaleString('es-VE');
  const total=pendingDropboxFiles.reduce((a,x)=>a+Number(x.size||0),0);
  $('#pendingSize').textContent=prettySize(total);
  $('#pendingList').innerHTML=pendingDropboxFiles.length
    ? pendingDropboxFiles.slice(0,20).map(x=>`<div class="pendingItem"><div><b>${esc(x.name)}</b><small>${x.server_modified?new Date(x.server_modified).toLocaleString('es-VE'):''}</small></div><span>${prettySize(x.size||0)}</span></div>`).join('')
    : '<p class="muted">No hay ZIP pendientes en esta carpeta.</p>';
}
async function refreshDropboxPending() {
  const s=getDropboxSettings();
  $('#dropboxProgress').hidden=false;
  $('#dropboxProgressTitle').textContent='Leyendo Dropbox…';
  $('#dropboxProgressCount').textContent='';
  $('#dropboxProgressBar').removeAttribute('value');
  $('#dropboxProgressDetail').textContent=s.pendingPath;
  try {
    pendingDropboxFiles=await listPendingZips(s.pendingPath);
    renderPendingList();
    $('#dropboxProgressTitle').textContent='Lista actualizada';
    $('#dropboxProgressBar').value=100; $('#dropboxProgressBar').max=100;
    $('#dropboxProgressDetail').textContent=`${pendingDropboxFiles.length} ZIP encontrados`;
  } catch(e) {
    $('#dropboxProgressTitle').textContent='No pude leer la carpeta';
    $('#dropboxProgressDetail').textContent=e.message;
  }
}

$('#saveDropboxSettings').onclick=()=>{
  saveDropboxSettings({appKey:$('#dropboxAppKey').value,pendingPath:$('#pendingPath').value,processedPath:$('#processedPath').value});
  renderDropboxState();
  alert('Configuración de Dropbox guardada.');
};
$('#connectDropbox').onclick=async()=>{
  saveDropboxSettings({appKey:$('#dropboxAppKey').value,pendingPath:$('#pendingPath').value,processedPath:$('#processedPath').value});
  try{await startDropboxOAuth();}catch(e){alert(e.message);}
};
$('#disconnectDropbox').onclick=()=>{
  if(!confirm('¿Desconectar Dropbox de esta aplicación?')) return;
  dropboxDisconnect(); pendingDropboxFiles=[]; renderDropboxState();
};
$('#refreshDropbox').onclick=()=>refreshDropboxPending();

$('#processPending').onclick=async()=>{
  if(!pendingDropboxFiles.length){await refreshDropboxPending(); if(!pendingDropboxFiles.length) return;}
  const s=getDropboxSettings();
  $('#processPending').disabled=true; $('#refreshDropbox').disabled=true;
  $('#dropboxProgress').hidden=false; $('#dropboxProgressBar').max=pendingDropboxFiles.length;
  let ok=0, failed=0;
  const queue=[...pendingDropboxFiles];
  for(let i=0;i<queue.length;i++){
    const entry=queue[i];
    $('#dropboxProgressBar').value=i;
    $('#dropboxProgressTitle').textContent='Procesando chats pendientes';
    $('#dropboxProgressCount').textContent=`${i+1}/${queue.length}`;
    $('#dropboxProgressDetail').textContent=`Descargando ${entry.name}`;
    try{
      const blob=await downloadDropboxFile(entry.path_lower||entry.path_display);
      const file=new File([blob],entry.name,{type:'application/zip'});
      const group=groupFromName(entry.name);
      const {summary}=await importOneZip(file,group,(p)=>{
        if(p.phase==='process') $('#dropboxProgressDetail').textContent=`Analizando últimos 45 días · ${entry.name}`;
        if(p.phase==='save') $('#dropboxProgressDetail').textContent=`Guardando ${entry.name} · ${p.done}/${p.total}`;
      });
      $('#dropboxProgressDetail').textContent=`Moviendo ${entry.name} a ${s.processedPath}`;
      await moveDropboxFile(entry.path_lower||entry.path_display,s.processedPath,entry.name);
      ok++;
      await loadData();
    }catch(e){
      failed++;
      console.error(entry.name,e);
      $('#dropboxProgressDetail').textContent=`Error en ${entry.name}: ${e.message}`;
      await new Promise(r=>setTimeout(r,1200));
    }
  }
  $('#dropboxProgressBar').value=queue.length;
  $('#dropboxProgressTitle').textContent=failed?'Proceso terminado con avisos':'Todos los pendientes fueron procesados';
  $('#dropboxProgressCount').textContent=`${ok} OK${failed?` · ${failed} error`:''}`;
  $('#dropboxProgressDetail').textContent=failed?'Los archivos con error permanecen en Chat pendiente.':'Los ZIP procesados fueron movidos a Procesado.';
  $('#processPending').disabled=false; $('#refreshDropbox').disabled=false;
  await refreshDropboxPending();
};

async function initDropbox() {
  renderDropboxState();
  try {
    const finished=await finishDropboxOAuthIfPresent();
    renderDropboxState();
    if(finished || getDropboxSettings().connected) await refreshDropboxPending();
  } catch(e) {
    renderDropboxState();
    alert(`Dropbox: ${e.message}`);
  }
}
initDropbox();


window.addEventListener('pagehide',()=>rememberSearchPosition());
window.addEventListener('pageshow',e=>{ if(e.persisted) restoreSearchPosition(); });
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden') rememberSearchPosition();
  else if(document.visibilityState==='visible') restoreSearchPosition();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
loadData();
