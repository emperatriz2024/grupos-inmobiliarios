import { getLocationCatalog, getMasterProperties, getBuyers, getRequests, getSelections, saveRequest, saveSelection, recordSelectionPublication, getPreviouslySentMasterIds } from './db.js?v=0601';
import { BUYER_FEATURES } from './buyer-utils.js?v=0601';
import { matchRequestToMasters, normalizeRequestCriteria, parseRequestText, requestCriteriaSummary } from './request-utils.js?v=0601';
import { buildPublicSelection } from './selection-utils.js?v=0601';
import { disablePublishedSelection, publishSelection, updatePublishedSelection } from './selection-api.js?v=0601';

const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const TYPES=['Apartamento','Townhouse','Casa','Penthouse','Terreno','Local comercial','Oficina','Galpón'];
let catalog={municipalities:[],zones:[],complexes:[]},draft=null,currentRequest=null,currentMatches=null,masters=[],selected=new Set(),pendingSelection=null;

function values(id){return [...document.querySelectorAll(`#${id} input:checked`)].map(x=>x.value);}
function number(id){const n=Number($(id)?.value);return Number.isFinite(n)&&n>0?n:null;}
function fillChoices(){
  $('#requestTypes').innerHTML=TYPES.map(type=>`<label><input type="checkbox" value="${esc(type)}"> ${esc(type)}</label>`).join('');
  $('#requestRequired').innerHTML=BUYER_FEATURES.map(([key,label])=>`<label><input type="checkbox" value="${esc(key)}"> ${esc(label)}</label>`).join('');
  $('#requestDesired').innerHTML=BUYER_FEATURES.map(([key,label])=>`<label><input type="checkbox" value="${esc(key)}"> ${esc(label)}</label>`).join('');
  $('#requestMunicipalities').innerHTML=(catalog.municipalities||[]).filter(x=>x.activo!==false).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')).map(row=>`<label><input type="checkbox" value="${esc(row.id)}"> ${esc(row.nombre)}</label>`).join('');
  $('#requestZones').innerHTML=(catalog.zones||[]).filter(x=>x.activo!==false).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')).map(zone=>`<label><input type="checkbox" value="${esc(zone.id)}"> ${esc(zone.nombre)}</label>`).join('');
  $('#requestComplexes').innerHTML=(catalog.complexes||[]).filter(x=>x.activo!==false).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')).map(row=>`<label><input type="checkbox" value="${esc(row.id)}"> ${esc(row.nombre)}</label>`).join('');
  $('#requestBuyer').innerHTML='<option value="">Sin comprador</option>';
}

function applyCriteria(criteria={}){
  const c=normalizeRequestCriteria(criteria);
  $('#requestOperation').value=c.operation||'';$('#requestMinPrice').value=c.min_price||'';$('#requestMaxPrice').value=c.max_price||'';
  $('#requestMinBedrooms').value=c.min_bedrooms||'';$('#requestMinBathrooms').value=c.min_bathrooms||'';$('#requestMinParking').value=c.min_parking||'';
  $('#requestMinArea').value=c.min_area||'';$('#requestMaxArea').value=c.max_area||'';$('#requestTolerance').value=String(c.budget_tolerance||0);
  $('#requestVigency').value=c.vigency_requirement||'active';
  for(const [id,set] of [['requestTypes',c.property_types],['requestMunicipalities',c.municipality_ids],['requestZones',c.zone_ids],['requestComplexes',c.complex_ids],['requestRequired',c.required_features],['requestDesired',c.desired_features]])document.querySelectorAll(`#${id} input`).forEach(input=>input.checked=set.includes(input.value));
}

function collectCriteria(){
  const required=values('requestRequired');
  return normalizeRequestCriteria({operation:$('#requestOperation').value||null,property_types:values('requestTypes'),municipality_ids:values('requestMunicipalities'),zone_ids:values('requestZones'),complex_ids:values('requestComplexes'),
    min_price:number('#requestMinPrice'),max_price:number('#requestMaxPrice'),min_area:number('#requestMinArea'),max_area:number('#requestMaxArea'),
    min_bedrooms:number('#requestMinBedrooms'),min_bathrooms:number('#requestMinBathrooms'),min_parking:number('#requestMinParking'),
    required_features:required,desired_features:values('requestDesired').filter(x=>!required.includes(x)),budget_tolerance:Number($('#requestTolerance').value||0),vigency_requirement:$('#requestVigency').value||'active'});
}

