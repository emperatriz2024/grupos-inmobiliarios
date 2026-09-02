
import {
  mergeProperties, patchPropertyPriceAudits, findImportCheckpointByFileHash, saveImportCheckpoint, getStats, getRecentImports,
  getAllProperties, getFavoriteIds, toggleFavorite, getPropertiesByIds,
  learnContactsFromProperties, upsertContacts, getAllContacts, getContactStats,
  ensureLocationCatalogSeed, getLocationCatalog, getLocationStats, getLocationPendings, recordLocationPendings,
  linkLocationPending, createZoneFromPending, createComplexFromPending, discardLocationPending, rematchAllPropertyLocations,
  syncRadarCore, getRadarCoreStats, getMasterProperties, getAllSourcePosts, getExternalSourcePosts, getExternalSourceStats, externalUrlExists, upsertExternalCapture, updateExternalSourceVerification, refreshExternalMasterVigency,
  getBuyers, getBuyer, saveBuyer, deleteBuyer, replaceBuyerMatches, getMatchesForBuyer, getAllMatches,
  exportDatabaseSnapshot, restoreDatabaseSnapshot, backupSnapshotSummary,
  setMasterOwnership, getOwnListingDetails, saveOwnListingDetails, recordSourceAttachments,
  saveDemandRecords, getClients, getDemands, getOpportunities, getOpportunityScores, mirrorLegacyBuyersToDemands, runDemandOpportunityMatching,
  syncClientTwin,getClientTwins,getClientPropertyStates,setClientPropertyState,saveClientFollowUp,getTwinEvents,getBrokerTwinAgenda,createBrokerDraft,
  rebuildPropertyTwins,savePropertyTwinAction,savePipeline,getControlTower,
  getOwnerTwins,saveOwnerTwin,getCaptures,saveCapture,getOwnerControlTower
} from './db.js?v=0760';
import {
  matchesFilters, sortProperties, formatMoney, recencyInfo, effectivePhone,
  whatsappNumber
} from './search-utils.js?v=0530';
import { extractLocationTerms, bestZone, normLoc } from './location-utils.js?v=0530';
import { isDemandRequest } from './intent-utils.js?v=0530';
import { consolidateProperties } from './dedupe-utils.js?v=0530';
import {
  getDropboxSettings, saveDropboxSettings, startDropboxOAuth, finishDropboxOAuthIfPresent,
  disconnectDropbox as dropboxDisconnect, listPendingZips, listDropboxContactFiles, downloadDropboxFile, moveDropboxFile,
  uploadDropboxFile, redirectUri as dropboxRedirectUri
} from './dropbox.js?v=0530';
import { parseContactBlob, buildContactIndex, resolvePropertyContact, displayPhone } from './contact-utils.js?v=0530';
import { normLocation } from './location-catalog.js?v=0530';
import { BUYER_FEATURES, buyerCriteriaText, buyerWhatsAppHref } from './buyer-utils.js?v=0530';
import { legacyBuyerToClientDemand, evaluateDemandProperty } from './core/radar/demand-engine.js';
import { findMasterCandidates, candidateDecision, probableCaptorForMaster, sourceLabel } from './external-source-utils.js?v=0530';
import { extractProperty, auditExistingPropertyPrice } from './engine.js?v=0530';
import { sourceFreshness, externalFreshnessStats } from './freshness-utils.js?v=0530';
import { adapterForUrl, safeExternalUrl, sourceTypeFromUrl } from './external/adapters.js';
import { propertyDisplayName } from './core/property-policy.js';
import { diagnosticLog } from './diagnostics.js';
import { SecondaryWhatsAppSource } from './ingestion/source-ingestion.js';
import { processSecondaryEvents } from './ingestion/secondary-processing.js';
import { processZipDemandMessages } from './ingestion/demand-processing.js';
import { radarDemandEngineEnabled } from './core/radar/config.js';
import { runOperationalZipBatch, ZIP_BATCH_PHASES } from './core/operational-zip-batch.js';
import { APP_LABEL, APP_VERSION } from './version.js';
import {getWorkerInfo,startIngestionJob,getIngestionBatch,getIngestionResultChunk} from './ingestion/worker-client.js';

const $ = (q) => document.querySelector(q);
let selectedFile = null;
const demandEngineEnabled=radarDemandEngineEnabled({RADAR_DEMAND_ENGINE_ENABLED:globalThis.RADAR_DEMAND_ENGINE_ENABLED||localStorage.getItem('RADAR_DEMAND_ENGINE_ENABLED')||''});
let allProperties = [];
let favoriteIds = new Set();
let currentResults = [];
let contactIndex=buildContactIndex([]);
let contactDirectory=[];
let locationCatalog={municipalities:[],zones:[],complexes:[]};
let locationPendings=[];
let visibleCount = 30;
let selectedPropertyTypes=new Set();
let selectedMunicipalities=new Set();
let selectedZones=new Set();
let zoneCatalog=[];
let selectorMode=null;
let selectorDraft=new Set();
let buyers=[];
let allBuyerMatches=[];
let currentMatchBuyerId=null;
let buyerMatchFilter='all';
let detailReturnToBuyerMatches=null;
let detailClosingToMatches=false;
let externalDraft=null;
let externalFreshnessFilter='action';
const SEARCH_SCROLL_KEY='gi_search_scroll_v042';
const SEARCH_CARD_KEY='gi_search_card_v042';
const SEARCH_STATE_KEY='gi_search_state_v042';
const BACKUP_AUTO_KEY='gi_backup_auto_dropbox_v0502';
const BACKUP_LAST_KEY='gi_backup_last_v0502';
const BACKUP_DROPBOX_PATH='/RADAR_RESPALDOS/radar-backup-latest.json';
const SECONDARY_ENDPOINT_KEY='radar_secondary_endpoint_v061';
const SECONDARY_TOKEN_KEY='radar_secondary_token_v061_session';
const SECONDARY_CURSOR_KEY='radar_secondary_cursor_v061';
const SECONDARY_STATS_KEY='radar_secondary_stats_v061';
const INGESTION_BATCH_KEY='radar_operational_ingestion_batch_v1';
let secondarySyncing=false;

function rememberSearchPosition(cardId='') {
  try {
    sessionStorage.setItem(SEARCH_SCROLL_KEY,String(window.scrollY||0));
    if(cardId) sessionStorage.setItem(SEARCH_CARD_KEY,cardId);
    sessionStorage.setItem(SEARCH_STATE_KEY,JSON.stringify({
      visibleCount,q:$('#q')?.value||'',operation:$('#operation')?.value||'',
      propertyTypes:[...selectedPropertyTypes],municipalities:[...selectedMunicipalities],zones:[...selectedZones],residence:$('#residence')?.value||'',
      minPrice:$('#minPrice')?.value||'',maxPrice:$('#maxPrice')?.value||'',bedrooms:$('#bedrooms')?.value||'',
      bathrooms:$('#bathrooms')?.value||'',parking:$('#parking')?.value||'',minArea:$('#minArea')?.value||'',maxArea:$('#maxArea')?.value||'',
      maxAge:$('#maxAge')?.value||'',sortMode:$('#sortMode')?.value||'recent',planta100:!!$('#planta100')?.checked,
      planta:!!$('#planta')?.checked,pozo:!!$('#pozo')?.checked,tanque:!!$('#tanque')?.checked,amoblado:!!$('#amoblado')?.checked,
      financiamiento:!!$('#financiamiento')?.checked,piscina:!!$('#piscina')?.checked,onlyPhone:!!$('#onlyPhone')?.checked
    }));
  } catch {}
}

