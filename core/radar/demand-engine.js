import {isDemandRequest} from '../../intent-utils.js';
import {normalizeTerritory} from './territory.js';

export const DEMAND_ORIGINS=Object.freeze(['CLIENT','MARKET','MANUAL']);
export const MATCH_CLASSIFICATIONS=Object.freeze(['EXACT','VERIFY','ALTERNATIVE','REJECTED']);
export const OPPORTUNITY_TYPES=Object.freeze(['CLIENT_PROPERTY','BROKER_OWN_LISTING']);
const EXCLUDED_STATUSES=new Set(['SOLD','RENTED','ARCHIVED','EXPIRED']);
const norm=value=>normalizeTerritory(value);
const known=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const positive=value=>known(value)&&Number(value)>0?Number(value):null;
const uniq=rows=>[...new Set(rows.filter(Boolean))];
const stableHash=value=>{let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);};

export function parseDemandRequest(message={},options={}){
  const text=String(message.text||message.raw_text||'').trim();
  if(!isDemandRequest(text))return null;
  const price=[...text.matchAll(/(?:hasta|max(?:imo|ima)?|tope|presupuesto)?\s*(?:usd|us\$|\$)\s*([\d.,]+)|(?:hasta|max(?:imo|ima)?|tope|presupuesto)\s*([\d.,]+)\s*(?:usd|d[oó]lares?|\$)?/gi)]
    .map(match=>Number(String(match[1]||match[2]||'').replace(/\D/g,''))).filter(Number.isFinite).filter(Boolean).at(-1)||null;
  const spaces=(pattern)=>{const match=text.match(pattern);return match?Number(match[1]):null;};
  const typeMatch=text.match(/\b(apartamento|apto|casa|quinta|town\s*house|townhouse|penthouse|terreno|parcela|local|oficina|galp[oó]n|anexo)\b/i);
  const operation=/\b(?:alquiler|alquilar|arrendar|renta)\b/i.test(text)?'Alquiler':'Venta';
  const resolved=options.resolveTerritory?.(text)||null;
  const sourceChannel=message.source_channel||message.sourceChannel||options.sourceChannel||'manual';
  const sourceId=message.external_message_id||message.messageId||message.source_id||message.sourceId||null;
  const fingerprint=sourceId?`${sourceChannel}|${sourceId}`:`${sourceChannel}|${norm(text)}|${message.author_id||message.sender||''}`;
  return {
    id:`demand_${stableHash(fingerprint)}`,workspace_id:message.workspace_id||'local',client_id:null,
    origin:options.origin||'MARKET',status:'ACTIVE',source_channel:sourceChannel,source_id:sourceId,
    source_fingerprint:fingerprint,raw_text:text,operation,property_types:typeMatch?[typeMatch[1].replace(/apto/i,'apartamento')]:[],
    territory_ids:resolved?.territory_ids||(resolved?.id?[resolved.id]:[]),territory_query:resolved?.query||null,
    max_price:price,min_bedrooms:spaces(/\b(\d{1,2})\s*(?:hab(?:itaciones?)?|cuartos?)\b/i),
    min_bathrooms:spaces(/\b(\d{1,2})\s*ba[ñn]os?\b/i),min_parking:spaces(/\b(\d{1,2})\s*(?:puestos?|estacionamientos?)\b/i),
    budget_tolerance:Number(options.budgetTolerance||0),created_at:message.received_at||message.timestamp||new Date().toISOString(),updated_at:new Date().toISOString()
  };
}

export function legacyBuyerToClientDemand(buyer={}){
  const id=buyer.id||`buyer_${stableHash(`${buyer.name||''}|${buyer.phone||''}`)}`;
  const client={id:`client_${id}`,workspace_id:buyer.workspace_id||'local',legacy_buyer_id:id,name:buyer.name||'Comprador',phone:buyer.phone||'',status:buyer.status==='closed'?'INACTIVE':'ACTIVE',created_at:buyer.created_at||new Date().toISOString(),updated_at:buyer.updated_at||new Date().toISOString()};
  const demand={id:`demand_client_${id}`,workspace_id:client.workspace_id,client_id:client.id,legacy_buyer_id:id,origin:'CLIENT',status:buyer.status==='closed'?'CLOSED':'ACTIVE',operation:buyer.operation||null,property_types:buyer.property_types||[],municipality_ids:buyer.municipality_ids||[],territory_ids:buyer.territory_ids||buyer.zone_ids||[],min_price:buyer.min_price||null,max_price:buyer.max_price||null,budget_tolerance:Number(buyer.budget_tolerance||0),min_bedrooms:buyer.min_bedrooms||null,min_bathrooms:buyer.min_bathrooms||null,min_parking:buyer.min_parking||null,min_area:buyer.min_area||null,max_area:buyer.max_area||null,required_features:buyer.required_features||[],desired_features:buyer.desired_features||[],created_at:buyer.created_at||client.created_at,updated_at:buyer.updated_at||client.updated_at};
  return {client,demand};
}

