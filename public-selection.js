import { getPublicSelection } from './selection-api.js?v=0601';

const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const money=value=>Number.isFinite(Number(value))?`$${Number(value).toLocaleString('es-VE')}`:'Precio por consultar';
const id=new URL(location.href).searchParams.get('id')||'';
const status=document.querySelector('#publicSelectionStatus'),results=document.querySelector('#publicSelectionResults');

function card(property){
  const facts=[[property.area_m2,'m²'],[property.bedrooms,'hab'],[property.bathrooms,'baños'],[property.parking,'puestos']].filter(([value])=>value!==undefined&&value!==null);
  const features=[['planta_electrica','Planta eléctrica'],['planta_100','Planta 100%'],['pozo','Pozo'],['tanque','Tanque'],['piscina','Piscina'],['amoblado','Amoblado'],['financiamiento','Financiamiento']].filter(([key])=>property[key]);
  return `<article class="publicPropertyCard">${property.main_photo_url?`<img src="${esc(property.main_photo_url)}" alt="Foto de la propiedad" loading="lazy" referrerpolicy="no-referrer">`:''}<div class="publicPropertyBody"><div class="eyebrow">${esc(property.operation||'INMUEBLE')}</div><h2>${esc(property.residence||property.property_type||'Propiedad seleccionada')}</h2><p>${esc(property.zone||'Ubicación por consultar')}</p><strong class="publicPrice">${esc(money(property.price_usd))}</strong>${facts.length?`<div class="publicFacts">${facts.map(([value,label])=>`<span>${esc(value)} ${esc(label)}</span>`).join('')}</div>`:''}${features.length?`<div class="publicFeatures">${features.map(([,label])=>`<span>${esc(label)}</span>`).join('')}</div>`:''}${property.public_description?`<p class="publicDescription">${esc(property.public_description)}</p>`:''}</div></article>`;
}

try{
  if(!/^[a-z0-9]{16,32}$/i.test(id))throw new Error('Selección no disponible.');
  const payload=await getPublicSelection(id);
  document.title=`${payload.title} · Emperatriz Abre Puertas`;
  document.querySelector('#publicSelectionSubtitle').textContent=payload.client_name?`${payload.title} para ${payload.client_name}`:payload.title;
  status.hidden=true;results.innerHTML=(payload.properties||[]).map(card).join('')||'<div class="card">Esta selección todavía no contiene propiedades.</div>';
}catch{
  status.textContent='Esta selección no está disponible, venció o fue desactivada.';status.dataset.kind='error';
}