function restoreSearchFormState(){
  try{
    const s=JSON.parse(sessionStorage.getItem(SEARCH_STATE_KEY)||'null'); if(!s)return false;
    const v=(id,val)=>{const el=$('#'+id);if(el)el.value=val??'';}; const c=(id,val)=>{const el=$('#'+id);if(el)el.checked=!!val;};
    v('q',s.q);v('operation',s.operation);v('residence',s.residence);
    selectedPropertyTypes=new Set(s.propertyTypes||[]);
    selectedMunicipalities=new Set((s.municipalities||[]).filter(id=>(locationCatalog.municipalities||[]).some(m=>m.id===id)));
    selectedZones=new Set((s.zones||[]).map(v=>{
      if((locationCatalog.zones||[]).some(z=>z.id===v))return v;
      return (locationCatalog.zones||[]).find(z=>normLoc(z.nombre)===normLoc(v))?.id||null;
    }).filter(Boolean));
    v('minPrice',s.minPrice);v('maxPrice',s.maxPrice);v('bedrooms',s.bedrooms);v('bathrooms',s.bathrooms);v('parking',s.parking);v('minArea',s.minArea);v('maxArea',s.maxArea);v('maxAge',s.maxAge);v('sortMode',s.sortMode);
    c('planta100',s.planta100);c('planta',s.planta);c('pozo',s.pozo);c('tanque',s.tanque);c('amoblado',s.amoblado);c('financiamiento',s.financiamiento);c('piscina',s.piscina);c('onlyPhone',s.onlyPhone);
    visibleCount=Math.max(30,Number(s.visibleCount||30)); updateSelectorUI(); return true;
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


function annotateContactResolution(p){
  const explicit=p?.phone||(p?.sources||[]).find(s=>s?.phone)?.phone||'';
  if(explicit)return {...p,resolved_phone:'',phone_resolution:{source:'publicacion',label:'Tel. publicación'}};
  const r=resolvePropertyContact(p,contactIndex);
  if(r.status==='resolved')return {...p,resolved_phone:r.phone,phone_resolution:{source:'directorio',label:'WhatsApp · contacto',contact_name:r.contact?.display_name||r.matched_name||'',confidence:r.confidence}};
  if(r.status==='ambiguous')return {...p,resolved_phone:'',phone_resolution:{source:'ambiguo',label:'Contacto ambiguo',count:r.count}};
  return {...p,resolved_phone:'',phone_resolution:{source:'none',label:'Sin contacto'}};
}
function contactBadge(p){const x=p?.phone_resolution?.source;return x==='directorio'?'WhatsApp · contacto':x==='publicacion'?'Tel. publicación':x==='ambiguo'?'Contacto ambiguo':'Sin contacto';}

function buildWhatsAppMessage(p) {
  const summary=[propertyTitle(p),displayZone(p),p.price_usd?formatMoney(p.price_usd):null,p.area_m2?`${p.area_m2} m²`:null].filter(Boolean).join(' · ');
  const reference=(p?.external_url||p?.reference||'').trim();
  return [
    'Hola colega, ¿esta propiedad la tienes disponible actualmente?',
    '',
    summary||'Propiedad consultada en Radar Inmobiliario.',
    reference||null
  ].filter(x=>x!=null).join('\n');
}
function buildWhatsAppHref(p){
  const num=whatsappNumber(effectivePhone(p)); if(!num)return '';
  return `https://wa.me/${num}?text=${encodeURIComponent(buildWhatsAppMessage(p))}`;
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
  if (id === 'viewBuyers') refreshBuyersData();
  if (id === 'viewImport') syncSecondaryWhatsApp({silent:true});
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
function displayZone(p){ return p.zone || bestZone(p.text||'',null) || 'Zona no detectada'; }
function propertyTitle(p) { return propertyDisplayName(p); }

function sourceText(p) {
  const s = (p.sources || [])[0] || {};
  return `${s.sender || p.sender || 'Corredor'} · ${s.group || p.group || 'Grupo'} · ${p.date || ''}`;
}
function cardHTML(p) {
  const r = recencyInfo(p);
  const phone = effectivePhone(p);
  const fav = [p.id,...(p.merged_ids||[])].some(id=>favoriteIds.has(id));

  const metas = [];
  if (p.area_m2) metas.push(`${p.area_m2} m²`);
  if (p.bedrooms) metas.push(`${p.bedrooms} Hab`);
  if (p.bathrooms) metas.push(`${p.bathrooms} Baños`);
  if (p.parking) metas.push(`${p.parking} Puestos`);

  const src = (p.sources || [])[0] || {};
  const sender = src.sender || p.sender || 'Corredor';
  const group = src.group || p.group || 'Grupo';
  const original = (p.text || '').trim();
  const needsExpand = original.length > 520 || original.split('\n').length > 9;

  return `
  <article class="propertyCard propertyCardV044" data-id="${esc(p.id)}">
    <div class="cardIdentityRow">
      <div class="chips compact">
        ${p.operation ? `<span class="chip gold">${esc(p.operation)}</span>` : ''}
        ${p.property_type ? `<span class="chip">${esc(p.property_type)}</span>` : ''}
        ${(p.appearances||1)>1 ? `<span class="chip">${p.appearances} apariciones</span>` : ''}
      </div>
      <span class="recency ${r.cls}">${esc(r.label)}</span>
    </div>

    <div class="cardMainGrid">
      <div class="cardCore">
        <h3>${esc(propertyTitle(p))}</h3>
        <div class="zone">${esc(displayZone(p))}</div>
        <div class="price">${esc(formatMoney(p.price_usd))}</div>
        ${p.price_audit_status==='ambiguous'?`<div class="priceAuditFlag">△ Precio ambiguo · verificar mensaje</div>`:''}
        ${p.price_audit_status==='corrected'?`<div class="priceAuditFlag ok">✓ Precio revalidado desde el mensaje</div>`:''}
      </div>

      <div class="cardMetaColumn">
        ${metas.length ? `<div class="meta compactMeta">${metas.map(x=>`<span>${esc(x)}</span>`).join('')}</div>` : ''}
        ${featureLabels(p).length ? `<div class="features compactFeatures">${featureLabels(p).map(x=>`<span class="feature">${esc(x)}</span>`).join('')}</div>` : ''}
      </div>
    </div>

    <div class="originalInline originalInlineV044">
      <div class="originalInlineHead">
        <b>Mensaje original</b>
        <span>${esc(p.date||'')} ${esc(p.time||'')}</span>
      </div>
      <div class="originalPreview">${esc(original || 'Sin texto original disponible.')}</div>
      ${needsExpand ? `<button class="expandOriginal" data-id="${esc(p.id)}">Mostrar mensaje completo ↓</button>` : ''}
    </div>

    <div class="sourceCompact">
      <div class="sourceWho">
        <b>${esc(sender)}</b>
        <span>${esc(group)}</span>
      </div>
      ${phone ? `<span class="phoneHint ${p.phone_resolution?.source==='directorio'?'directoryPhone':''}">${esc(contactBadge(p))}</span>` : `<span class="phoneHint mutedPhone">${esc(contactBadge(p))}</span>`}
    </div>

    <div class="cardActions v044">
      <button class="action detail" data-id="${esc(p.id)}">Ficha completa</button>
      ${phone ? `<a class="action whatsapp whatsappLink" data-id="${esc(p.id)}" href="${esc(buildWhatsAppHref(p))}">WhatsApp</a>` : `<button class="action whatsapp disabled" disabled>Sin WhatsApp</button>`}
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
    await refreshStatsOnly(allProperties.length);
    if ($('#viewSaved').classList.contains('active')) renderSaved();
  });
  container.querySelectorAll('a.whatsapp').forEach(link => link.addEventListener('click',()=>rememberSearchPosition(link.dataset.id)));
}

function getFilters() {
  return {
    q: $('#q').value,
    operation: $('#operation').value,
    property_types: [...selectedPropertyTypes],
    municipality_ids: [...selectedMunicipalities],
    municipality_names: [...selectedMunicipalities].map(id=>locationCatalog.municipalities.find(m=>m.id===id)?.nombre).filter(Boolean),
    zone_ids: [...selectedZones],
    zones: [...selectedZones].map(id=>locationCatalog.zones.find(z=>z.id===id)?.nombre).filter(Boolean),
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
  ['q','operation','residence','minPrice','maxPrice','bedrooms','bathrooms','parking','minArea','maxArea','maxAge'].forEach(id => $('#'+id).value='');
  ['planta100','planta','pozo','tanque','amoblado','financiamiento','piscina','onlyPhone'].forEach(id => $('#'+id).checked=false);
  selectedPropertyTypes.clear(); selectedMunicipalities.clear(); selectedZones.clear(); updateSelectorUI();
  runSearch();
};

const PROPERTY_TYPES=['Apartamento','Townhouse','Penthouse','Casa','Terreno','Local comercial','Oficina','Galpón','Anexo'];
function allLocationTerms(p){return [...new Set([p.municipality,p.zone,p.zone_detected,p.residence,p.complex_detected,...(p.location_terms||[]),...(p.zone_matches||[]).map(x=>x.nombre),...extractLocationTerms(p.text||'',p.zone)].filter(Boolean))];}
function municipalityName(id){return locationCatalog.municipalities.find(m=>m.id===id)?.nombre||id;}
function zoneName(id){return locationCatalog.zones.find(z=>z.id===id)?.nombre||id;}
function buildZoneCatalog(){
  zoneCatalog=(locationCatalog.zones||[]).filter(z=>z.activo!==false).sort((a,b)=>{
    const ma=municipalityName(a.municipio_id),mb=municipalityName(b.municipio_id);
    return ma.localeCompare(mb,'es',{sensitivity:'base'})||a.nombre.localeCompare(b.nombre,'es',{sensitivity:'base'});
  });
  // Migrate saved old zone-name selections to canonical zone IDs.
  selectedZones=new Set([...selectedZones].map(v=>{
    if(zoneCatalog.some(z=>z.id===v))return v;
    return zoneCatalog.find(z=>normLoc(z.nombre)===normLoc(v))?.id||null;
  }).filter(Boolean));
  selectedMunicipalities=new Set([...selectedMunicipalities].filter(id=>(locationCatalog.municipalities||[]).some(m=>m.id===id&&m.activo!==false)));
  const list=$('#complexCatalogList');if(list)list.innerHTML=(locationCatalog.complexes||[]).filter(x=>x.activo!==false).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')).map(x=>`<option value="${esc(x.nombre)}"></option>`).join('');
}
function summaryText(set,empty,singular){const a=[...set];if(!a.length)return empty;if(a.length<=2)return a.join(' + ');return `${a.length} ${singular}`;}
function renderPills(containerId,set,labelFn=x=>x){
  const box=$('#'+containerId);if(!box)return;
  box.innerHTML=[...set].map(v=>`<span class="selectedPill">${esc(labelFn(v))}<button type="button" data-value="${esc(v)}">×</button></span>`).join('');
  box.querySelectorAll('button').forEach(b=>b.onclick=()=>{
    set.delete(b.dataset.value);
    if(containerId==='municipalitySelectedPills'&&set.size){
      selectedZones=new Set([...selectedZones].filter(zid=>{
        const z=locationCatalog.zones.find(z=>z.id===zid);return z&&set.has(z.municipio_id);
      }));
    }
    updateSelectorUI();rememberSearchPosition();
  });
}
function updateSelectorUI(){
  if($('#typeSelectorText'))$('#typeSelectorText').textContent=summaryText(selectedPropertyTypes,'Todos','tipos');
  if($('#municipalitySelectorText')){
    const names=new Set([...selectedMunicipalities].map(municipalityName));
    $('#municipalitySelectorText').textContent=summaryText(names,'Todos los municipios','municipios');
  }
  if($('#zoneSelectorText')){
    const names=new Set([...selectedZones].map(zoneName));
    $('#zoneSelectorText').textContent=summaryText(names,'Todas las zonas','zonas');
  }
  renderPills('typeSelectedPills',selectedPropertyTypes);
  renderPills('municipalitySelectedPills',selectedMunicipalities,municipalityName);
  renderPills('zoneSelectedPills',selectedZones,zoneName);
}
function renderSelectorOptions(){
  const q=normLoc($('#selectorSearchInput')?.value||''),box=$('#selectorOptionsList');
  if(selectorMode==='types'){
    const rows=PROPERTY_TYPES.filter(v=>!q||normLoc(v).includes(q));
    box.innerHTML=rows.length?rows.map(v=>`<label class="selectorOption"><input type="checkbox" value="${esc(v)}" ${selectorDraft.has(v)?'checked':''}><span>${esc(v)}</span></label>`).join(''):'<div class="empty">No encontré opciones.</div>';
  }else if(selectorMode==='municipalities'){
    const rows=(locationCatalog.municipalities||[]).filter(m=>m.activo!==false&&(!q||normLoc(m.nombre).includes(q)));
    box.innerHTML=rows.length?rows.map(m=>`<label class="selectorOption"><input type="checkbox" value="${esc(m.id)}" ${selectorDraft.has(m.id)?'checked':''}><span>${esc(m.nombre)}</span></label>`).join(''):'<div class="empty">No encontré municipios.</div>';
  }else{
    const allowed=selectedMunicipalities.size?new Set(selectedMunicipalities):null;
    const rows=zoneCatalog.filter(z=>(!allowed||allowed.has(z.municipio_id))&&(!q||normLoc(z.nombre+' '+(z.aliases||[]).join(' ')).includes(q)));
    const groups=new Map();
    for(const z of rows){const mn=municipalityName(z.municipio_id);if(!groups.has(mn))groups.set(mn,[]);groups.get(mn).push(z);}
    box.innerHTML=rows.length?[...groups.entries()].map(([mn,zones])=>`<div class="selectorGroupTitle">${esc(mn)}</div>${zones.map(z=>`<label class="selectorOption"><input type="checkbox" value="${esc(z.id)}" ${selectorDraft.has(z.id)?'checked':''}><span>${esc(z.nombre)}</span></label>`).join('')}`).join(''):'<div class="empty">No encontré zonas para esos municipios.</div>';
  }
  box.querySelectorAll('input').forEach(x=>x.onchange=()=>{if(x.checked)selectorDraft.add(x.value);else selectorDraft.delete(x.value);});
}
function openSelector(mode){
  selectorMode=mode;
  selectorDraft=new Set(mode==='types'?selectedPropertyTypes:mode==='municipalities'?selectedMunicipalities:selectedZones);
  $('#selectorTitle').textContent=mode==='types'?'Tipos de inmueble':mode==='municipalities'?'Municipios':'Zonas / sectores';
  $('#selectorSearchWrap').hidden=mode==='types';$('#selectorSearchInput').value='';renderSelectorOptions();$('#multiSelectorDialog').showModal();
}
$('#openTypeSelector').onclick=()=>openSelector('types');
$('#openMunicipalitySelector').onclick=()=>openSelector('municipalities');
$('#openZoneSelector').onclick=()=>openSelector('zones');
$('#closeMultiSelector').onclick=()=>$('#multiSelectorDialog').close();
$('#selectorSearchInput').oninput=()=>renderSelectorOptions();
$('#selectorClearBtn').onclick=()=>{selectorDraft.clear();renderSelectorOptions();};
$('#selectorApplyBtn').onclick=()=>{
  if(selectorMode==='types')selectedPropertyTypes=new Set(selectorDraft);
  else if(selectorMode==='municipalities'){
    selectedMunicipalities=new Set(selectorDraft);
    if(selectedMunicipalities.size)selectedZones=new Set([...selectedZones].filter(zid=>{const z=locationCatalog.zones.find(z=>z.id===zid);return z&&selectedMunicipalities.has(z.municipio_id);}));
  }else selectedZones=new Set(selectorDraft);
  updateSelectorUI();rememberSearchPosition();$('#multiSelectorDialog').close();
};

async function openDetail(id,{returnToBuyerMatches=null}={}) {
  detailReturnToBuyerMatches=returnToBuyerMatches;
  const p = allProperties.find(x=>x.id===id);
  if (!p) return;
  const master=(await getMasterProperties()).find(row=>row.id===id||(row.legacy_ids||[]).includes(id))||null;
  const own=master?await getOwnListingDetails(master.id):null;
  $('#detailType').textContent = [p.operation,p.property_type,p.zone,p.residence].filter(Boolean).join(' · ');
  $('#detailTitle').textContent = propertyTitle(p);
  const phone = effectivePhone(p);
  const grid = [
    ['Precio',formatMoney(p.price_usd)],['m²',p.area_m2||'—'],['Habitaciones',p.bedrooms||'—'],
    ['Baños',p.bathrooms||'—'],['Puestos',p.parking||'—'],['Teléfono',phone?`${displayPhone(phone)} · ${contactBadge(p)}`:'No detectado']
  ];
  $('#detailContent').innerHTML = `
    <div class="detailBody">
      <div class="detailPrice">${esc(formatMoney(p.price_usd))}</div>
      <div class="features">${featureLabels(p).map(x=>`<span class="feature">${esc(x)}</span>`).join('')}</div>
      <div class="detailGrid">${grid.map(([a,b])=>`<div><small>${esc(a)}</small><b>${esc(b)}</b></div>`).join('')}</div>
      ${phone ? `<a id="detailWhatsApp" class="primary detailWhatsAppLink" href="${esc(buildWhatsAppHref(p))}">Contactar por WhatsApp</a>` : ''}
      <h4>Publicación original</h4>
      <div class="originalText">${esc(p.text || '')}</div>
      <div class="sources"><h4>Fuentes encontradas (${(p.sources||[]).length || 1})</h4>
        ${(p.sources||[]).map(s=>`<div class="sourceItem"><b>${esc(s.sender||'Corredor')}</b><br>${esc(s.group||'Grupo')} · ${esc(s.date||'')} ${esc(s.time||'')}</div>`).join('')}
      </div>
      ${master?`<section class="ownListingPrivate" aria-label="Información privada de captación">
        <h4>INFORMACIÓN PRIVADA · Captación</h4>
        <label>Clasificación interna<select id="detailOwnershipScope"><option value="UNKNOWN">Por determinar</option><option value="OWN">Captación propia</option><option value="MARKET">Inventario mercado</option></select></label>
        <div id="detailOwnFields">
          <label>Fecha de captación<input id="ownCaptureDate" type="date" value="${esc(own?.capture_date||'')}"></label>
          <label>Acuerdo<select id="ownAgreementType"><option value="UNKNOWN">Por determinar</option><option value="EXCLUSIVE">Exclusiva</option><option value="OPEN">Abierta</option><option value="DIRECT">Directa</option></select></label>
          <label>Precio autorizado<input id="ownAuthorizedPrice" type="number" min="0" step="0.01" value="${esc(own?.authorized_price??'')}"></label>
          <label>Comisión %<input id="ownCommission" type="number" min="0" max="100" step="0.01" value="${esc(own?.commission_pct??'')}"></label>
          <label>Documentos<select id="ownDocumentsStatus"><option value="UNKNOWN">Por determinar</option><option value="PENDING">Pendientes</option><option value="PARTIAL">Parciales</option><option value="COMPLETE">Completos</option><option value="REVIEW">Revisar</option></select></label>
          <label>Autorización de medios<select id="ownMediaAuthorization"><option value="UNKNOWN">Por determinar</option><option value="AUTHORIZED">Autorizados</option><option value="NOT_AUTHORIZED">No autorizados</option><option value="PARTIAL">Parcial</option></select></label>
          <label>Notas internas<textarea id="ownInternalNotes">${esc(own?.internal_notes||'')}</textarea></label>
        </div>
        <button id="saveOwnListing" type="button" class="ghost">Guardar información privada</button><small id="ownListingStatus"></small>
      </section>`:''}
      <button id="detailBackBottom" class="detailBackBottom">← Volver a resultados</button>
    </div>`;
  if(master){
    const scope=$('#detailOwnershipScope'),fields=$('#detailOwnFields');scope.value=master.ownership_scope||'UNKNOWN';
    $('#ownAgreementType').value=own?.agreement_type||'UNKNOWN';$('#ownDocumentsStatus').value=own?.documents_status||'UNKNOWN';$('#ownMediaAuthorization').value=own?.media_authorization_status||'UNKNOWN';
    const renderOwn=()=>fields.hidden=scope.value!=='OWN';renderOwn();scope.onchange=renderOwn;
    $('#saveOwnListing').onclick=async()=>{const status=$('#ownListingStatus');try{await setMasterOwnership(master.id,scope.value);if(scope.value==='OWN')await saveOwnListingDetails({property_id:master.id,workspace_id:master.workspace_id||'local',capture_date:$('#ownCaptureDate').value||null,agreement_type:$('#ownAgreementType').value,authorized_price:$('#ownAuthorizedPrice').value?Number($('#ownAuthorizedPrice').value):null,commission_pct:$('#ownCommission').value?Number($('#ownCommission').value):null,documents_status:$('#ownDocumentsStatus').value,media_authorization_status:$('#ownMediaAuthorization').value,internal_notes:$('#ownInternalNotes').value||null});if(demandEngineEnabled){await runDemandOpportunityMatching({trigger_type:'OWNERSHIP_CHANGED',trigger_entity_id:master.id});await refreshDemandCommercialPanel();}status.textContent='Guardado localmente con confirmación manual.';}catch(error){status.textContent=`No se pudo guardar: ${error.message}`;}};
  }
  $('#detailBackBottom').onclick=async()=>{
    const context=detailReturnToBuyerMatches;detailClosingToMatches=Boolean(context);$('#detailDialog').close();detailReturnToBuyerMatches=null;
    if(context){currentMatchBuyerId=context.buyerId;buyerMatchFilter=context.filter;document.querySelectorAll('.matchFilterBtn').forEach(button=>button.classList.toggle('active',button.dataset.kind===buyerMatchFilter));$('#buyerMatchesDialog').showModal();await renderBuyerMatches();requestAnimationFrame(()=>{$('#buyerMatchesList').scrollTop=context.scrollTop;});}
    else restoreSearchPosition();
    detailClosingToMatches=false;
  };
  $('#detailDialog').showModal();
}
$('#closeDialog').onclick = () => { detailReturnToBuyerMatches=null;$('#detailDialog').close();restoreSearchPosition(); };
$('#detailDialog').addEventListener('close',()=>{if(!detailClosingToMatches&&!detailReturnToBuyerMatches)restoreSearchPosition();});

async function renderSaved() {
  const box = $('#savedResults');
  const items = sortProperties(allProperties.filter(p=>favoriteIds.has(p.id)),'recent');
  $('#savedEmpty').hidden = items.length > 0;
  box.innerHTML = items.map(cardHTML).join('');
  bindCardActions(box);
}



// ---------- Mis Compradores v0.5.1 -------------------------------------------
const BUYER_TYPES=['Apartamento','Townhouse','Casa','Penthouse','Terreno','Local comercial','Oficina','Galpón'];

function buyerEsc(v=''){return esc(v);}
function buyerSelected(containerId){
  return [...document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`)].map(x=>x.value);
}
function buyerValue(id){
  const el=$('#'+id),v=el?.value?.trim?.()??el?.value;
  return v===''||v==null?null:v;
}
function buyerNumber(id){
  const v=buyerValue(id),n=Number(v);return Number.isFinite(n)&&n>0?n:null;
}
function buyerStatusLabel(status){
  return status==='paused'?'Pausado':status==='closed'?'Cerrado':'Activo';
}
function buyerUrgencyLabel(u){return u==='alta'?'Urgente':u==='baja'?'Baja':'Media';}
function buyerMatchCategory(match={}){if(match.strict_ok||match.match_kind==='exact'||match.match_kind==='estricto'||match.tier==='excelente')return'exact';if(match.match_kind==='alternative'||match.match_kind==='alternativa'||match.tier==='alternativa')return'alternative';return'verify';}
function buyerMatchRank(match={}){return {exact:0,verify:1,alternative:2}[buyerMatchCategory(match)];}
function buyerMatchCounts(matches=[]){return matches.reduce((counts,match)=>{counts[buyerMatchCategory(match)]++;return counts;},{exact:0,verify:0,alternative:0});}

function renderBuyerTypeChecks(selected=[]){
  const set=new Set(selected||[]),box=$('#buyerTypeChecks');if(!box)return;
  box.innerHTML=BUYER_TYPES.map(t=>`<label><input type="checkbox" value="${buyerEsc(t)}" ${set.has(t)?'checked':''}> ${buyerEsc(t)}</label>`).join('');
}
function renderBuyerFeatureChecks(required=[],desired=[]){
  const req=new Set(required||[]),des=new Set(desired||[]);
  const html=set=>BUYER_FEATURES.map(([key,label])=>`<label><input type="checkbox" value="${buyerEsc(key)}" ${set.has(key)?'checked':''}> ${buyerEsc(label)}</label>`).join('');
  if($('#buyerRequiredFeatures'))$('#buyerRequiredFeatures').innerHTML=html(req);
  if($('#buyerDesiredFeatures'))$('#buyerDesiredFeatures').innerHTML=html(des);
}
function renderBuyerMunicipalities(selected=[]){
  const set=new Set(selected||[]),box=$('#buyerMunicipalityChecks');if(!box)return;
  box.innerHTML=(locationCatalog.municipalities||[]).filter(m=>m.activo!==false).map(m=>`<label><input type="checkbox" value="${buyerEsc(m.id)}" ${set.has(m.id)?'checked':''}> ${buyerEsc(m.nombre)}</label>`).join('');
  box.querySelectorAll('input').forEach(x=>x.addEventListener('change',()=>renderBuyerZones(buyerSelected('buyerZoneChecks'))));
}
function renderBuyerZones(selected=[]){
  const set=new Set(selected||[]),box=$('#buyerZoneChecks');if(!box)return;
  const munSet=new Set(buyerSelected('buyerMunicipalityChecks'));
  const q=normLoc($('#buyerZoneSearch')?.value||'');
  let zones=(locationCatalog.zones||[]).filter(z=>z.activo!==false);
  if(munSet.size)zones=zones.filter(z=>munSet.has(z.municipio_id));
  if(q)zones=zones.filter(z=>normLoc(z.nombre).includes(q));
  zones=zones.sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
  box.innerHTML=zones.map(z=>`<label><input type="checkbox" value="${buyerEsc(z.id)}" ${set.has(z.id)?'checked':''}> <span>${buyerEsc(z.nombre)}</span><small>${buyerEsc((locationCatalog.municipalities||[]).find(m=>m.id===z.municipio_id)?.nombre||'')}</small></label>`).join('');
}
function fillBuyerForm(buyer=null){
  const b=buyer||{};
  $('#buyerId').value=b.id||'';
  $('#buyerName').value=b.name||'';
  $('#buyerPhone').value=b.phone||'';
  $('#buyerUrgency').value=b.urgency||'media';
  $('#buyerStatus').value=b.status||'active';
  $('#buyerOperation').value=b.operation||'';
  $('#buyerMinPrice').value=b.min_price||'';
  $('#buyerMaxPrice').value=b.max_price||'';
  $('#buyerBudgetTolerance').value=String(b.budget_tolerance??0);
  $('#buyerAlternativesAuthorized').checked=b.alternatives_authorized!==false;
  $('#buyerMinBedrooms').value=b.min_bedrooms||'';
  $('#buyerMinBathrooms').value=b.min_bathrooms||'';
  $('#buyerMinParking').value=b.min_parking||'';
  $('#buyerMinArea').value=b.min_area||'';
  $('#buyerMaxArea').value=b.max_area||'';
  $('#buyerNotes').value=b.notes||'';
  $('#buyerDialogTitle').textContent=b.id?'Editar comprador':'Nuevo comprador';
  $('#deleteBuyerBtn').hidden=!b.id;
  $('#buyerZoneSearch').value='';
  renderBuyerTypeChecks(b.property_types||[]);
  renderBuyerFeatureChecks(b.required_features||[],b.desired_features||[]);
  renderBuyerMunicipalities(b.municipality_ids||[]);
  renderBuyerZones(b.zone_ids||[]);
}
function collectBuyerForm(){
  const name=$('#buyerName').value.trim();
  if(!name)throw new Error('Escribe el nombre del comprador.');
  const required=buyerSelected('buyerRequiredFeatures');
  const desired=buyerSelected('buyerDesiredFeatures').filter(x=>!required.includes(x));
  return {
    id:$('#buyerId').value||undefined,name,phone:$('#buyerPhone').value.trim(),
    urgency:$('#buyerUrgency').value,status:$('#buyerStatus').value,operation:$('#buyerOperation').value||null,
    property_types:buyerSelected('buyerTypeChecks'),
    municipality_ids:buyerSelected('buyerMunicipalityChecks'),
    zone_ids:buyerSelected('buyerZoneChecks'),
    min_price:buyerNumber('buyerMinPrice'),max_price:buyerNumber('buyerMaxPrice'),budget_tolerance:Number($('#buyerBudgetTolerance').value||0),alternatives_authorized:$('#buyerAlternativesAuthorized').checked,
    min_bedrooms:buyerNumber('buyerMinBedrooms'),min_bathrooms:buyerNumber('buyerMinBathrooms'),min_parking:buyerNumber('buyerMinParking'),
    min_area:buyerNumber('buyerMinArea'),max_area:buyerNumber('buyerMaxArea'),
    required_features:required,desired_features:desired,notes:$('#buyerNotes').value.trim()
  };
}

async function recalculateBuyerMatches(buyer){
  if(!buyer?.id)return 0;
  if(buyer.status==='closed'){await replaceBuyerMatches(buyer.id,[]);return 0;}
  const masters=await getMasterProperties(),demand=legacyBuyerToClientDemand(buyer).demand;
  const matches=masters.map(master=>({master,...evaluateDemandProperty(demand,master)})).filter(row=>row.classification!=='REJECTED').map(row=>({...row,score:row.ready_score,tier:row.classification==='EXACT'?'excelente':row.classification==='ALTERNATIVE'?'alternativa':'revisar',match_kind:row.classification.toLowerCase(),strict_ok:row.classification==='EXACT',recency_days:0})).sort((a,b)=>b.score-a.score);
  await replaceBuyerMatches(buyer.id,matches.map(m=>({
    master_id:m.master.id,score:m.score,tier:m.tier,match_kind:m.match_kind,strict_ok:m.strict_ok,reasons:m.reasons,gaps:m.gaps,recency_days:m.recency_days
  })));
  return matches.length;
}
async function recalculateAllBuyerMatches({silent=true}={}){
  const list=await getBuyers();
  if(!list.length)return 0;
  let total=0;
  for(const b of list)total+=await recalculateBuyerMatches(b);
  if(!silent)alert(`Matching actualizado: ${total.toLocaleString('es-VE')} coincidencias.`);
  return total;
}
async function refreshRadarBuyerCounters(){
  const s=await getRadarCoreStats();
  if($('#radarBuyerCount'))$('#radarBuyerCount').textContent=s.buyers.toLocaleString('es-VE');
  if($('#radarMatchCount'))$('#radarMatchCount').textContent=s.matches.toLocaleString('es-VE');
}
function buyerCardHTML(buyer,matches){
  const counts=buyerMatchCounts(matches);
  const whatsapp=buyerWhatsAppHref(buyer);
  const urgency=buyer.urgency||'media';
  return `<article class="buyerCard" data-id="${buyerEsc(buyer.id)}">
    <div class="buyerCardTop">
      <div>
        <div class="buyerBadges">
          <span class="buyerStatus ${buyerEsc(buyer.status||'active')}">${buyerEsc(buyerStatusLabel(buyer.status))}</span>
          <span class="buyerUrgency ${buyerEsc(urgency)}">${buyerEsc(buyerUrgencyLabel(urgency))}</span>
        </div>
        <h3>${buyerEsc(buyer.name)}</h3>
        <p>${buyerEsc(buyerCriteriaText(buyer,locationCatalog))}</p>
      </div>
      <div class="buyerMatchNumber"><strong>${counts.exact.toLocaleString('es-VE')}</strong><span>compatibles</span><small>${counts.verify} por verificar · ${counts.alternative} alternativas</small></div>
    </div>
    <div class="buyerMatchBands">
      <span><b>${counts.exact}</b> Compatibles</span><span><b>${counts.verify}</b> Por verificar</span><span><b>${counts.alternative}</b> Alternativas</span>
      ${buyer.max_price?`<span><b>$${Number(buyer.max_price).toLocaleString('es-VE')}</b> tope</span>`:''}
    </div>
    ${buyer.notes?`<div class="buyerNotesPreview">${buyerEsc(buyer.notes.slice(0,180))}${buyer.notes.length>180?'…':''}</div>`:''}
    <div class="buyerCardActions">
      <button class="buyerMatchesBtn primary" data-id="${buyerEsc(buyer.id)}">Ver coincidencias</button>
      <button class="buyerTwinBtn ghost" data-id="${buyerEsc(buyer.id)}">Client Twin</button>
      <button class="buyerEditBtn ghost" data-id="${buyerEsc(buyer.id)}">Editar</button>
      ${whatsapp?`<a class="buyerWhatsappBtn ghost" href="${buyerEsc(whatsapp)}">WhatsApp</a>`:''}
    </div>
  </article>`;
}
async function refreshBuyersData(){
  buyers=await getBuyers();allBuyerMatches=await getAllMatches();
  await Promise.all(buyers.map(b=>syncClientTwin(b)));
  const active=buyers.filter(b=>b.status==='active').length;
  const hot=buyers.filter(b=>b.status==='active'&&b.urgency==='alta').length;
  if($('#buyersActiveCount'))$('#buyersActiveCount').textContent=active.toLocaleString('es-VE');
  if($('#buyersHotCount'))$('#buyersHotCount').textContent=hot.toLocaleString('es-VE');
  if($('#buyersMatchesCount'))$('#buyersMatchesCount').textContent=allBuyerMatches.length.toLocaleString('es-VE');
  renderBuyersList();
  await renderBrokerTwin();
  await renderControlTower();
  await renderOwnerOperations();
  if(demandEngineEnabled)await refreshDemandCommercialPanel();
}
async function renderBrokerTwin(){
  const box=$('#brokerTwinList');if(!box)return;const agenda=await getBrokerTwinAgenda();$('#brokerTwinCount').textContent=String(agenda.length);
  box.innerHTML=agenda.slice(0,20).map(item=>`<article class="brokerAction"><div><b>${buyerEsc(item.title)}</b><p>${buyerEsc(item.why)}</p></div><button class="brokerOpenBuyer ghost" data-buyer="${buyerEsc(item.buyer_id)}">Abrir</button></article>`).join('')||'<div class="empty">Sin acciones comerciales pendientes.</div>';
  box.querySelectorAll('.brokerOpenBuyer').forEach(btn=>btn.onclick=()=>openClientTwin(btn.dataset.buyer));
}
async function renderControlTower(){const box=$('#controlTowerList');if(!box)return;const [clientRows,ownerRows]=await Promise.all([getControlTower(),getOwnerControlTower()]),rows=[...clientRows,...ownerRows].sort((a,b)=>b.priority-a.priority);$('#controlTowerCount').textContent=String(rows.length);box.innerHTML=rows.slice(0,30).map(x=>`<article class="brokerAction"><div><b>${buyerEsc(x.title)}</b><p>${buyerEsc(x.why)}</p></div><span>${x.priority}</span></article>`).join('')||'<div class="empty">No hay acciones pendientes para hoy.</div>';}

async function renderOwnerOperations(){const box=$('#ownerOperationsList');if(!box)return;const [owners,captures,actions]=await Promise.all([getOwnerTwins(),getCaptures(),getOwnerControlTower()]);$('#ownerOperationsCount').textContent=String(actions.length);box.innerHTML=[...actions.slice(0,8).map(x=>`<article class="brokerAction"><div><b>${buyerEsc(x.title)}</b><p>${buyerEsc(x.why)}</p></div><span>${x.priority}</span></article>`),...owners.map(o=>`<article class="brokerAction"><div><b>${buyerEsc(o.confirmed?.name||'Propietario pendiente')}</b><p>${o.property_ids.length} propiedad(es) · ${buyerEsc(captures.find(c=>c.owner_id===o.id)?.stage||'Sin captacion')}</p></div><span>${buyerEsc(o.contact?.consent||'UNKNOWN')}</span></article>`)].join('')||'<div class="empty">No hay propietarios registrados.</div>';}

$('#newOwnerBtn')?.addEventListener('click',()=>{$('#ownerCaptureForm').reset();$('#ownerResponsible').value='Emperatriz';$('#ownerCaptureDialog').showModal();});
$('#closeOwnerCaptureDialog')?.addEventListener('click',()=>$('#ownerCaptureDialog').close());
$('#ownerCaptureForm')?.addEventListener('submit',async e=>{e.preventDefault();const propertyId=$('#ownerPropertyId').value.trim(),owner=await saveOwnerTwin({name:$('#ownerName').value.trim(),phone:$('#ownerPhone').value.trim(),email:$('#ownerEmail').value.trim(),relationship:$('#ownerRelationship').value,motivation:$('#ownerMotivation').value.trim(),urgency:$('#ownerUrgency').value,expected_price:Number($('#ownerExpectedPrice').value)||null,recommended_price:Number($('#ownerRecommendedPrice').value)||null,negotiation_flexibility:$('#ownerFlexibility').value.trim(),consent_status:$('#ownerConsent').value,contact_restrictions:$('#ownerRestrictions').value.split(',').map(x=>x.trim()).filter(Boolean),documents_available:$('#ownerDocumentsAvailable').value.split(',').map(x=>x.trim()).filter(Boolean),documents_pending:$('#ownerDocumentsPending').value.split(',').map(x=>x.trim()).filter(Boolean),property_ids:propertyId?[propertyId]:[],next_action:$('#ownerNextAction').value.trim(),next_action_at:$('#ownerDueAt').value?new Date($('#ownerDueAt').value).toISOString():null,last_interaction_at:new Date().toISOString()});if(propertyId)await saveCapture({owner_id:owner.id,property_id:propertyId,stage:$('#ownerCaptureStage').value,owner:$('#ownerResponsible').value.trim()||'Emperatriz',next_action:$('#ownerNextAction').value.trim(),due_at:$('#ownerDueAt').value?new Date($('#ownerDueAt').value).toISOString():null,notes:$('#ownerNotes').value.trim(),loss_reason:$('#ownerLossReason').value.trim()});$('#ownerCaptureDialog').close();await renderOwnerOperations();await renderControlTower();});
function resolveDemandTerritory(text=''){
  const haystack=normLoc(text),rows=[...(locationCatalog.zones||[]),...(locationCatalog.municipalities||[])].map(row=>({id:row.id,name:row.nombre||row.name||''})).filter(row=>row.name&&haystack.includes(normLoc(row.name))).sort((a,b)=>b.name.length-a.name.length);
  return rows[0]?{id:rows[0].id,query:rows[0].name}:null;
}
async function refreshDemandCommercialPanel(){
  const panel=$('#demandCommercialPanel');if(!panel||!demandEngineEnabled)return;panel.hidden=false;
  const [clients,demands,opportunities,scores,masters]=await Promise.all([getClients(),getDemands(),getOpportunities(),getOpportunityScores(),getMasterProperties()]),scoreByOpportunity=new Map();
  for(const score of scores){const old=scoreByOpportunity.get(score.opportunity_id);if(!old||String(score.created_at)>String(old.created_at))scoreByOpportunity.set(score.opportunity_id,score);}
  const market=demands.filter(row=>row.origin==='MARKET'),active=opportunities.filter(row=>row.status==='ACTIVE');
  $('#demandCommercialSummary').innerHTML=`<div><strong>${clients.length}</strong><span>clientes</span></div><div><strong>${demands.length}</strong><span>demandas</span></div><div><strong>${active.length}</strong><span>oportunidades</span></div>`;
  const demandCard=row=>`<article class="buyerCard"><div class="buyerCardTop"><div><h3>${buyerEsc(row.origin==='CLIENT'?'Demanda cliente':'Solicitud mercado')}</h3><p>${buyerEsc(row.raw_text||buyerCriteriaText(row,locationCatalog))}</p></div><span class="buyerStatus active">${buyerEsc(row.status)}</span></div></article>`;
  $('#clientDemandList').innerHTML=demands.filter(row=>row.origin==='CLIENT').map(demandCard).join('')||'<div class="empty">Sin demandas CLIENT.</div>';
  $('#marketDemandList').innerHTML=market.map(demandCard).join('')||'<div class="empty">Sin solicitudes MARKET.</div>';
  const demandMap=new Map(demands.map(row=>[row.id,row])),masterMap=new Map(masters.map(row=>[row.id,row]));
  $('#opportunityList').innerHTML=opportunities.map(row=>{const score=scoreByOpportunity.get(row.id)||{},demand=demandMap.get(row.demand_id),buyer=buyers.find(item=>item.id===demand?.legacy_buyer_id),master=masterMap.get(row.property_id),from=buyer?.name||(demand?.origin==='MARKET'?'Solicitud de mercado':'Comprador'),to=master?.residence||master?.property_type||'Propiedad';return `<article class="buyerMatchCard"><div class="matchScore ${row.status==='ACTIVE'?'excelente':'alternativa'}"><strong>${buyerEsc(row.classification||row.status)}</strong><span>${buyerEsc(row.opportunity_type)}</span></div><div class="matchMain"><p>${buyerEsc(from)} → ${buyerEsc(to)}</p><div class="matchMeta"><span>Fit ${Number(score.fit_score||0)}</span><span>Evidence ${Number(score.evidence_score||0)}</span><span>Availability ${Number(score.availability_score||0)}</span><span>Ready ${Number(score.ready_score||0)}</span></div><div class="matchReasons">${(row.reasons||[]).map(x=>`<span>✓ ${buyerEsc(x)}</span>`).join('')}</div><div class="matchGaps">${[...(row.gaps||[]),...(row.conflicts||[])].map(x=>`<span>△ ${buyerEsc(x)}</span>`).join('')}</div></div></article>`;}).join('')||'<div class="empty">Sin oportunidades.</div>';
}
function renderBuyersList(){
  const box=$('#buyersList');if(!box)return;
  const q=normLoc($('#buyerSearchInput')?.value||''),status=$('#buyerStatusFilter')?.value||'';
  const rows=buyers.filter(b=>(!status||b.status===status)&&(!q||normLoc(`${b.name} ${b.phone} ${b.notes||''}`).includes(q)));
  $('#buyersEmpty').hidden=rows.length>0;
  box.innerHTML=rows.map(b=>buyerCardHTML(b,allBuyerMatches.filter(m=>m.buyer_id===b.id))).join('');
  box.querySelectorAll('.buyerMatchesBtn').forEach(btn=>btn.onclick=()=>openBuyerMatches(btn.dataset.id));
  box.querySelectorAll('.buyerEditBtn').forEach(btn=>btn.onclick=async()=>openBuyerDialog(await getBuyer(btn.dataset.id)));
  box.querySelectorAll('.buyerTwinBtn').forEach(btn=>btn.onclick=()=>openClientTwin(btn.dataset.id));
}
async function openClientTwin(buyerId){
  const [buyer,twins,states,events,masters]=await Promise.all([getBuyer(buyerId),getClientTwins(),getClientPropertyStates(buyerId),getTwinEvents(buyerId),getMasterProperties()]);if(!buyer)return;
  const twin=twins.find(x=>x.buyer_id===buyerId)||await syncClientTwin(buyer),masterMap=new Map(masters.map(x=>[x.id,x]));$('#clientTwinBuyerId').value=buyerId;$('#clientTwinTitle').textContent=buyer.name;$('#clientTwinIntent').value=twin.intent||'BUSCANDO';$('#clientTwinNextAction').value=twin.next_action||'';$('#clientTwinNextAt').value=twin.next_action_at?String(twin.next_action_at).slice(0,16):'';
  $('#clientTwinRequirements').innerHTML=`<b>Obligatorios</b><p>${buyerEsc([...(twin.mandatory.property_types||[]),twin.mandatory.max_price?`Hasta $${Number(twin.mandatory.max_price).toLocaleString('es-VE')}`:null].filter(Boolean).join(' · ')||'Sin requisitos definidos')}</p><b>Preferencias</b><p>${buyerEsc((twin.preferences.features||[]).join(' · ')||'Sin preferencias')}</p>`;
  $('#clientTwinPropertyHistory').innerHTML=states.map(s=>`<article><b>${buyerEsc(masterMap.get(s.property_id)?.residence||masterMap.get(s.property_id)?.property_type||'Propiedad')}</b><span>${buyerEsc(s.status)}</span>${s.reason?`<p>${buyerEsc(s.reason)}</p>`:''}</article>`).join('')||'<div class="empty">Sin propiedades revisadas todavía.</div>';
  $('#clientTwinTimeline').innerHTML=events.slice(0,12).map(e=>`<li><b>${buyerEsc(e.event_type.replaceAll('_',' '))}</b><small>${buyerEsc(new Date(e.occurred_at).toLocaleString('es-VE'))}</small></li>`).join('');const selected=states.filter(s=>s.status==='SELECTED').map(s=>s.property_id);$('#clientTwinDraft').disabled=!selected.length;$('#clientTwinDraft').dataset.properties=selected.join(',');$('#clientTwinDialog').showModal();
}
async function openBuyerDialog(buyer=null){
  fillBuyerForm(buyer);$('#buyerDialog').showModal();
}
function matchTierLabel(t){
  return t==='excelente'?'Cumple criterios':t==='alternativa'?'Alternativa':'Por verificar';
}
function masterMatchCard(master,match){
  const metas=[];
  if(master.area_m2)metas.push(`${master.area_m2} m²`);
  if(master.bedrooms)metas.push(`${master.bedrooms} Hab`);
  if(master.bathrooms)metas.push(`${master.bathrooms} Baños`);
  if(master.parking)metas.push(`${master.parking} Puestos`);
  const category=buyerMatchCategory(match),score=category==='verify'?`<strong>POR VERIFICAR</strong><small>Score orientativo ${match.score}%</small>`:`<strong>${match.score}%</strong><span>${buyerEsc(matchTierLabel(match.tier))}</span>`;
  return `<article class="buyerMatchCard" data-master="${buyerEsc(master.id)}">
    <div class="matchScore ${buyerEsc(match.tier)}">${score}</div>
    <div class="matchMain">
      <div class="matchTitleRow"><div><h3>${buyerEsc(master.residence||master.property_type||'Inmueble')}</h3><p>${buyerEsc([master.zone,master.municipality].filter(Boolean).join(' · ')||'Ubicación por revisar')}</p></div><b>${buyerEsc(formatMoney(master.price_usd))}</b></div>
      ${metas.length?`<div class="matchMeta">${metas.map(x=>`<span>${buyerEsc(x)}</span>`).join('')}</div>`:''}
      <div class="matchReasons">${(match.reasons||[]).slice(0,6).map(x=>`<span>✓ ${buyerEsc(x)}</span>`).join('')}</div>
      ${(match.gaps||[]).length?`<div class="matchGaps">${match.gaps.slice(0,3).map(x=>`<span>△ ${buyerEsc(x)}</span>`).join('')}</div>`:''}
      <button class="viewMatchedProperty ghost" data-master="${buyerEsc(master.id)}">Ver propiedad</button>
      <button class="viewPropertyTwin ghost" data-master="${buyerEsc(master.id)}">Property Twin</button>
    </div>
  </article>`;
}
async function renderBuyerMatches(){
  const list=$('#buyerMatchesList');if(!list||!currentMatchBuyerId)return;
  const buyer=buyers.find(b=>b.id===currentMatchBuyerId)||await getBuyer(currentMatchBuyerId);
  const allRaw=await getMatchesForBuyer(currentMatchBuyerId),states=await getClientPropertyStates(currentMatchBuyerId),stateMap=new Map(states.map(x=>[x.property_id,x]));
  const masters=await getMasterProperties(),map=new Map(masters.map(m=>[m.id,m])),all=allRaw.filter(match=>{const state=stateMap.get(match.master_id),master=map.get(match.master_id);if(buyer?.alternatives_authorized===false&&buyerMatchCategory(match)==='alternative')return false;return !state||state.status!=='DISCARDED'||(master?.updated_at&&String(master.updated_at)>String(state.updated_at));}),matches=all.filter(match=>buyerMatchFilter==='all'||buyerMatchCategory(match)===buyerMatchFilter).sort((a,b)=>buyerMatchRank(a)-buyerMatchRank(b)||Number(b.score||0)-Number(a.score||0));
  const rows=matches.map(m=>({m,master:map.get(m.master_id)})).filter(x=>x.master);
  list.innerHTML=rows.length?rows.map(x=>masterMatchCard(x.master,x.m)).join(''):'<div class="empty">No hay coincidencias con este umbral.</div>';
  list.querySelectorAll('.buyerMatchCard').forEach(card=>{const id=card.dataset.master,actions=document.createElement('div');actions.className='twinPropertyActions';actions.innerHTML='<button data-state="REVIEWED" class="ghost">Revisada</button><button data-state="SELECTED" class="ghost">Seleccionar</button><button data-state="DISCARDED" class="ghost">Descartar</button>';actions.querySelectorAll('button').forEach(btn=>btn.onclick=async()=>{const status=btn.dataset.state,reason=status==='DISCARDED'?prompt('Motivo del descarte:','No cumple la necesidad actual'):null;if(status==='DISCARDED'&&reason===null)return;await setClientPropertyState({buyer_id:currentMatchBuyerId,property_id:id,status,reason});await renderBuyerMatches();await renderBrokerTwin();});card.querySelector('.matchMain')?.append(actions);});
  list.querySelectorAll('.viewMatchedProperty').forEach(btn=>btn.onclick=()=>{
    const master=map.get(btn.dataset.master);if(!master)return;
    const ids=new Set(master.legacy_ids||[]);
    const p=allProperties.find(x=>ids.has(x.id)||(x.merged_ids||[]).some(id=>ids.has(id)));
    if(!p)return alert('La ficha original ya no está disponible en el inventario vigente.');
    const context={buyerId:currentMatchBuyerId,filter:buyerMatchFilter,scrollTop:list.scrollTop};$('#buyerMatchesDialog').close();showView('viewSearch');openDetail(p.id,{returnToBuyerMatches:context});
  });
  list.querySelectorAll('.viewPropertyTwin').forEach(btn=>btn.onclick=()=>openPropertyTwin(btn.dataset.master));
  const counts=buyerMatchCounts(all);
  $('#buyerMatchesSummary').innerHTML=`<div><strong>${counts.exact}</strong><span>Compatibles</span></div><div><strong>${counts.verify}</strong><span>Por verificar</span></div><div><strong>${counts.alternative}</strong><span>Alternativas</span></div>`;
  $('#buyerMatchesTitle').textContent=buyer?.name||'Coincidencias';
}
async function openPropertyTwin(propertyId){const twins=await rebuildPropertyTwins(),t=twins.find(x=>x.property_id===propertyId);if(!t)return;$('#propertyTwinId').value=propertyId;$('#propertyTwinTitle').textContent=t.confirmed.property_type||'Propiedad';$('#propertyTwinBody').innerHTML=`<p><b>Confirmado:</b> ${buyerEsc(Object.entries(t.confirmed).map(([k,v])=>`${k}: ${v}`).join(' · '))}</p><p><b>Pendiente:</b> ${buyerEsc(t.pending.join(' · ')||'Ninguno')}</p><p><b>Desconocido:</b> ${buyerEsc(t.unknown.join(' · ')||'Ninguno')}</p><p><b>Fuentes:</b> ${t.source_ids.length} · <b>Compradores:</b> ${t.buyer_links.length}</p>`;$('#propertyTwinNextAction').value=t.next_action||'';$('#propertyTwinNextAt').value=t.next_action_at?String(t.next_action_at).slice(0,16):'';$('#propertyTwinDialog').showModal();}
async function openBuyerMatches(buyerId){
  currentMatchBuyerId=buyerId;buyerMatchFilter='all';
  document.querySelectorAll('.matchFilterBtn').forEach(b=>b.classList.toggle('active',b.dataset.kind==='all'));
  $('#buyerMatchesDialog').showModal();await renderBuyerMatches();
}

$('#newBuyerBtn')?.addEventListener('click',()=>openBuyerDialog());
$('#closeBuyerDialog')?.addEventListener('click',()=>$('#buyerDialog').close());
$('#closeBuyerMatchesDialog')?.addEventListener('click',()=>$('#buyerMatchesDialog').close());
$('#closeClientTwinDialog')?.addEventListener('click',()=>$('#clientTwinDialog').close());
$('#clientTwinFollowForm')?.addEventListener('submit',async e=>{e.preventDefault();const id=$('#clientTwinBuyerId').value;await saveClientFollowUp(id,{intent:$('#clientTwinIntent').value,next_action:$('#clientTwinNextAction').value.trim(),next_action_at:$('#clientTwinNextAt').value?new Date($('#clientTwinNextAt').value).toISOString():null});await openClientTwin(id);await renderBrokerTwin();});
$('#clientTwinDraft')?.addEventListener('click',async()=>{const id=$('#clientTwinBuyerId').value,properties=($('#clientTwinDraft').dataset.properties||'').split(',').filter(Boolean),draft=await createBrokerDraft(id,properties);$('#clientTwinDraftText').value=draft.message;});
$('#closePropertyTwinDialog')?.addEventListener('click',()=>$('#propertyTwinDialog').close());
$('#propertyTwinForm')?.addEventListener('submit',async e=>{e.preventDefault();await savePropertyTwinAction($('#propertyTwinId').value,{next_action:$('#propertyTwinNextAction').value.trim(),next_action_at:$('#propertyTwinNextAt').value?new Date($('#propertyTwinNextAt').value).toISOString():null});$('#propertyTwinDialog').close();await renderControlTower();});
$('#clientPipelineForm')?.addEventListener('submit',async e=>{e.preventDefault();const buyer_id=$('#clientTwinBuyerId').value,property_id=($('#clientTwinDraft').dataset.properties||'').split(',').filter(Boolean)[0]||null,stage=$('#clientPipelineStage').value;await savePipeline({buyer_id,property_id,stage,owner:$('#clientPipelineOwner').value.trim()||'Emperatriz',next_action:$('#clientTwinNextAction').value.trim(),next_action_at:$('#clientTwinNextAt').value?new Date($('#clientTwinNextAt').value).toISOString():null,loss_reason:stage==='LOST'?$('#clientPipelineLossReason').value.trim():null});await renderControlTower();});
$('#buyerZoneSearch')?.addEventListener('input',()=>renderBuyerZones(buyerSelected('buyerZoneChecks')));
$('#buyerSearchInput')?.addEventListener('input',renderBuyersList);
$('#buyerStatusFilter')?.addEventListener('change',renderBuyersList);
document.querySelectorAll('.matchFilterBtn').forEach(btn=>btn.addEventListener('click',async()=>{
  buyerMatchFilter=btn.dataset.kind||'all';
  document.querySelectorAll('.matchFilterBtn').forEach(b=>b.classList.toggle('active',b===btn));
  await renderBuyerMatches();
}));
$('#buyerForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    const currentId=$('#buyerId').value||null,existing=currentId?await getBuyer(currentId):null;
    const row=await saveBuyer({...existing,...collectBuyerForm()});
    await syncClientTwin(row);
    if(demandEngineEnabled){await mirrorLegacyBuyersToDemands();await runDemandOpportunityMatching({trigger_type:'CLIENT_DEMAND_CHANGED',trigger_entity_id:`demand_client_${row.id}`});}
    $('#saveBuyerBtn').disabled=true;$('#saveBuyerBtn').textContent='Calculando coincidencias…';
    await recalculateBuyerMatches(row);
    $('#buyerDialog').close();
    await refreshBuyersData();await refreshRadarBuyerCounters();
    await maybeAutoBackup();
    if(row.status!=='closed')await openBuyerMatches(row.id);
  }catch(err){alert(err.message);}
  finally{$('#saveBuyerBtn').disabled=false;$('#saveBuyerBtn').textContent='Guardar y calcular matches';}
});
$('#deleteBuyerBtn')?.addEventListener('click',async()=>{
  const id=$('#buyerId').value;if(!id)return;
  const b=await getBuyer(id);
  if(!confirm(`¿Eliminar a ${b?.name||'este comprador'} y sus coincidencias?`))return;
  await deleteBuyer(id);$('#buyerDialog').close();await refreshBuyersData();await refreshRadarBuyerCounters();await maybeAutoBackup();
});