function territoryGate(demand,property,ontology){
  const requested=uniq(demand.territory_ids||demand.zone_ids||[]);
  if(!requested.length&&!(demand.municipality_ids||[]).length)return {state:'PASS',reason:null};
  const propertyId=property.territory_id||property.zone_id||null;
  if(requested.length){
    if(!propertyId)return {state:'VERIFY',gap:'Territorio de la propiedad no detectado'};
    for(const id of requested){
      if(id===propertyId)return {state:'PASS',reason:'Territorio exacto'};
      if(ontology?.descendants(id)?.some(row=>row.id===propertyId))return {state:'PASS',reason:'Territorio descendiente elegible'};
    }
    return {state:'REJECT',conflict:'Fuera del territorio solicitado'};
  }
  const municipalities=new Set(demand.municipality_ids||[]);
  if(!property.municipality_id)return {state:'VERIFY',gap:'Municipio de la propiedad no detectado'};
  return municipalities.has(property.municipality_id)?{state:'PASS',reason:'Municipio solicitado'}:{state:'REJECT',conflict:'Fuera del municipio solicitado'};
}

export function evaluateDemandProperty(demand={},property={},options={}){
  const reasons=[],gaps=[],conflicts=[];
  const status=String(property.status||'ACTIVE').toUpperCase();
  if(EXCLUDED_STATUSES.has(status)){conflicts.push(`Estado ${status} no elegible`);return scoreResult('REJECTED',reasons,gaps,conflicts,0,0,0);}
  if(demand.status&&String(demand.status).toUpperCase()!=='ACTIVE'){conflicts.push('Demanda inactiva');return scoreResult('REJECTED',reasons,gaps,conflicts,0,0,0);}
  if(demand.origin==='MARKET'&&demand.created_at){const age=(Date.now()-Date.parse(demand.created_at))/86400000;if(Number.isFinite(age)&&age>Number(options.marketDemandMaxAgeDays||60)){conflicts.push('Solicitud de mercado expirada');return scoreResult('REJECTED',reasons,gaps,conflicts,0,0,0);}}
  if(demand.origin==='MARKET'&&property.ownership_scope!=='OWN'){conflicts.push('Solicitud de mercado requiere inventario OWN');return scoreResult('REJECTED',reasons,gaps,conflicts,0,0,0);}
  const expectedOp=norm(demand.operation),actualOp=norm(property.operation);
  if(expectedOp){if(!actualOp)gaps.push('Operación no detectada');else if(expectedOp!==actualOp)conflicts.push('Operación incompatible');else reasons.push('Operación compatible');}
  const types=(demand.property_types||[]).map(norm).filter(Boolean),actualType=norm(property.property_type);
  if(types.length){if(!actualType)gaps.push('Tipo de inmueble no detectado');else if(!types.includes(actualType))conflicts.push('Tipo incompatible');else reasons.push('Tipo compatible');}
  const max=positive(demand.max_price),price=positive(property.price_usd),tolerance=Math.max(0,Number(demand.budget_tolerance||0))/100;
  if(max){if(price==null)gaps.push('Precio no detectado');else if(price>max*(1+tolerance))conflicts.push('Precio supera máximo más tolerancia');else if(price>max)gaps.push('Precio dentro de tolerancia, sobre el máximo');else reasons.push('Dentro del presupuesto');}
  for(const [label,pv,dv] of [['Habitaciones',property.bedrooms,demand.min_bedrooms],['Baños',property.bathrooms,demand.min_bathrooms],['Puestos',property.parking,demand.min_parking]]){
    const minimum=positive(dv);if(!minimum)continue;
    if(!known(pv))gaps.push(`${label}: dato requerido ausente`);else if(Number(pv)<minimum)conflicts.push(`${label}: inferior al mínimo`);else reasons.push(`${label} cumplen`);
  }
  const territory=territoryGate(demand,property,options.territoryOntology);
  if(territory.reason)reasons.push(territory.reason);if(territory.gap)gaps.push(territory.gap);if(territory.conflict)conflicts.push(territory.conflict);
  const hardConflict=conflicts.some(x=>/Operación|Tipo|Precio|inferior|territorio|municipio|Estado|requiere inventario|inactiva/.test(x));
  if(hardConflict)return scoreResult('REJECTED',reasons,gaps,conflicts,0,availabilityScore(property),0);
  const classification=gaps.some(x=>x.includes('dentro de tolerancia'))?'ALTERNATIVE':gaps.length?'VERIFY':'EXACT',fit=classification==='EXACT'?100:classification==='ALTERNATIVE'?64:72,evidence=Math.max(25,100-gaps.length*22),availability=availabilityScore(property);
  return scoreResult(classification,reasons,gaps,conflicts,fit,evidence,availability);
}