function renderInterpretation(parsed){
  const messages=[...(parsed.ambiguities||[]).map(x=>`<li class="requestConflict">⚠ ${esc(x)}</li>`),...(parsed.warnings||[]).map(x=>`<li>△ ${esc(x)}</li>`)].join('');
  $('#requestInterpretation').hidden=false;
  $('#requestInterpretation').innerHTML=`<b>Criterios interpretados — confirma antes de buscar</b><p>${esc(requestCriteriaSummary(parsed.criteria,catalog))}</p>${messages?`<ul>${messages}</ul>`:''}`;
}

async function analyzeNatural(){draft=parseRequestText($('#requestNatural').value,catalog);applyCriteria(draft.criteria);renderInterpretation(draft);}
function resultCard(row,kind,isNew){const m=row.master;return `<article class="requestResultCard"><label class="requestSelect"><input type="checkbox" data-master="${esc(m.id)}" ${selected.has(m.id)?'checked':''}> Seleccionar</label><div><span class="requestTier ${kind}">${kind==='exact'?'Coincidencia exacta':kind==='verify'?'Por verificar':'Alternativa'}</span>${isNew?'<span class="requestNew">Nueva opción</span>':''}<h3>${esc(m.residence||m.property_type||'Inmueble maestro')}</h3><p>${esc([m.zone,m.municipality].filter(Boolean).join(' · ')||'Ubicación por verificar')}</p><strong>${m.price_usd!=null?`$${Number(m.price_usd).toLocaleString('es-VE')}`:'Precio no detectado'}</strong><div class="requestReasons">${row.reasons.slice(0,4).map(x=>`<span>✓ ${esc(x)}</span>`).join('')}${row.gaps.slice(0,4).map(x=>`<span>△ ${esc(x)}</span>`).join('')}</div></div></article>`;}

async function renderMatches(){
  if(!currentMatches)return;
  const sent=new Set(await getPreviouslySentMasterIds({requestId:currentRequest?.id,buyerId:currentRequest?.buyer_id}));
  const group=(title,rows,kind)=>`<section class="requestResultGroup"><h3>${title} <small>${rows.length}</small></h3>${rows.length?rows.map(row=>resultCard(row,kind,!sent.has(row.master_id))).join(''):'<p class="empty">Sin resultados en esta categoría.</p>'}</section>`;
  $('#requestResults').innerHTML=group('Coincidencias exactas',currentMatches.exact,'exact')+group('Por verificar',currentMatches.verify,'verify')+group('Alternativas',currentMatches.alternatives,'alternative');
  $('#requestSelectionBar').hidden=false;updateSelectionCount();
  $('#requestResults').querySelectorAll('input[data-master]').forEach(input=>input.onchange=()=>{input.checked?selected.add(input.dataset.master):selected.delete(input.dataset.master);updateSelectionCount();});
}
function updateSelectionCount(){$('#requestSelectedCount').textContent=String(selected.size);}

async function runRequest(){
  const criteria=collectCriteria();
  if(!criteria.operation)throw new Error('Confirma la operación antes de buscar.');
  if(!criteria.property_types.length)throw new Error('Selecciona al menos un tipo de inmueble.');
  currentRequest=await saveRequest({id:currentRequest?.id,title:$('#requestTitle').value.trim()||'Solicitud inmobiliaria',buyer_id:$('#requestBuyer').value||null,natural_text:$('#requestNatural').value,criteria,status:'active'});
  masters=await getMasterProperties();currentMatches=matchRequestToMasters(currentRequest,masters);selected.clear();await renderMatches();await renderRequestList();
}

async function renderRequestList(){const rows=await getRequests();$('#requestSavedList').innerHTML=rows.length?rows.map(row=>`<button class="savedRequest" data-id="${esc(row.id)}"><b>${esc(row.title)}</b><span>${esc(requestCriteriaSummary(row.criteria,catalog))}</span></button>`).join(''):'<p class="empty">Todavía no hay solicitudes guardadas.</p>';$('#requestSavedList').querySelectorAll('[data-id]').forEach(button=>button.onclick=async()=>{currentRequest=rows.find(x=>x.id===button.dataset.id);$('#requestTitle').value=currentRequest.title;$('#requestNatural').value=currentRequest.natural_text||'';$('#requestBuyer').value=currentRequest.buyer_id||'';applyCriteria(currentRequest.criteria);renderInterpretation({criteria:currentRequest.criteria,warnings:[],ambiguities:[]});masters=await getMasterProperties();currentMatches=matchRequestToMasters(currentRequest,masters);selected.clear();await renderMatches();});}