// ---------- Fuentes externas v0.5.2 ------------------------------------------
function isoToday(){return new Date().toISOString().slice(0,10);}
function extEsc(v=''){return esc(v);}
function extSafeLink(v=''){return safeExternalUrl(v)||'';}
function externalAgeDays(dateStr){
  const t=Date.parse(dateStr||'');if(!Number.isFinite(t))return null;
  const today=new Date();today.setHours(0,0,0,0);
  const d=new Date(t);d.setHours(0,0,0,0);
  return Math.max(0,Math.floor((today-d)/86400000));
}

function parseExternalListedPrice(raw=''){
  const s=String(raw||'').trim();
  if(!s)return null;
  let x=s.replace(/[^\d.,]/g,'').trim();
  if(!x)return null;
  // Venezuelan/LatAm marketplace formatting often uses "." as thousands.
  if(/^\d{1,3}(?:\.\d{3})+$/.test(x))x=x.replace(/\./g,'');
  else if(/^\d{1,3}(?:,\d{3})+$/.test(x))x=x.replace(/,/g,'');
  else if(x.includes(',')&&!x.includes('.'))x=x.replace(',','.');
  const n=Number(x);
  return Number.isFinite(n)&&n>0?n:null;
}
function externalCombinedText(){
  const title=$('#externalTitle')?.value.trim()||'';
  const desc=$('#externalText').value.trim();
  return [title,desc].filter(Boolean).join('\n');
}