function availabilityScore(property){const days=Math.max(0,(Date.now()-Date.parse(property.last_seen_at||property.updated_at||0))/86400000);return days<=7?100:days<=21?85:days<=60?65:40;}
function scoreResult(classification,reasons,gaps,conflicts,fit,evidence,availability){return {classification,reasons:uniq(reasons),gaps:uniq(gaps),conflicts:uniq(conflicts),fit_score:fit,evidence_score:evidence,availability_score:availability,ready_score:Math.round(fit*.5+evidence*.3+availability*.2)};}

export function matchDemandsToProperties(demands=[],properties=[],options={}){
  const candidates=[];
  for(const demand of demands)for(const property of properties){
    const evaluation=evaluateDemandProperty(demand,property,options);
    candidates.push({id:`candidate_${stableHash(`${demand.id}|${property.id}`)}`,demand_id:demand.id,property_id:property.id,...evaluation});
  }
  return candidates;
}

export class OpportunityEngine{
  constructor({opportunities=[],scores=[],events=[],clock=()=>Date.now()}={}){this.opportunities=new Map(opportunities.map(x=>[x.id,{...x}]));this.scores=[...scores];this.events=[...events];this.clock=clock;}
  reconcile(candidates=[],demands=[]){
    const byDemand=new Map(demands.map(x=>[x.id,x])),seen=new Set(),at=new Date(this.clock()).toISOString();
    for(const candidate of candidates){
      const demand=byDemand.get(candidate.demand_id);if(!demand)continue;
      const type=demand.origin==='MARKET'?'BROKER_OWN_LISTING':'CLIENT_PROPERTY',id=`opportunity_${stableHash(`${type}|${candidate.demand_id}|${candidate.property_id}`)}`;seen.add(id);
      const eligible=candidate.classification!=='REJECTED',old=this.opportunities.get(id);
      if(!eligible){if(old?.status==='ACTIVE')this.transition(old,'INVALIDATED','MATCH_NO_LONGER_ELIGIBLE',at);continue;}
      const row=old||{id,workspace_id:demand.workspace_id||'local',opportunity_type:type,demand_id:candidate.demand_id,property_id:candidate.property_id,created_at:at};
      if(!old)this.events.push({event_type:'OPPORTUNITY_CREATED',opportunity_id:id,occurred_at:at});
      else if(old.status==='INVALIDATED')this.events.push({event_type:'OPPORTUNITY_REOPENED',opportunity_id:id,occurred_at:at});
      Object.assign(row,{status:'ACTIVE',classification:candidate.classification,reasons:candidate.reasons,gaps:candidate.gaps,conflicts:candidate.conflicts,updated_at:at,invalidated_at:null,invalidation_reason:null});this.opportunities.set(id,row);
      this.scores.push({id:`score_${stableHash(`${id}|${at}|${this.scores.length}`)}`,opportunity_id:id,fit_score:candidate.fit_score,evidence_score:candidate.evidence_score,availability_score:candidate.availability_score,ready_score:candidate.ready_score,created_at:at});
    }
    for(const row of this.opportunities.values())if(row.status==='ACTIVE'&&!seen.has(row.id))this.transition(row,'INVALIDATED','NOT_IN_CURRENT_RUN',at);
    return {opportunities:[...this.opportunities.values()],scores:this.scores,events:this.events};
  }
  transition(row,status,reason,at){row.status=status;row.invalidated_at=at;row.invalidation_reason=reason;row.updated_at=at;this.events.push({event_type:'OPPORTUNITY_INVALIDATED',opportunity_id:row.id,reason,occurred_at:at});}
}