async function prepareSelection(){
  if(!selected.size)throw new Error('Selecciona al menos una propiedad.');
  const buyer=(await getBuyers()).find(x=>x.id===currentRequest?.buyer_id);
  const existing=(await getSelections()).find(row=>row.request_id===currentRequest?.id&&row.status==='active');
  pendingSelection=await saveSelection({...existing,request_id:currentRequest?.id,buyer_id:currentRequest?.buyer_id||null,title:$('#requestTitle').value.trim()||'Selección de propiedades',client_name:buyer?.name||existing?.client_name||'',master_property_ids:[...selected],status:existing?.status||'draft'});
  $('#selectionPublishTitle').value=pendingSelection.title;$('#selectionClientName').value=pendingSelection.client_name||'';$('#selectionAdminToken').value='';$('#disableSelectionLink').hidden=!pendingSelection.public_slug;$('#selectionPublishDialog').showModal();
}
async function publishPrepared(event){
  event.preventDefault();const token=$('#selectionAdminToken').value,wasPublished=!!pendingSelection.public_slug;$('#selectionAdminToken').value='';
  const selectedMasters=masters.filter(x=>selected.has(x.id)),expiresInput=$('#selectionExpiresAt').value;pendingSelection=await saveSelection({...pendingSelection,title:$('#selectionPublishTitle').value.trim(),client_name:$('#selectionClientName').value.trim(),expires_at:expiresInput?new Date(expiresInput).toISOString():null});
  const payload=buildPublicSelection(pendingSelection,selectedMasters);const result=pendingSelection.public_slug?await updatePublishedSelection(pendingSelection.public_slug,payload,token):await publishSelection(payload,token);
  pendingSelection=await saveSelection({...pendingSelection,public_slug:result.slug,public_url:new URL(result.url,location.origin).href,status:'active',sent_master_property_ids:[...selected]});
  await recordSelectionPublication(pendingSelection,wasPublished?'updated':'published');$('#selectionPublishDialog').close();
  const message=`Hola${pendingSelection.client_name?` ${pendingSelection.client_name}`:''}. Preparé una selección de propiedades que se ajustan a lo que estás buscando. Puedes revisarlas aquí:\n\n${pendingSelection.public_url}\n\nCuando las veas me dices cuáles te interesan y coordinamos.`;
  $('#requestShareResult').hidden=false;$('#requestShareResult').innerHTML=`<b>Selección publicada</b><a href="${esc(pendingSelection.public_url)}" target="_blank" rel="noopener">${esc(pendingSelection.public_url)}</a><a class="primary" href="https://wa.me/?text=${encodeURIComponent(message)}" target="_blank" rel="noopener">Compartir por WhatsApp</a>`;
}
async function disablePrepared(){
  if(!pendingSelection?.public_slug)return;const token=$('#selectionAdminToken').value;if(!token)throw new Error('Introduce la credencial para desactivar el link.');
  await disablePublishedSelection(pendingSelection.public_slug,token);$('#selectionAdminToken').value='';pendingSelection=await saveSelection({...pendingSelection,status:'disabled'});await recordSelectionPublication(pendingSelection,'disabled');$('#selectionPublishDialog').close();$('#requestShareResult').hidden=false;$('#requestShareResult').textContent='El link fue desactivado y ya no muestra inventario.';
}

export async function initRequestsModule(){
  catalog=await getLocationCatalog();fillChoices();const buyers=await getBuyers();$('#requestBuyer').innerHTML='<option value="">Sin comprador</option>'+buyers.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');await renderRequestList();
  $('#analyzeRequestText').onclick=()=>analyzeNatural().catch(error=>alert(error.message));$('#runRequest').onclick=()=>runRequest().catch(error=>alert(error.message));
  $('#requestSelectAll').onclick=()=>{for(const row of [...(currentMatches?.exact||[]),...(currentMatches?.verify||[])])selected.add(row.master_id);renderMatches();};
  $('#requestDeselectAll').onclick=()=>{selected.clear();renderMatches();};$('#createSelection').onclick=()=>prepareSelection().catch(error=>alert(error.message));
  $('#closeSelectionPublish').onclick=()=>{$('#selectionAdminToken').value='';$('#selectionPublishDialog').close();};$('#selectionPublishForm').onsubmit=event=>publishPrepared(event).catch(error=>alert(error.message));$('#disableSelectionLink').onclick=()=>disablePrepared().catch(error=>alert(error.message));
}