function externalPseudoMessage(){
  const date=$('#externalPublishedDate').value||isoToday();
  return {
    group:`Fuente externa · ${sourceLabel($('#externalSourceType').value)}`,
    date,date_iso:date,date_order:'YMD',time:'12:00:00',
    sender:$('#externalAgentName').value.trim()||sourceLabel($('#externalSourceType').value),
    text:externalCombinedText()
  };
}

function externalEvidenceHtml(p={}){
  const labels=[
    ['price_usd','Precio',p.price_usd?formatMoney(p.price_usd):'No detectado'],
    ['area_m2','Metraje',p.area_m2?`${p.area_m2} m²`:'No detectado'],
    ['bedrooms','Habitaciones',p.bedrooms!=null?String(p.bedrooms):'No detectado'],
    ['bathrooms','Baños',p.bathrooms!=null?String(p.bathrooms):'No detectado'],
    ['parking','Puestos',p.parking!=null?String(p.parking):'No detectado']
  ];
  return labels.map(([key,label,value])=>{
    const ev=p.extraction_evidence?.[key]||null;
    const conf=p.extraction_confidence?.[key]||'missing';
    const cls=conf==='high'?'high':conf==='medium'?'medium':'missing';
    return `<div class="evidenceRow ${cls}">
      <div><b>${extEsc(label)}: ${extEsc(value)}</b><span>${conf==='high'?'alta confianza':conf==='medium'?'confianza media':'sin evidencia'}</span></div>
      <small>${ev?`← “${extEsc(ev)}”`:'No se encontró una línea explícita para este dato.'}</small>
    </div>`;
  }).join('');
}

