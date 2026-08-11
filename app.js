
import {
  mergeProperties, addImport, getStats, getRecentImports, clearDatabase,
  getAllProperties, getFavoriteIds, toggleFavorite, getPropertiesByIds
} from './db.js';
import {
  matchesFilters, sortProperties, formatMoney, recencyInfo, effectivePhone,
  whatsappNumber
} from './search-utils.js';

const $ = (q) => document.querySelector(q);
let selectedFile = null;
let allProperties = [];
let favoriteIds = new Set();
let currentResults = [];
let visibleCount = 30;

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
  const r = recencyInfo(p.date);
  const phone = effectivePhone(p);
  const fav = favoriteIds.has(p.id);
  const metas = [];
  if (p.area_m2) metas.push(`${p.area_m2} m²`);
  if (p.bedrooms) metas.push(`${p.bedrooms} Hab`);
  if (p.bathrooms) metas.push(`${p.bathrooms} Baños`);
  if (p.parking) metas.push(`${p.parking} Puestos`);
  return `
  <article class="propertyCard" data-id="${esc(p.id)}">
    <div class="propertyTop">
      <div class="chips">
        ${p.operation ? `<span class="chip gold">${esc(p.operation)}</span>` : ''}
        ${p.property_type ? `<span class="chip">${esc(p.property_type)}</span>` : ''}
        ${(p.appearances||1)>1 ? `<span class="chip">${p.appearances} apariciones</span>` : ''}
      </div>
      <span class="recency ${r.cls}">${esc(r.label)}</span>
    </div>
    <h3>${esc(propertyTitle(p))}</h3>
    <div class="zone">${esc(p.zone || 'Zona no detectada')}</div>
    <div class="price">${esc(formatMoney(p.price_usd))}</div>
    ${metas.length ? `<div class="meta">${metas.map(x=>`<span>${esc(x)}</span>`).join('')}</div>` : ''}
    ${featureLabels(p).length ? `<div class="features">${featureLabels(p).map(x=>`<span class="feature">${esc(x)}</span>`).join('')}</div>` : ''}
    <div class="sourceLine">${esc(sourceText(p))}</div>
    <div class="cardActions">
      <button class="action detail" data-id="${esc(p.id)}">Ver publicación</button>
      <button class="action whatsapp" data-id="${esc(p.id)}" ${phone?'':'disabled'}>WhatsApp</button>
      <button class="action favorite ${fav?'active':''}" data-id="${esc(p.id)}">${fav?'♥':'♡'}</button>
    </div>
  </article>`;
}

function bindCardActions(container) {
  container.querySelectorAll('.detail').forEach(btn => btn.onclick = () => openDetail(btn.dataset.id));
  container.querySelectorAll('.favorite').forEach(btn => btn.onclick = async () => {
    const nowFav = await toggleFavorite(btn.dataset.id);
    if (nowFav) favoriteIds.add(btn.dataset.id); else favoriteIds.delete(btn.dataset.id);
    btn.classList.toggle('active', nowFav);
    btn.textContent = nowFav ? '♥' : '♡';
    await refreshStatsOnly();
    if ($('#viewSaved').classList.contains('active')) renderSaved();
  });
  container.querySelectorAll('.whatsapp').forEach(btn => btn.onclick = () => {
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
}
function renderResults() {
  const box = $('#results');
  const items = currentResults.slice(0, visibleCount);
  box.innerHTML = items.length ? items.map(cardHTML).join('') : `<div class="empty">No encontré propiedades con esos filtros.</div>`;
  bindCardActions(box);
  $('#loadMore').hidden = currentResults.length <= visibleCount;
}
$('#loadMore').onclick = () => { visibleCount += 30; renderResults(); };
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
$('#closeDialog').onclick = () => $('#detailDialog').close();

async function renderSaved() {
  const box = $('#savedResults');
  const items = sortProperties(allProperties.filter(p=>favoriteIds.has(p.id)),'recent');
  $('#savedEmpty').hidden = items.length > 0;
  box.innerHTML = items.map(cardHTML).join('');
  bindCardActions(box);
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
  $('#importBtn').disabled = true;
  fileInput.disabled = true;
  $('#resultBox').hidden = true;
  setStatus('Preparando importación…');
  const worker = new Worker('./worker.js', { type: 'module' });
  const group = groupFromName(selectedFile.name);

  worker.onmessage = async (e) => {
    const m = e.data;
    if (m.type === 'status') {
      const map = { zip: 12, decode: 28, process: 48 };
      setStatus(m.bytes ? `${m.text} ${prettySize(m.bytes)}` : m.text, map[m.step] ?? null);
      return;
    }
    if (m.type === 'error') {
      setStatus(`Error: ${m.message}`, 0);
      $('#importBtn').disabled = false; fileInput.disabled = false; worker.terminate(); return;
    }
    if (m.type === 'done') {
      setStatus(`Guardando ${m.result.unique.length.toLocaleString('es-VE')} publicaciones únicas…`, 60);
      const saved = await mergeProperties(m.result.unique, (done,total) => setStatus(
        `Guardando base local… ${done.toLocaleString('es-VE')} / ${total.toLocaleString('es-VE')}`,
        60 + Math.round((done/Math.max(total,1))*35)
      ));
      const summary = {group,file_name:selectedFile.name,chat_file:m.entryName,messages:m.result.messages,
        detected:m.result.properties_detected,unique:m.result.unique.length,added:saved.added,updated:saved.updated};
      await addImport(summary);
      setStatus('Importación completada',100);
      $('#resultBox').innerHTML = `<div class="successMark">✓</div><h3>Importación completada</h3>
        <div class="summaryGrid">
        <div><b>${summary.messages.toLocaleString('es-VE')}</b><span>mensajes</span></div>
        <div><b>${summary.detected.toLocaleString('es-VE')}</b><span>publicaciones</span></div>
        <div><b>${summary.unique.toLocaleString('es-VE')}</b><span>textos únicos</span></div>
        <div><b>${summary.added.toLocaleString('es-VE')}</b><span>nuevas en base</span></div></div>`;
      $('#resultBox').hidden=false;
      $('#importBtn').disabled=false; fileInput.disabled=false; worker.terminate();
      await loadData();
    }
  };
  worker.postMessage({ file:selectedFile, group });
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
    <small>${new Date(r.imported_at).toLocaleString('es-VE')}</small></div><span>+${Number(r.added||0).toLocaleString('es-VE')}</span></div>`).join('')
    : '<p class="muted">Aún no has importado grupos.</p>';
}
async function loadData() {
  allProperties = await getAllProperties();
  favoriteIds = await getFavoriteIds();
  await refreshStatsOnly();
  await refreshRecent();
  buildZoneOptions();
  currentResults = sortProperties(allProperties,'recent');
  $('#resultCount').textContent = currentResults.length.toLocaleString('es-VE');
  $('#resultHint').textContent = 'Mostrando las más recientes';
  visibleCount=30;
  renderResults();
  if ($('#viewSaved').classList.contains('active')) renderSaved();
}
$('#resetBtn').onclick = async () => {
  if (!confirm('¿Eliminar propiedades, importaciones y guardadas de este dispositivo?')) return;
  await clearDatabase(); allProperties=[]; favoriteIds=new Set(); await loadData();
  $('#resultBox').hidden=true; $('#statusBox').hidden=true;
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
loadData();