function externalFactsHtml(p={}){
  const facts=[
    p.operation,p.property_type,p.municipality,p.zone,p.residence,
    p.price_usd?formatMoney(p.price_usd):null,
    p.area_m2?`${p.area_m2} m²`:null,
    p.bedrooms?`${p.bedrooms} Hab`:null,
    p.bathrooms?`${p.bathrooms} Baños`:null,
    p.parking?`${p.parking} Puestos`:null
  ].filter(Boolean);
  return facts.map(x=>`<span>${extEsc(x)}</span>`).join('');
}
function masterShortName(m={}){return propertyDisplayName(m)||'Inmueble maestro';}
function masterShortMeta(m={}){
  return [m.zone,m.municipality,m.price_usd?formatMoney(m.price_usd):null,m.area_m2?`${m.area_m2} m²`:null].filter(Boolean).join(' · ');
}
async function refreshExternalSourcesUI(){
  const stats=await getExternalSourceStats();
  if($('#externalTotalCount'))$('#externalTotalCount').textContent=stats.total.toLocaleString('es-VE');
  if($('#externalInstagramCount'))$('#externalInstagramCount').textContent=stats.instagram.toLocaleString('es-VE');
  if($('#externalMarketplaceCount'))$('#externalMarketplaceCount').textContent=stats.marketplace.toLocaleString('es-VE');
  if($('#externalPortalCount'))$('#externalPortalCount').textContent=stats.portals.toLocaleString('es-VE');

  const allRows=await getExternalSourcePosts();
  const rows=allRows.slice(0,12),box=$('#externalRecentList');
  if(box)box.innerHTML=rows.length?rows.map(r=>`<article class="externalRecentItem">
    <div><b>${extEsc(sourceLabel(r.source_type))}</b><strong>${extEsc(r.external_title||r.observed_residence||'Propiedad')}</strong><small>${extEsc([r.agent_name,r.published_at?.slice(0,10),r.observed_price?formatMoney(r.observed_price):(r.listed_price_value?`${Number(r.listed_price_value).toLocaleString('es-VE')} ${r.listed_price_currency||''}`:null)].filter(Boolean).join(' · '))}</small></div>
    ${extSafeLink(r.external_url)?`<a href="${extEsc(extSafeLink(r.external_url))}" target="_blank" rel="noopener noreferrer">Abrir</a>`:''}
  </article>`).join(''):'<div class="empty externalEmpty">Todavía no has guardado publicaciones externas.</div>';

  renderExternalFreshness(allRows);
}

function renderExternalFreshness(rows=[]){
  const stats=externalFreshnessStats(rows);
  if($('#freshVerified'))$('#freshVerified').textContent=stats.verified.toLocaleString('es-VE');
  if($('#freshRecent'))$('#freshRecent').textContent=stats.recent.toLocaleString('es-VE');
  if($('#freshAction'))$('#freshAction').textContent=stats.action.toLocaleString('es-VE');
  if($('#freshExpired'))$('#freshExpired').textContent=stats.expired.toLocaleString('es-VE');

  document.querySelectorAll('[data-fresh-filter]').forEach(b=>b.classList.toggle('active',b.dataset.freshFilter===externalFreshnessFilter));
  const list=$('#externalFreshnessList');if(!list)return;
  const enriched=rows.map(r=>({r,f:sourceFreshness(r)}));
  let filtered=enriched;
  if(externalFreshnessFilter==='action')filtered=enriched.filter(x=>['verify','expired'].includes(x.f.code));
  else if(externalFreshnessFilter==='verified')filtered=enriched.filter(x=>x.f.code==='verified');
  else if(externalFreshnessFilter==='expired')filtered=enriched.filter(x=>x.f.code==='expired');
  filtered=filtered.slice(0,30);

  list.innerHTML=filtered.length?filtered.map(({r,f})=>`<article class="freshnessItem" data-source-id="${extEsc(r.id)}">
    <div class="freshnessItemHead">
      <div>
        <b>${extEsc(sourceLabel(r.source_type))}</b>
        <strong>${extEsc(r.external_title||r.observed_residence||'Propiedad externa')}</strong>
        <small>${extEsc([r.publisher_name||r.agent_name,`${f.publishedDays} días desde publicación`,r.last_verified_at?`verificada hace ${f.verifiedDays} días`:null].filter(Boolean).join(' · '))}</small>
      </div>
      <span class="freshBadge ${f.className}">${extEsc(f.label)}</span>
    </div>
    <div class="freshnessActions">
      ${!['unavailable','sold'].includes(f.code)?`<button class="confirmFresh" data-fresh-action="verified" data-source-id="${extEsc(r.id)}">✓ Confirmar vigente</button>`:`<button data-fresh-action="unverified" data-source-id="${extEsc(r.id)}">↻ Reactivar revisión</button>`}
      <button class="markUnavailable" data-fresh-action="unavailable" data-source-id="${extEsc(r.id)}">No disponible</button>
      ${extSafeLink(r.external_url)?`<a href="${extEsc(extSafeLink(r.external_url))}" target="_blank" rel="noopener noreferrer">Abrir publicación</a>`:'<span></span>'}
    </div>
  </article>`).join(''):'<div class="freshnessEmpty">No hay publicaciones en esta categoría.</div>';
}

async function analyzeExternalCapture(){
  const description=$('#externalText').value.trim();
  const text=externalCombinedText();
  if(text.length<25)return alert('Pega el título y/o la descripción completa de la publicación.');
  const rawUrl=$('#externalUrl').value.trim();
  const url=rawUrl?safeExternalUrl(rawUrl):'';
  if(rawUrl&&!url)return alert('El enlace no es una URL HTTP/HTTPS válida.');
  if(url){
    const dup=await externalUrlExists(url);
    if(dup&&!confirm('Ese enlace ya fue guardado antes. ¿Quieres analizarlo nuevamente?'))return;
  }
  const msg=externalPseudoMessage();
  const parsed=extractProperty(msg,{locationCatalog});
  if(!parsed)return alert('Radar no detectó una publicación inmobiliaria clara en ese texto.');

  const listedPriceRaw=$('#externalListedPrice')?.value.trim()||'';
  const listedPriceValue=parseExternalListedPrice(listedPriceRaw);
  const listedCurrency=$('#externalPriceCurrency')?.value||'UNVERIFIED';

  parsed.listed_price_raw=listedPriceRaw||null;
  parsed.listed_price_value=listedPriceValue;
  parsed.price_currency=listedCurrency;

  // Only a user-confirmed USD value becomes the comparable commercial price.
  // Otherwise we preserve the platform-listed amount without pretending it is USD.
  if(listedPriceValue&&listedCurrency==='USD'){
    parsed.price_usd=listedPriceValue;
    parsed.price_confidence='high';
    parsed.price_audit_status='external_verified';
    parsed.price_evidence=`Precio publicado (confirmado USD): ${listedPriceRaw}`;
    parsed.extraction_evidence=parsed.extraction_evidence||{};
    parsed.extraction_confidence=parsed.extraction_confidence||{};
    parsed.extraction_evidence.price=parsed.price_evidence;
    parsed.extraction_confidence.price='high';
  }

  if($('#externalAgentPhone').value.trim())parsed.phone=$('#externalAgentPhone').value.trim();
  const masters=await getMasterProperties();
  const sources=await getAllSourcePosts();
  const candidates=findMasterCandidates(parsed,masters,sources);
  const decision=candidateDecision(candidates);
  const candidate=decision.candidate?.master||null;
  const captor=candidate?probableCaptorForMaster(candidate.id,sources):null;
  const age=externalAgeDays(msg.date_iso);

  externalDraft={
    parsed,candidates,decision,candidate,captor,
    capture:{
      source_type:$('#externalSourceType').value,
      external_url:url||null,
      external_title:$('#externalTitle')?.value.trim()||null,
      listed_price_raw:listedPriceRaw||null,
      listed_price_value:listedPriceValue,
      listed_price_currency:listedCurrency,
      published_at:new Date(`${msg.date_iso}T12:00:00`).toISOString(),
      publisher_name:$('#externalAgentName').value.trim()||null,
      publisher_phone:$('#externalAgentPhone').value.trim()||parsed.phone||null,
      agent_name:$('#externalAgentName').value.trim()||null,
      agent_phone:$('#externalAgentPhone').value.trim()||parsed.phone||null,
      channel_name:$('#externalAgentName').value.trim()||sourceLabel($('#externalSourceType').value),
      original_text:description
    }
  };

  $('#externalFacts').innerHTML=externalFactsHtml(parsed);
  $('#externalEvidence').innerHTML=externalEvidenceHtml(parsed);
  $('#externalAnalysisTitle').textContent=parsed.residence||parsed.property_type||'Propiedad detectada';
  $('#externalAgeBadge').textContent=age==null?'fecha no válida':age===0?'hoy':`${age} días`;
  $('#externalAgeBadge').className=age!=null&&age<=20?'fresh':'old';
  $('#externalDecisionLabel').textContent=decision.label;
  $('#externalDecisionReason').textContent=decision.candidate
    ? `${decision.candidate.score}% de similitud · ${decision.candidate.reasons.join(', ')}${decision.candidate.warnings?.length?` · ⚠ ${decision.candidate.warnings.join(', ')}`:''}`
    : 'Se creará un inmueble maestro nuevo si decides guardarlo.';

  $('#externalCandidateBox').hidden=!candidate;
  if(candidate){
    $('#externalCandidateName').textContent=masterShortName(candidate);
    $('#externalCandidateMeta').textContent=masterShortMeta(candidate);
  }
  const publisherName=$('#externalAgentName').value.trim();
  $('#externalPublisherBox').hidden=!publisherName;
  if(publisherName){
    $('#externalPublisherName').textContent=publisherName;
    const platform=sourceLabel($('#externalSourceType').value);
    $('#externalPublisherMeta').textContent=`Mostrado como publicador/vendedor en ${platform}. Esto no confirma que sea el captador original.`;
  }

  $('#externalCaptorBox').hidden=!captor;
  if(captor){
    $('#externalCaptorName').textContent=`${captor.name}${captor.phone?` · ${captor.phone}`:''}`;
    $('#externalCaptorMeta').textContent=`Confianza ${captor.confidence} · ${captor.score}% · ${captor.appearances} apariciones conocidas`;
    const wa=$('#externalCaptorWhatsapp'),number=whatsappNumber(captor.phone||'');
    if(wa&&number){
      const summary=[propertyDisplayName(parsed),parsed.zone,parsed.price_usd?formatMoney(parsed.price_usd):null,url].filter(Boolean).join(' · ');
      wa.href=`https://wa.me/${number}?text=${encodeURIComponent(`Hola colega, ¿esta propiedad la tienes disponible actualmente?\n\n${summary}`)}`;wa.hidden=false;
    }else if(wa){wa.hidden=true;wa.removeAttribute('href');}
  }

  $('#saveExternalLinked').hidden=decision.mode==='new'||!candidate;
  $('#saveExternalLinked').textContent=decision.mode==='review'?'Vincular a este inmueble':'Guardar y vincular';
  $('#externalAnalysis').hidden=false;
  $('#externalAnalysis').scrollIntoView({behavior:'smooth',block:'start'});
}
async function saveExternalCapture(forceNew=false){
  if(!externalDraft)return;
  const p=externalDraft.parsed||{};
  const listedAmount=externalDraft.capture?.listed_price_value;
  const currency=externalDraft.capture?.listed_price_currency;
  const criticalMissing=[
    ['precio',p.price_usd||listedAmount],['habitaciones',p.bedrooms],['baños',p.bathrooms],['puestos',p.parking]
  ].filter(([,v])=>v==null).map(([k])=>k);

  if(listedAmount&&currency==='UNVERIFIED'){
    const ok=confirm('El anuncio tiene un precio publicado, pero la moneda real está marcada como “No confirmada”. Radar lo guardará como dato externo y NO lo usará como precio USD para matching ni deduplicación fuerte. ¿Continuar?');
    if(!ok)return;
  }
  if(criticalMissing.length){
    const ok=confirm(`Faltan datos estructurados por verificar: ${criticalMissing.join(', ')}. ¿Guardar de todas formas?`);
    if(!ok)return;
  }
  const age=externalAgeDays($('#externalPublishedDate').value);
  if(age!=null&&age>20&&!confirm(`La publicación tiene ${age} días. Tu objetivo principal es inventario de máximo 20 días. ¿Guardar de todas formas?`))return;

  const masterId=!forceNew&&externalDraft.candidate?externalDraft.candidate.id:null;
  const result=await upsertExternalCapture({
    capture:externalDraft.capture,parsed:externalDraft.parsed,masterId,
    captor:externalDraft.captor
  });

  // Recalculate buyers so a newly captured external property can immediately
  // become a commercial opportunity.
  await recalculateAllBuyerMatches({silent:true});
  await refreshRadarBuyerCounters();
  await refreshExternalSourcesUI();
  await maybeAutoBackup();

  $('#externalDecisionLabel').textContent=result.linked?'Fuente vinculada al inmueble existente':'Nuevo inmueble maestro creado';
  $('#externalDecisionReason').textContent='Guardado en Radar Core y protegido por el sistema de respaldo.';
  $('#saveExternalLinked').disabled=true;$('#saveExternalNew').disabled=true;
  setTimeout(()=>{$('#saveExternalLinked').disabled=false;$('#saveExternalNew').disabled=false;},800);
}

function resetExternalCapture(){
  for(const id of ['externalUrl','externalTitle','externalListedPrice','externalAgentName','externalAgentPhone','externalText']){
    const el=$('#'+id);if(el)el.value='';
  }
  if($('#externalSourceType'))$('#externalSourceType').value='instagram';
  if($('#externalPriceCurrency'))$('#externalPriceCurrency').value='UNVERIFIED';
  if($('#externalPublishedDate'))$('#externalPublishedDate').value=isoToday();
  if($('#externalAnalysis'))$('#externalAnalysis').hidden=true;
  if($('#externalUrlStatus')){$('#externalUrlStatus').textContent='';$('#externalUrlStatus').dataset.kind='';}
  externalDraft=null;
}

async function analyzeExternalUrl(){
  const input=$('#externalUrl'),status=$('#externalUrlStatus'),button=$('#analyzeExternalUrl');
  const safe=safeExternalUrl(input?.value||'');
  if(!safe){status.textContent='Escribe una URL HTTP/HTTPS válida.';status.dataset.kind='error';return;}
  input.value=safe;button.disabled=true;status.textContent='Leyendo metadata pública…';status.dataset.kind='working';
  try{
    const type=sourceTypeFromUrl(safe),adapter=adapterForUrl(safe),result=await adapter.analyze(safe);
    if($('#externalSourceType')&&[...$('#externalSourceType').options].some(o=>o.value===type))$('#externalSourceType').value=type;
    if(!result.ok){status.textContent=result.message;status.dataset.kind='warning';return;}
    if(result.title&&!$('#externalTitle').value.trim())$('#externalTitle').value=result.title;
    if(result.description&&!$('#externalText').value.trim())$('#externalText').value=result.description;
    if(result.price!=null&&!$('#externalListedPrice').value.trim())$('#externalListedPrice').value=String(result.price);
    if(result.currency&&['USD','VES'].includes(result.currency)&&$('#externalPriceCurrency'))$('#externalPriceCurrency').value=result.currency;
    status.textContent='Metadata pública obtenida. Revisa el texto y pulsa Analizar publicación.';status.dataset.kind='success';
  }catch(error){
    diagnosticLog('external','analyze_url',error?.message||String(error));
    status.textContent='Radar no pudo leer automáticamente esta publicación. Usa los campos manuales.';status.dataset.kind='warning';
  }finally{button.disabled=false;}
}
$('#analyzeExternalSource')?.addEventListener('click',analyzeExternalCapture);
$('#analyzeExternalUrl')?.addEventListener('click',analyzeExternalUrl);
$('#clearExternalSource')?.addEventListener('click',resetExternalCapture);
$('#saveExternalLinked')?.addEventListener('click',()=>saveExternalCapture(false));
$('#saveExternalNew')?.addEventListener('click',()=>saveExternalCapture(true));

$('#refreshExternalSources')?.addEventListener('click',refreshExternalSourcesUI);
document.querySelectorAll('[data-fresh-filter]').forEach(btn=>btn.addEventListener('click',async()=>{
  externalFreshnessFilter=btn.dataset.freshFilter||'action';
  await refreshExternalSourcesUI();
}));
$('#externalFreshnessList')?.addEventListener('click',async(e)=>{
  const btn=e.target.closest('[data-fresh-action]');if(!btn)return;
  const id=btn.dataset.sourceId,status=btn.dataset.freshAction;
  if(status==='unavailable'&&!confirm('¿Marcar esta publicación como NO DISPONIBLE? Dejará de considerarse vigente para matching cuando no exista otra fuente activa del mismo inmueble.'))return;
  btn.disabled=true;
  try{
    await updateExternalSourceVerification(id,status);
    await recalculateAllBuyerMatches({silent:true});
    await refreshExternalSourcesUI();
    await refreshBuyersData();
    await refreshRadarBuyerCounters();
  }catch(err){alert(err.message||'No se pudo actualizar la vigencia.');}
  finally{btn.disabled=false;}
});
$('#recheckExternalFreshness')?.addEventListener('click',async()=>{
  const changed=await refreshExternalMasterVigency();
  await recalculateAllBuyerMatches({silent:true});
  await refreshExternalSourcesUI();
  await refreshBuyersData();
  await refreshRadarBuyerCounters();
  alert(changed?`Vigencia recalculada: ${changed} inmuebles maestros actualizados.`:'Vigencia revisada. No había cambios pendientes.');
});

$('#externalPublishedDate') && ($('#externalPublishedDate').value=isoToday());


function processZipWithWorker(file, group, progressCb) {
  return new Promise((resolve,reject)=>{
    const worker = new Worker('./worker.js?v=0600',{type:'module'});
    worker.onmessage = async (e)=>{
      const m=e.data;
      if(m.type==='status'){ progressCb?.({phase:m.step,text:m.text,bytes:m.bytes}); return; }
      if(m.type==='error'){ worker.terminate(); reject(new Error(m.message)); return; }
      if(m.type==='done'){ worker.terminate(); resolve(m); }
    };
    worker.onerror=(e)=>{worker.terminate();reject(new Error(e.message||'Error del procesador'));};
    worker.postMessage({file,group,locationCatalog});
  });
}

const IMPORT_PHASE_RANK=Object.freeze({PROPERTIES_SAVED:1,DEMANDS_SAVED:2,COMPLETED:3});

async function saveProcessedResult(m, group, fileName, fileHash, startedAt, progressCb,{deferMatching=false,checkpoint=null}={}) {
  let phase=String(checkpoint?.status||'').toUpperCase(),saved={added:Number(checkpoint?.added||0),updated:Number(checkpoint?.updated||0)};
  const baseSummary={workspace_id:'00000000-0000-7000-8000-000000000001',device_id:null,group,thread_reference:group,file_name:fileName,source_filename:fileName,file_hash:fileHash,chat_file:m.entryName,
    messages:m.result.messages,messages_total:m.result.messages_total??m.result.messages,skipped_age:m.result.messages_skipped_age??0,max_age_days:m.result.max_age_days??60,cutoff_date:m.result.cutoff_date??null,detected:m.result.properties_detected,unique:m.result.unique.length,messages_detected:m.result.messages,messages_imported:m.result.messages,started_at:checkpoint?.started_at||startedAt};
  if((IMPORT_PHASE_RANK[phase]||0)<IMPORT_PHASE_RANK.PROPERTIES_SAVED){
    saved=await mergeProperties(m.result.unique,(done,total)=>progressCb?.({phase:'save',done,total}));
    await learnContactsFromProperties(m.result.unique);await recordLocationPendings(m.result.location_pendings||[]);
    checkpoint=await saveImportCheckpoint(fileHash,{...baseSummary,added:saved.added,updated:saved.updated,duplicates_detected:saved.updated,errors_count:0,status:'PROPERTIES_SAVED'});phase='PROPERTIES_SAVED';
  }
  const demands=demandEngineEnabled&&m.result.demand_messages?.length?processZipDemandMessages(m.result.demand_messages,{resolveTerritory:resolveDemandTerritory}):[];
  let demandIds=[...new Set(checkpoint?.demand_ids||demands.map(row=>row.id))];
  if((IMPORT_PHASE_RANK[phase]||0)<IMPORT_PHASE_RANK.DEMANDS_SAVED){
    const demandSave=await saveDemandRecords(demands,{onProgress:(done,total)=>progressCb?.({phase:'demand',done,total})});
    demandIds=[...new Set([...demandIds,...demandSave.demandIds])];
    checkpoint=await saveImportCheckpoint(fileHash,{...baseSummary,added:saved.added,updated:saved.updated,duplicates_detected:saved.updated,errors_count:0,status:'DEMANDS_SAVED',demand_ids:demandIds,demands_written:demandSave.demandsWritten,sources_written:demandSave.sourcesWritten});phase='DEMANDS_SAVED';
  }
  progressCb?.({phase:'finalize',done:m.result.unique.length,total:m.result.unique.length});
  const summary=await saveImportCheckpoint(fileHash,{...baseSummary,added:saved.added,updated:saved.updated,duplicates_detected:saved.updated,errors_count:0,status:'COMPLETED',demand_ids:demandIds,finished_at:new Date().toISOString()});
  const propertyIds=[...new Set(m.result.unique.map(row=>row.id).filter(Boolean))];
  if(demandEngineEnabled&&demandIds.length&&!deferMatching)await runDemandOpportunityMatching({trigger_type:'DEMAND_CHANGED',trigger_entity_id:demandIds});
  return {summary,demandIds,propertyIds};
}

async function importOneZip(file, group, progressCb,{deferMatching=false}={}) {
  const startedAt=new Date().toISOString();
  const bytes=await file.arrayBuffer(),hashBytes=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  const fileHash=[...hashBytes].map(value=>value.toString(16).padStart(2,'0')).join(''),checkpoint=await findImportCheckpointByFileHash(fileHash),phase=String(checkpoint?.status||'').toUpperCase();
  if(phase==='COMPLETED')return {m:null,summary:{...checkpoint,already_processed:true,status:'already_processed'},demandIds:checkpoint.demand_ids||[],propertyIds:[]};
  if(phase==='DEMANDS_SAVED'){const summary=await saveImportCheckpoint(fileHash,{...checkpoint,status:'COMPLETED',finished_at:new Date().toISOString()});return {m:null,summary,demandIds:summary.demand_ids||[],propertyIds:[]};}
  const m = await processZipWithWorker(file,group,progressCb);
  const saved = await saveProcessedResult(m,group,file.name,fileHash,startedAt,progressCb,{deferMatching,checkpoint});
  return {m,...saved};
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
      else if(p.phase==='process_progress') setStatus(`Detectando propiedades… ${Number(p.done||0).toLocaleString('es-VE')} / ${Number(p.total||0).toLocaleString('es-VE')}`,48+Math.round((Number(p.done||0)/Math.max(Number(p.total||0),1))*10));
      else if(p.phase==='save') setStatus(`Guardando base local… ${p.done.toLocaleString('es-VE')} / ${p.total.toLocaleString('es-VE')}`,60+Math.round((p.done/Math.max(p.total,1))*35));
      else if(p.phase==='demand') setStatus(`Demandas… ${p.done.toLocaleString('es-VE')} / ${p.total.toLocaleString('es-VE')}`,96);
    });
    const alreadyProcessed=Boolean(summary.already_processed);
    const importTitle=alreadyProcessed?'ZIP ya procesado anteriormente':'Importación completada';
    setStatus(importTitle,100);
    $('#resultBox').innerHTML = `<div class="successMark">✓</div><h3>${importTitle}</h3>
      <div class="summaryGrid"><div><b>${summary.messages.toLocaleString('es-VE')}</b><span>mensajes ≤60 días</span></div>
      <div><b>${summary.skipped_age.toLocaleString('es-VE')}</b><span>antiguos omitidos</span></div>
      <div><b>${summary.detected.toLocaleString('es-VE')}</b><span>publicaciones</span></div>
      <div><b>${summary.added.toLocaleString('es-VE')}</b><span>nuevas en base</span></div></div>`;
    $('#resultBox').hidden=false; await loadData(); await maybeAutoBackup();
  } catch(e) { setStatus(`Error: ${e.message}`,0); }
  finally { $('#importBtn').disabled=false; fileInput.disabled=false; }
});

async function refreshStatsOnly(uniqueCount=null) {
  const s = await getStats();
  $('#propertyCount').textContent = Number(uniqueCount ?? s.properties).toLocaleString('es-VE');
  $('#importCount').textContent = s.imports.toLocaleString('es-VE');
  $('#favoriteCount').textContent = s.favorites.toLocaleString('es-VE');
}
async function refreshRecent() {
  const recent = await getRecentImports();
  $('#recent').innerHTML = recent.length ? recent.map(r=>`<div class="recentItem"><div><b>${esc(r.group)}</b>
    <small>${new Date(r.imported_at).toLocaleString('es-VE')} · ${Number(r.messages||0).toLocaleString('es-VE')} recientes${r.skipped_age?` · ${Number(r.skipped_age).toLocaleString('es-VE')} omitidos`:''}</small></div><span>+${Number(r.added||0).toLocaleString('es-VE')}</span></div>`).join('')
    : '<p class="muted">Aún no has importado grupos.</p>';
}
async function refreshLocationStats(){
  const s=await getLocationStats();locationPendings=await getLocationPendings('pending');
  if($('#smartZoneCount'))$('#smartZoneCount').textContent=s.zones.toLocaleString('es-VE');
  if($('#smartComplexCount'))$('#smartComplexCount').textContent=s.complexes.toLocaleString('es-VE');
  if($('#smartPendingCount'))$('#smartPendingCount').textContent=s.pending.toLocaleString('es-VE');
  if($('#openLocationReview'))$('#openLocationReview').disabled=!s.pending;
}
function municipalityOptions(selected=''){return (locationCatalog.municipalities||[]).filter(x=>x.activo!==false).map(x=>`<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(x.nombre)}</option>`).join('');}
function zoneOptions(selected=''){return (locationCatalog.zones||[]).filter(x=>x.activo!==false).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')).map(x=>`<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(x.nombre)}</option>`).join('');}
function complexOptions(selected='',zoneId=null){return (locationCatalog.complexes||[]).filter(x=>x.activo!==false&&(!zoneId||x.zona_id===zoneId)).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')).map(x=>`<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(x.nombre)}</option>`).join('');}
function renderLocationReview(){
  const box=$('#locationReviewList');if(!box)return;
  const rows=locationPendings.slice(0,80);$('#locationReviewMeta').textContent=`${locationPendings.length.toLocaleString('es-VE')} detecciones pendientes`;
  box.innerHTML=rows.length?rows.map(p=>{const isZone=p.kind==='zone';return `<article class="locationPendingCard" data-id="${esc(p.id)}">\n    <div class="locationPendingTop"><div><span>${isZone?'ZONA':'CONJUNTO / TORRE'}</span><h4>${esc(p.detected)}</h4></div><b>${Number(p.seen_count||1)}×</b></div>\n    <small>${esc([p.zone_nombre,p.group,p.date].filter(Boolean).join(' · '))}</small>\n    <div class="locationSample">${esc((p.samples?.[0]||p.sample_text||'').slice(0,420))}</div>\n    ${isZone?`<div class="pendingControl"><select class="existingTarget"><option value="">Vincular a zona existente…</option>${zoneOptions()}</select><button class="linkPending ghost">Vincular</button></div>\n      <div class="pendingControl"><select class="municipalityTarget">${municipalityOptions(p.municipality_id||'')}</select><input class="newLocationName" value="${esc(p.detected)}"><button class="createPending primary">Crear zona</button></div>`:
      `<div class="pendingControl"><select class="existingTarget"><option value="">Vincular a conjunto existente…</option>${complexOptions('',p.zone_id||null)}</select><button class="linkPending ghost">Vincular</button></div>\n      <div class="pendingControl"><select class="zoneTarget">${zoneOptions(p.zone_id||'')}</select><input class="newLocationName" value="${esc(p.detected)}"><select class="complexType"><option value="conjunto_cerrado">Conjunto cerrado</option><option value="torre">Torre</option><option value="edificio">Edificio</option><option value="urbanizacion_privada">Urbanización privada</option></select><button class="createPending primary">Crear conjunto</button></div>`}\n    <button class="discardPending miniGhost">Descartar detección</button>\n  </article>`;}).join(''):'<div class="empty">No hay detecciones pendientes. El catálogo está limpio.</div>';
  box.querySelectorAll('.locationPendingCard').forEach(card=>{
    const id=card.dataset.id,p=locationPendings.find(x=>x.id===id);if(!p)return;
    card.querySelector('.linkPending')?.addEventListener('click',async()=>{const target=card.querySelector('.existingTarget')?.value;if(!target)return alert('Selecciona un destino.');await linkLocationPending(id,target);await afterLocationDecision();});
    card.querySelector('.createPending')?.addEventListener('click',async()=>{const name=card.querySelector('.newLocationName')?.value?.trim()||p.detected;if(p.kind==='zone'){const mid=card.querySelector('.municipalityTarget')?.value;if(!mid)return alert('Selecciona municipio.');await createZoneFromPending(id,mid,name);}else{const zid=card.querySelector('.zoneTarget')?.value,type=card.querySelector('.complexType')?.value||'conjunto_cerrado';if(!zid)return alert('Selecciona la zona donde pertenece.');await createComplexFromPending(id,zid,name,type);}await afterLocationDecision();});
    card.querySelector('.discardPending')?.addEventListener('click',async()=>{await discardLocationPending(id);await refreshLocationStats();renderLocationReview();});
  });
}
async function afterLocationDecision(){
  locationCatalog=await getLocationCatalog();await rematchAllPropertyLocations(locationCatalog);locationCatalog=await getLocationCatalog();await refreshLocationStats();await loadData();renderLocationReview();
}
async function initLocationSystem(){
  await ensureLocationCatalogSeed();locationCatalog=await getLocationCatalog();
  const migration=localStorage.getItem('gi_location_migration_v0412');
  if(!migration){await rematchAllPropertyLocations(locationCatalog);localStorage.setItem('gi_location_migration_v0412',String(Date.now()));locationCatalog=await getLocationCatalog();}
  await refreshLocationStats();
}
$('#openLocationReview')?.addEventListener('click',async()=>{locationPendings=await getLocationPendings('pending');renderLocationReview();$('#locationReviewDialog').showModal();});
$('#closeLocationReview')?.addEventListener('click',()=>$('#locationReviewDialog').close());
$('#refreshLocationCatalog')?.addEventListener('click',async()=>{locationCatalog=await getLocationCatalog();await rematchAllPropertyLocations(locationCatalog);await refreshLocationStats();await loadData();alert('Catálogo aplicado nuevamente a tu inventario.');});

async function loadData() {
  if(!locationCatalog.zones?.length){await ensureLocationCatalogSeed();locationCatalog=await getLocationCatalog();}
  let rawProperties=await getAllProperties();
  const priceAuditNeeded=rawProperties.filter(p=>p.price_audit_version!=='0600');
  if(priceAuditNeeded.length){
    const audited=priceAuditNeeded.map(auditExistingPropertyPrice);
    await patchPropertyPriceAudits(audited);
    rawProperties=await getAllProperties();
    const corrected=audited.filter((p,i)=>p.price_audit_status==='corrected').length;
    const ambiguous=audited.filter(p=>p.price_audit_status==='ambiguous').length;
    localStorage.setItem('gi_price_audit_0600',JSON.stringify({at:new Date().toISOString(),checked:audited.length,corrected,ambiguous}));
  }
  const valid=rawProperties.filter(p=>{const r=recencyInfo(p);return Number.isFinite(r.days)&&r.days<=60&&!isDemandRequest(p.text||'');});
  const consolidated=consolidateProperties(valid);
  const coreSync=await syncRadarCore(valid,consolidated);
  if(demandEngineEnabled&&coreSync.touchedMasterIds?.length)await runDemandOpportunityMatching({trigger_type:'INVENTORY_REFRESH',trigger_entity_id:coreSync.touchedMasterIds});
  await recalculateAllBuyerMatches({silent:true});
  const radarStats=await getRadarCoreStats();
  contactDirectory=await getAllContacts();contactIndex=buildContactIndex(contactDirectory);
  allProperties=consolidated.map(annotateContactResolution);
  favoriteIds=await getFavoriteIds();
  await refreshStatsOnly(allProperties.length);await refreshRecent();await refreshContactStats();
  if($('#radarMasterCount'))$('#radarMasterCount').textContent=radarStats.masters.toLocaleString('es-VE');
  if($('#radarSourceCount'))$('#radarSourceCount').textContent=radarStats.sources.toLocaleString('es-VE');
  if($('#radarBuyerCount'))$('#radarBuyerCount').textContent=radarStats.buyers.toLocaleString('es-VE');
  if($('#radarMatchCount'))$('#radarMatchCount').textContent=radarStats.matches.toLocaleString('es-VE');
  const avgAppearances=radarStats.masters>0 ? radarStats.sources/radarStats.masters : 0;
  if($('#radarAvgAppearances'))$('#radarAvgAppearances').textContent=avgAppearances.toLocaleString('es-VE',{minimumFractionDigits:1,maximumFractionDigits:1});
  if($('#radarGroupingNote'))$('#radarGroupingNote').textContent=radarStats.sources
    ? `${radarStats.sources.toLocaleString('es-VE')} publicaciones vinculadas a ${radarStats.masters.toLocaleString('es-VE')} inmuebles únicos.`
    : 'Sin publicaciones vinculadas todavía.';
  await refreshBuyersData();
  await refreshExternalSourcesUI();
  buildZoneCatalog();updateSelectorUI();
  const restored=restoreSearchFormState();
  if(restored){currentResults=sortProperties(allProperties.filter(p=>matchesFilters(p,getFilters())),$('#sortMode').value);$('#resultCount').textContent=currentResults.length.toLocaleString('es-VE');$('#resultHint').textContent='Búsqueda restaurada';}
  else{currentResults=sortProperties(allProperties,'recent');$('#resultCount').textContent=currentResults.length.toLocaleString('es-VE');$('#resultHint').textContent=`${allProperties.length.toLocaleString('es-VE')} inmuebles únicos`;visibleCount=30;}
  renderResults();if(restored)restoreSearchPosition();if($('#viewSaved').classList.contains('active'))renderSaved();
}
$('#resetBtn').onclick = async () => {
  alert('El borrado masivo está deshabilitado en V0.6 Professional Audit para proteger los datos locales.');
};




function setBackupStatus(text,kind=''){
  const e=$('#backupStatus');if(e){e.textContent=text;e.dataset.kind=kind;}
}
function rememberBackup(destination,createdAt=new Date().toISOString()){
  localStorage.setItem(BACKUP_LAST_KEY,JSON.stringify({destination,created_at:createdAt}));
  renderBackupState();
}
function renderBackupState(){
  const s=getDropboxSettings(),auto=localStorage.getItem(BACKUP_AUTO_KEY)==='1';
  const autoEl=$('#autoBackupDropbox');if(autoEl){autoEl.checked=auto;autoEl.disabled=!s.connected;}
  if($('#backupDropboxNow'))$('#backupDropboxNow').disabled=!s.connected;
  if($('#restoreDropboxBackup'))$('#restoreDropboxBackup').disabled=!s.connected;
  let last=null;try{last=JSON.parse(localStorage.getItem(BACKUP_LAST_KEY)||'null');}catch{}
  if($('#backupLastLabel'))$('#backupLastLabel').textContent=last?.created_at?new Date(last.created_at).toLocaleString('es-VE'):'Sin respaldo';
}
function backupFileName(createdAt=new Date().toISOString()){
  return `radar-respaldo-${createdAt.replace(/[:.]/g,'-')}.json`;
}
let preparedBackup=null;

function clearPreparedBackup(){
  if(preparedBackup?.url){try{URL.revokeObjectURL(preparedBackup.url);}catch{}}
  preparedBackup=null;
  const box=$('#backupReadyBox');if(box)box.hidden=true;
  const link=$('#backupDirectLink');if(link){link.hidden=true;link.removeAttribute('href');}
}
function prepareBackupFile(snapshot,text){
  clearPreparedBackup();
  const name=backupFileName(snapshot.created_at);
  const blob=new Blob([text],{type:'application/json'});
  let file=null;
  try{file=new File([blob],name,{type:'application/json',lastModified:Date.now()});}catch{}
  const url=URL.createObjectURL(blob);
  preparedBackup={snapshot,text,name,blob,file,url};
  const box=$('#backupReadyBox');if(box)box.hidden=false;
  if($('#backupReadyName'))$('#backupReadyName').textContent=name;
  if($('#backupReadySize'))$('#backupReadySize').textContent=prettySize(blob.size);
  const link=$('#backupDirectLink');
  if(link){link.href=url;link.download=name;link.hidden=false;}
}
async function buildBackup(){
  setBackupStatus('Preparando respaldo completo…','working');
  return exportDatabaseSnapshot();
}
async function downloadLocalBackup(){
  try{
    const snapshot=await buildBackup(),text=JSON.stringify(snapshot);
    prepareBackupFile(snapshot,text);
    const x=backupSnapshotSummary(snapshot);
    setBackupStatus(`Respaldo listo: ${x.masters.toLocaleString('es-VE')} inmuebles maestros · ${x.sources.toLocaleString('es-VE')} publicaciones fuente. Ahora toca “Guardar en Archivos”.`,'ok');
  }catch(e){setBackupStatus(`No pude crear el respaldo: ${e.message}`,'error');}
}
async function savePreparedBackup(){
  if(!preparedBackup)return setBackupStatus('Primero toca “Preparar respaldo”.','warn');
  const {snapshot,file}=preparedBackup;

  // En iPhone el flujo más fiable es abrir el menú nativo de compartir
  // desde un segundo toque del usuario, cuando el archivo ya está preparado.
  if(file && navigator.share){
    try{
      const shareData={files:[file],title:'Respaldo Radar Inmobiliario'};
      if(!navigator.canShare || navigator.canShare(shareData)){
        await navigator.share(shareData);
        rememberBackup('archivo',snapshot.created_at);
        setBackupStatus('Menú de iPhone abierto. Si elegiste “Guardar en Archivos”, el respaldo quedó guardado.','ok');
        return;
      }
    }catch(e){
      if(e?.name==='AbortError'){
        setBackupStatus('No se guardó el respaldo porque cerraste el menú de compartir.','warn');
        return;
      }
      console.warn('Web Share no disponible para archivo; uso descarga directa.',e);
    }
  }

  // Respaldo alternativo: el enlace ya está creado y este clic ocurre
  // directamente dentro del gesto del usuario.
  const link=$('#backupDirectLink');
  if(link?.href){
    link.click();
    rememberBackup('archivo',snapshot.created_at);
    setBackupStatus('Descarga solicitada. Si tu navegador no muestra el archivo, usa “Descarga directa” o abre la app en Safari.','ok');
  }else setBackupStatus('No pude preparar el archivo para guardar. Vuelve a prepararlo.','error');
}
async function restoreSnapshotWithConfirmation(snapshot,sourceLabel){
  const x=backupSnapshotSummary(snapshot),when=x.created_at?new Date(x.created_at).toLocaleString('es-VE'):'fecha desconocida';
  const ok=confirm(`Restaurar respaldo de ${when}?\n\n${x.masters.toLocaleString('es-VE')} inmuebles maestros\n${x.sources.toLocaleString('es-VE')} publicaciones fuente\n${x.contacts.toLocaleString('es-VE')} contactos\n\nLa base local actual será reemplazada.`);
  if(!ok)return false;
  setBackupStatus('Restaurando base local…','working');
  await restoreDatabaseSnapshot(snapshot,p=>setBackupStatus(`Restaurando ${p.index}/${p.total}: ${p.store}…`,'working'));
  locationCatalog=await getLocationCatalog();
  await loadData();
  rememberBackup(`restaurado:${sourceLabel}`,snapshot.created_at||new Date().toISOString());
  setBackupStatus(`Restauración completada desde ${sourceLabel}.`,'ok');
  return true;
}
async function backupToDropbox({silent=false}={}){
  const settings=getDropboxSettings();
  if(!settings.connected){if(!silent)setBackupStatus('Conecta Dropbox para guardar el respaldo en la nube.','warn');return false;}
  try{
    if(!silent)setBackupStatus('Creando respaldo y subiendo a Dropbox…','working');
    const snapshot=await exportDatabaseSnapshot();
    await uploadDropboxFile(BACKUP_DROPBOX_PATH,JSON.stringify(snapshot));
    rememberBackup('dropbox',snapshot.created_at);
    if(!silent){const x=backupSnapshotSummary(snapshot);setBackupStatus(`Dropbox actualizado: ${x.masters.toLocaleString('es-VE')} inmuebles · ${x.sources.toLocaleString('es-VE')} publicaciones.`,'ok');}
    return true;
  }catch(e){if(!silent)setBackupStatus(`Dropbox: ${e.message}`,'error');console.error('backup dropbox',e);return false;}
}
async function maybeAutoBackup(){
  if(localStorage.getItem(BACKUP_AUTO_KEY)!=='1'||!getDropboxSettings().connected)return false;
  setBackupStatus('Importación lista. Guardando respaldo automático en Dropbox…','working');
  const ok=await backupToDropbox({silent:true});
  setBackupStatus(ok?'Respaldo automático actualizado en Dropbox.':'La importación terminó, pero el respaldo automático de Dropbox falló.',ok?'ok':'warn');
  return ok;
}
$('#downloadBackup')?.addEventListener('click',downloadLocalBackup);
$('#saveBackupFile')?.addEventListener('click',savePreparedBackup);
$('#backupDirectLink')?.addEventListener('click',()=>{
  if(preparedBackup){
    rememberBackup('archivo',preparedBackup.snapshot.created_at);
    setBackupStatus('Descarga directa solicitada. Revisa Descargas/Archivos.','ok');
  }
});
$('#restoreLocalBackup')?.addEventListener('click',()=>$('#backupFileInput')?.click());
$('#backupFileInput')?.addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{const snapshot=JSON.parse(await file.text());await restoreSnapshotWithConfirmation(snapshot,'archivo');}
  catch(err){setBackupStatus(`No pude restaurar el archivo: ${err.message}`,'error');}
  finally{e.target.value='';}
});
$('#backupDropboxNow')?.addEventListener('click',()=>backupToDropbox({silent:false}));
$('#restoreDropboxBackup')?.addEventListener('click',async()=>{
  if(!getDropboxSettings().connected)return setBackupStatus('Conecta Dropbox primero.','warn');
  try{
    setBackupStatus('Descargando el último respaldo de Dropbox…','working');
    const blob=await downloadDropboxFile(BACKUP_DROPBOX_PATH),snapshot=JSON.parse(await blob.text());
    await restoreSnapshotWithConfirmation(snapshot,'Dropbox');
  }catch(e){setBackupStatus(`No pude restaurar desde Dropbox: ${e.message}`,'error');}
});
$('#autoBackupDropbox')?.addEventListener('change',e=>{
  localStorage.setItem(BACKUP_AUTO_KEY,e.target.checked?'1':'0');
  setBackupStatus(e.target.checked?'Respaldo automático activado. Se ejecutará después de cada importación.':'Respaldo automático desactivado.','ok');
});

async function refreshContactStats(){
  const s=await getContactStats(),resolved=allProperties.filter(p=>p.phone_resolution?.source==='directorio').length;
  if($('#contactCount'))$('#contactCount').textContent=s.contacts.toLocaleString('es-VE');
  if($('#contactAliasCount'))$('#contactAliasCount').textContent=s.aliases.toLocaleString('es-VE');
  if($('#contactResolvedCount'))$('#contactResolvedCount').textContent=resolved.toLocaleString('es-VE');
}
function setContactStatus(text,kind=''){const e=$('#contactSyncStatus');if(e){e.textContent=text;e.dataset.kind=kind;}}
async function parseAndStoreContactEntry(entry,folder){
  const blob=await downloadDropboxFile(entry.path_lower||entry.path_display),records=await parseContactBlob(blob,entry.name);
  if(!records.length)return 0;await upsertContacts(records,`${folder}/${entry.name}`);return records.length;
}
async function syncDropboxContacts({silent=false}={}){
  const s=getDropboxSettings();
  if(!s.connected){
    if(!silent)setContactStatus('Conecta Dropbox para cargar el directorio.','warn');
    return;
  }

  const btn=$('#syncContacts');
  if(btn)btn.disabled=true;
  if(!silent)setContactStatus('Leyendo CONTACTOS_PROCESADOS…','working');

  let records=0,filesRead=0,errors=0;
  try{
    // CONTACTOS_PROCESADOS es la fuente principal y autoritativa.
    let processed=[];
    try{
      processed=await listDropboxContactFiles(s.contactsProcessedPath);
    }catch(e){
      if(!String(e.message).includes('not_found')) throw e;
    }

    for(const entry of processed){
      try{
        const n=await parseAndStoreContactEntry(entry,'CONTACTOS_PROCESADOS');
        records+=n;filesRead++;
      }catch(e){
        errors++;
        console.error('contacts processed',entry.name,e);
      }
    }

    // CONTACTOS queda como bandeja opcional de nuevos archivos, pero no exige acción del usuario.
    // Si existe algo allí, se procesa automáticamente y se archiva.
    let pending=[];
    try{
      pending=await listDropboxContactFiles(s.contactsPath);
    }catch(e){
      if(!String(e.message).includes('not_found')) throw e;
    }

    for(const entry of pending){
      try{
        const n=await parseAndStoreContactEntry(entry,'CONTACTOS');
        records+=n;filesRead++;
        if(n){
          await moveDropboxFile(entry.path_lower||entry.path_display,s.contactsProcessedPath,entry.name);
        }
      }catch(e){
        errors++;
        console.error('contacts pending',entry.name,e);
      }
    }

    contactDirectory=await getAllContacts();
    contactIndex=buildContactIndex(contactDirectory);

    // Recalcula inmediatamente los enlaces WhatsApp de todas las propiedades visibles.
    await loadData();

    const st=await getContactStats();
    setContactStatus(
      `${st.contacts.toLocaleString('es-VE')} teléfonos · ${st.aliases.toLocaleString('es-VE')} nombres/alias · ${filesRead} archivo(s) leídos${errors?` · ${errors} error(es)`:''}`,
      errors?'warn':'ok'
    );
    localStorage.setItem('gi_contacts_last_sync_v0410',String(Date.now()));
  }catch(e){
    console.error(e);
    if(!silent)setContactStatus(`No pude cargar CONTACTOS_PROCESADOS: ${e.message}`,'error');
  }finally{
    if(btn)btn.disabled=false;
  }
}
$('#syncContacts')?.addEventListener('click',()=>syncDropboxContacts({silent:false}));

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
  renderBackupState();
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

$('#reindexProcessed').onclick=async()=>{
  const s=getDropboxSettings();
  if(!confirm(`¿Reindexar los ZIP de ${s.processedPath}?\n\nEl motor solo analizará los últimos 60 días y recuperará captaciones que versiones anteriores pudieron omitir.`)) return;
  $('#reindexProcessed').disabled=true; $('#processPending').disabled=true; $('#refreshDropbox').disabled=true;
  $('#dropboxProgress').hidden=false;
  try{
    const files=await listPendingZips(s.processedPath);
    $('#dropboxProgressBar').max=Math.max(files.length,1);
    let ok=0,failed=0;
    for(let i=0;i<files.length;i++){
      const entry=files[i];
      $('#dropboxProgressBar').value=i;
      $('#dropboxProgressTitle').textContent='Reindexando chats procesados';
      $('#dropboxProgressCount').textContent=`${i+1}/${files.length}`;
      $('#dropboxProgressDetail').textContent=`Leyendo últimos 60 días · ${entry.name}`;
      try{
        const blob=await downloadDropboxFile(entry.path_lower||entry.path_display);
        const file=new File([blob],entry.name,{type:'application/zip'});
        await importOneZip(file,groupFromName(entry.name),(p)=>{
          if(p.phase==='process') $('#dropboxProgressDetail').textContent=`Analizando ${entry.name}`;
          if(p.phase==='save') $('#dropboxProgressDetail').textContent=`Actualizando índice · ${p.done}/${p.total}`;
          if(p.phase==='demand') $('#dropboxProgressDetail').textContent=`DEMANDAS · ${p.done}/${p.total}`;
        });
        ok++;
      }catch(e){failed++;console.error('reindex',entry.name,e);}
    }
    $('#dropboxProgressBar').value=files.length;
    $('#dropboxProgressTitle').textContent='Reindexación terminada';
    $('#dropboxProgressCount').textContent=`${ok} OK${failed?` · ${failed} error`:''}`;
    $('#dropboxProgressDetail').textContent='Los archivos permanecen en CHAT_PROCESADOS. La base fue actualizada con el motor actual.';
    await loadData();
  }catch(e){
    $('#dropboxProgressTitle').textContent='No pude reindexar';
    $('#dropboxProgressDetail').textContent=e.message;
  }finally{
    $('#reindexProcessed').disabled=false; $('#processPending').disabled=false; $('#refreshDropbox').disabled=false;
  }
};

async function applyWorkerResults(state){
  const touchedDemandIds=new Set();
  for(const job of state.jobs.filter(row=>row.status==='COMPLETED'&&!row.duplicate_of)){
    for(let index=0;index<Number(job.result_chunks||0);index++){
      const key=`radar_ingestion_applied_${job.id}_${index}`;if(localStorage.getItem(key))continue;
      const chunk=await getIngestionResultChunk(job.id,index);await mergeProperties(chunk.properties||[]);await learnContactsFromProperties(chunk.properties||[]);await recordLocationPendings(chunk.location_pendings||[]);
      const demands=demandEngineEnabled&&chunk.demand_messages?.length?processZipDemandMessages(chunk.demand_messages,{resolveTerritory:resolveDemandTerritory}):[],saved=await saveDemandRecords(demands);saved.demandIds.forEach(id=>touchedDemandIds.add(id));localStorage.setItem(key,'1');await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(job.file_hash)await saveImportCheckpoint(job.file_hash,{file_hash:job.file_hash,file_name:job.name,status:'COMPLETED',added:Number(job.result_summary?.unique||0),worker_job_id:job.id,finished_at:job.finished_at});
  }
  if(demandEngineEnabled&&touchedDemandIds.size)await runDemandOpportunityMatching({trigger_type:'DEMAND_CHANGED',trigger_entity_id:[...touchedDemandIds]});await loadData();
}

async function monitorIngestionBatch(batchId){
  $('#processPending').disabled=true;$('#refreshDropbox').disabled=true;$('#dropboxProgress').hidden=false;
  for(;;){
    const state=await getIngestionBatch(batchId),active=state.jobs.find(row=>!['COMPLETED','FAILED'].includes(row.status));
    $('#dropboxProgressTitle').textContent=`Worker · build ${String(state.build_sha||'').slice(0,12)}`;$('#dropboxProgressBar').max=Math.max(state.total,1);$('#dropboxProgressBar').value=state.completed+state.failed;$('#dropboxProgressCount').textContent=`${state.completed+state.failed}/${state.total}`;
    $('#dropboxProgressDetail').textContent=active?`${active.checkpoint} · ${active.name}`:state.failed?`${state.completed} OK · ${state.failed} con error`:'Procesamiento server-side completado';
    if(state.status!=='RUNNING'){await applyWorkerResults(state);localStorage.removeItem(INGESTION_BATCH_KEY);break;}await new Promise(resolve=>setTimeout(resolve,2000));
  }
  $('#processPending').disabled=false;$('#refreshDropbox').disabled=false;await refreshDropboxPending();await maybeAutoBackup();
}

$('#processPending').onclick=async()=>{try{const started=await startIngestionJob();localStorage.setItem(INGESTION_BATCH_KEY,started.batch_id);await monitorIngestionBatch(started.batch_id);}catch(error){$('#dropboxProgress').hidden=false;$('#dropboxProgressTitle').textContent='Worker no disponible';$('#dropboxProgressDetail').textContent=error.message;$('#processPending').disabled=false;$('#refreshDropbox').disabled=false;}};

async function initDropbox() {
  renderDropboxState();
  try {
    const finished=await finishDropboxOAuthIfPresent();
    renderDropboxState();
    if(finished || getDropboxSettings().connected){
      await refreshDropboxPending();

      // Directorio automático:
      // si nunca se cargó en esta versión, se lee CONTACTOS_PROCESADOS inmediatamente.
      const last=Number(localStorage.getItem('gi_contacts_last_sync_v0410')||0);
      if(finished || !last || Date.now()-last>6*60*60*1000){
        await syncDropboxContacts({silent:true});
      }else{
        await refreshContactStats();
      }
    }
  } catch(e) {
    renderDropboxState();
    alert(`Dropbox: ${e.message}`);
  }
}

function secondaryStats(){try{return {...{received:0,pending:0,processed:0,groups:0,properties:0,errors:0,lastSync:null,lastError:null},...JSON.parse(localStorage.getItem(SECONDARY_STATS_KEY)||'{}')};}catch{return {received:0,pending:0,processed:0,groups:0,properties:0,errors:0};}}
function saveSecondaryStats(stats){localStorage.setItem(SECONDARY_STATS_KEY,JSON.stringify(stats));renderSecondaryState(stats);}
function secondaryConfig(){return {endpoint:localStorage.getItem(SECONDARY_ENDPOINT_KEY)||'',token:sessionStorage.getItem(SECONDARY_TOKEN_KEY)||''};}
function renderSecondaryState(stats=secondaryStats()){
  const configured=Boolean(secondaryConfig().endpoint&&secondaryConfig().token),dot=$('#secondaryStatusDot');
  if(dot)dot.className=stats.lastError?'error':configured?'connected':'';
  if($('#secondaryStatusText'))$('#secondaryStatusText').textContent=stats.lastError?'Desconectado':configured?'Conectado':'No configurado';
  if($('#secondaryLastSync'))$('#secondaryLastSync').textContent=stats.lastSync?`Última sincronización: ${new Date(stats.lastSync).toLocaleString('es-VE')}`:'Sin sincronizaciones';
  const values={secondaryReceived:stats.received,secondaryPending:stats.pending,secondaryProcessed:stats.processed,secondaryGroups:stats.groups,secondaryProperties:stats.properties,secondaryErrors:stats.errors};
  for(const [id,value] of Object.entries(values))if($('#'+id))$('#'+id).textContent=Number(value||0).toLocaleString('es-VE');
}
function configureSecondaryAccess(){
  const current=localStorage.getItem(SECONDARY_ENDPOINT_KEY)||`${location.origin}/.netlify/functions/secondary-whatsapp-sync`;
  const endpoint=prompt('URL HTTPS del endpoint TEST secondary-whatsapp-sync:',current);if(endpoint===null)return;
  let parsed;try{parsed=new URL(endpoint,location.href);if(parsed.protocol!=='https:'&&parsed.hostname!=='localhost')throw new Error();}catch{return alert('La URL debe usar HTTPS (o localhost para pruebas).');}
  const token=prompt('Token de lectura TEST. Se guardará solo durante esta sesión del navegador:','');if(!token)return alert('No se guardó ninguna credencial.');
  localStorage.setItem(SECONDARY_ENDPOINT_KEY,parsed.toString());sessionStorage.setItem(SECONDARY_TOKEN_KEY,token);const stats=secondaryStats();stats.lastError=null;saveSecondaryStats(stats);
}
async function syncSecondaryWhatsApp({silent=false}={}){
  if(secondarySyncing)return;const config=secondaryConfig();renderSecondaryState();if(!config.endpoint||!config.token){if(!silent)alert('Configura primero el acceso TEST.');return;}
  secondarySyncing=true;const button=$('#syncSecondaryNow');if(button)button.disabled=true;let stats=secondaryStats(),cursor=localStorage.getItem(SECONDARY_CURSOR_KEY)||'',pages=0;
  try{
    let hasMore=true;
    while(hasMore&&pages<5){
      const source=new SecondaryWhatsAppSource({...config}),page=await source.ingest({cursor,limit:50});const result=processSecondaryEvents(page.events,{locationCatalog,resolveTerritory:resolveDemandTerritory});
      for(const record of result.records){const direct=record.publisher?.observed_phone?contactIndex.byId.get(record.publisher.observed_phone):null,evidence=direct?{status:'resolved',contact:direct,confidence:1,reason:'teléfono observado exacto',matched_name:record.publisher?.observed_name||null}:resolvePropertyContact({sender:record.publisher?.observed_name||record.sender},contactIndex);record.publisher.contact_evidence=evidence.status==='resolved'?{status:'resolved',contact_id:evidence.contact?.id||null,confidence:evidence.confidence,reason:evidence.reason,matched_name:evidence.matched_name}:evidence.status==='ambiguous'?{status:'ambiguous',count:evidence.count}:{status:'none'};record.probable_captor_id=null;record.captor_score=null;}
      const saved=await mergeProperties(result.records);if(result.records.length){await learnContactsFromProperties(result.records);await recordLocationPendings(result.records.flatMap(x=>x.location_pending||[]));}if(demandEngineEnabled&&result.demands.length){await saveDemandRecords(result.demands);await runDemandOpportunityMatching({trigger_type:'DEMAND_CHANGED',trigger_entity_id:[...new Set(result.demands.map(row=>row.id))]});}
      if(result.attachments.length)try{await recordSourceAttachments(result.attachments);}catch(error){diagnosticLog('whatsapp_secondary','media_metadata',`Attachment metadata no disponible: ${error?.name||'Error'}`,'warn');}
      stats.received+=result.validCount;stats.processed+=result.validCount;stats.properties+=result.propertiesDetected;stats.groups=Math.max(stats.groups,result.groupsDetected);stats.pending=page.hasMore?1:0;
      cursor=page.nextCursor||cursor;localStorage.setItem(SECONDARY_CURSOR_KEY,cursor);hasMore=page.hasMore;pages++;
      diagnosticLog('whatsapp_secondary','sync_page',`Recibidos ${result.validCount}; propiedades ${result.propertiesDetected}; nuevas ${saved.added}`,'info');
    }
    stats.lastSync=new Date().toISOString();stats.lastError=null;saveSecondaryStats(stats);await loadData();
  }catch(error){stats.errors++;stats.lastError=error.message;saveSecondaryStats(stats);diagnosticLog('whatsapp_secondary','sync',error.message);if(!silent)alert(`WhatsApp secundario: ${error.message}`);}
  finally{secondarySyncing=false;if(button)button.disabled=false;}
}
$('#configureSecondary')?.addEventListener('click',configureSecondaryAccess);
$('#syncSecondaryNow')?.addEventListener('click',()=>syncSecondaryWhatsApp({silent:false}));
$('#secondaryDiagnostics')?.addEventListener('click',()=>{const box=$('#secondaryDiagnosticBox');if(!box)return;box.hidden=!box.hidden;box.textContent=JSON.stringify({...secondaryStats(),cursor:localStorage.getItem(SECONDARY_CURSOR_KEY)||null,endpointConfigured:Boolean(secondaryConfig().endpoint),tokenConfigured:Boolean(secondaryConfig().token),store:'radar-secondary-whatsapp-v061-test'},null,2);});

async function initApp(){
  const versionLabel=$('#appVersionLabel');if(versionLabel){versionLabel.textContent=APP_LABEL;getWorkerInfo().then(info=>{versionLabel.textContent=`${APP_LABEL} · ${String(info.build_sha||'').slice(0,12)}`;}).catch(()=>{});}
  try{await initLocationSystem();if(demandEngineEnabled)await mirrorLegacyBuyersToDemands();await loadData();await initDropbox();const resumableBatch=localStorage.getItem(INGESTION_BATCH_KEY);if(resumableBatch)await monitorIngestionBatch(resumableBatch);renderBackupState();renderSecondaryState();await syncSecondaryWhatsApp({silent:true});}catch(e){console.error('init app',e);alert(`No pude iniciar completamente la app: ${e.message}`);}
}
initApp();
setInterval(()=>{if(document.visibilityState==='visible')syncSecondaryWhatsApp({silent:true});},5*60*1000);

window.addEventListener('pagehide',()=>rememberSearchPosition());
window.addEventListener('pageshow',e=>{ if(e.persisted) restoreSearchPosition(); });
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden') rememberSearchPosition();
  else if(document.visibilityState==='visible') restoreSearchPosition();
});

if('caches' in window){caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('grupos-inmobiliarios-')&&!k.includes('v0511')).map(k=>caches.delete(k)))).catch(()=>{});}
if ('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('message',event=>{
    if(event.data?.type==='RADAR_VERSION_READY'&&event.data.version===APP_VERSION)console.info(`Radar ${APP_LABEL} listo para usar.`);
  });
  navigator.serviceWorker.register('./sw.js?v=0731').catch(error=>diagnosticLog('pwa','register_service_worker',error?.message||String(error)));
}
