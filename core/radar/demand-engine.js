import {isDemandRequest} from '../../intent-utils.js';
import {normalizeTerritory} from './territory.js';

export const DEMAND_ORIGINS=Object.freeze(['CLIENT','MARKET','MANUAL']);
export const MATCH_CLASSIFICATIONS=Object.freeze(['EXACT','VERIFY','ALTERNATIVE','REJECTED']);
export const OPPORTUNITY_TYPES=Object.freeze(['CLIENT_PROPERTY','BROKER_OWN_LISTING']);
export const MARKET_DEMAND_ACTIVE_DAYS=7;
const EXCLUDED_STATUSES=new Set(['SOLD','RENTED','ARCHIVED','EXPIRED']);
const norm=value=>normalizeTerritory(value);
const known=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const positive=value=>known(value)&&Number(value)>0?Number(value):null;
const uniq=rows=>[...new Set(rows.filter(Boolean))];
const stableHash=value=>{let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);};
const iso=value=>new Date(value).toISOString();
const addDays=(value,days)=>iso(new Date(value).getTime()+days*86400000);
const normalizedList=values=>uniq((values||[]).map(norm)).sort();

export function demandCriteriaFingerprint(demand={}){
  return stableHash(JSON.stringify({operation:norm(demand.operation),property_types:normalizedList(demand.property_types),territory_ids:normalizedList(demand.territory_ids),municipality_ids:normalizedList(demand.municipality_ids),min_price:positive(demand.min_price),max_price:positive(demand.max_price),min_bedrooms:positive(demand.min_bedrooms),min_bathrooms:positive(demand.min_bathrooms),min_parking:positive(demand.min_parking),min_area:positive(demand.min_area),max_area:positive(demand.max_area),required_features:normalizedList(demand.required_features),desired_features:normalizedList(demand.desired_features)}));
}

export function isDemandActive(demand={},at=Date.now()){
  if(String(demand.status||'ACTIVE').toUpperCase()!=='ACTIVE')return false;
  if(demand.origin!=='MARKET')return true;
  const expires=Date.parse(demand.expires_at||addDays(demand.last_seen_at||demand.first_seen_at||demand.created_at||at,MARKET_DEMAND_ACTIVE_DAYS));
  return Number.isFinite(expires)&&expires>=Number(at);
}

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
  const requester=String(message.requester_observed||message.author_id||message.authorIdentifier||message.sender||'').trim()||null,observedAt=message.received_at||message.timestamp||new Date().toISOString();
  const sourceFingerprint=sourceId?`${sourceChannel}|${sourceId}`:`${sourceChannel}|${norm(text)}|${requester||''}`;
  const demand={
    id:null,workspace_id:message.workspace_id||'local',client_id:null,
    origin:options.origin||'MARKET',status:'ACTIVE',source_channel:sourceChannel,source_id:sourceId,
    source_fingerprint:sourceFingerprint,requester_observed:requester,raw_text:text,operation,property_types:typeMatch?[typeMatch[1].replace(/apto/i,'apartamento')]:[],
    territory_ids:resolved?.territory_ids||(resolved?.id?[resolved.id]:[]),territory_query:resolved?.query||null,
    max_price:price,min_bedrooms:spaces(/\b(\d{1,2})\s*(?:hab(?:itaciones?)?|cuartos?)\b/i),
    min_bathrooms:spaces(/\b(\d{1,2})\s*ba[ñn]os?\b/i),min_parking:spaces(/\b(\d{1,2})\s*(?:puestos?|estacionamientos?)\b/i),
    budget_tolerance:Number(options.budgetTolerance||0),first_seen_at:observedAt,last_seen_at:observedAt,expires_at:addDays(observedAt,MARKET_DEMAND_ACTIVE_DAYS),created_at:observedAt,updated_at:observedAt
  };
  demand.criteria_fingerprint=demandCriteriaFingerprint(demand);
  demand.id=`demand_${stableHash(`${demand.workspace_id}|${demand.origin}|${requester||sourceFingerprint}|${demand.criteria_fingerprint}`)}`;
  demand.source={id:`demand_source_${stableHash(sourceFingerprint)}`,demand_id:demand.id,source_reference:sourceId||sourceFingerprint,source_channel:sourceChannel,group_thread:message.group_id||message.groupId||message.group||message.thread_id||null,requester_observed:requester,observed_at:observedAt,source_kind:'ORIGINAL',raw_text:text};
  return demand;
}

export function consolidateMarketDemands(records=[],existingDemands=[],existingSources=[],{activeDays=MARKET_DEMAND_ACTIVE_DAYS}={}){
  const demandMap=new Map(),sourceMap=new Map(),identityMap=new Map(),requesterRecentMap=new Map(),sourceIdentityMap=new Map(),changedDemandMap=new Map(),changedSourceMap=new Map();
  const identityKey=row=>row?.origin==='MARKET'&&String(row.requester_observed||'').trim()?`${row.workspace_id||'local'}|MARKET|${String(row.requester_observed||'').trim()}|${row.criteria_fingerprint||demandCriteriaFingerprint(row)}`:null;
  const requesterKey=row=>row?.origin==='MARKET'&&String(row.requester_observed||'').trim()?`${row.workspace_id||'local'}|${String(row.requester_observed||'').trim()}`:null;
  const sourceKeys=row=>uniq([row?.id?`id:${row.id}`:null,row?.source_reference?`ref:${row.source_reference}`:null]);
  const rememberDemand=row=>{if(!row?.id)return;const copy={...row};demandMap.set(copy.id,copy);const identity=identityKey(copy);if(identity)identityMap.set(identity,copy);const requester=requesterKey(copy),seen=Date.parse(copy.last_seen_at||copy.created_at||0);if(requester&&(!requesterRecentMap.has(requester)||seen>=Date.parse(requesterRecentMap.get(requester).last_seen_at||requesterRecentMap.get(requester).created_at||0)))requesterRecentMap.set(requester,copy);};
  const rememberSource=row=>{if(!row?.id)return;const copy={...row};sourceMap.set(copy.id,copy);for(const key of sourceKeys(copy))sourceIdentityMap.set(key,copy);};
  existingDemands.forEach(rememberDemand);existingSources.forEach(rememberSource);
  for(const input of records){
    if(input.origin!=='MARKET'){const row={...input};rememberDemand(row);changedDemandMap.set(row.id,row);continue;}
    const criteria=input.criteria_fingerprint||demandCriteriaFingerprint(input),requester=String(input.requester_observed||'').trim(),identity=requester?`${input.workspace_id||'local'}|MARKET|${requester}|${criteria}`:null;
    const prior=identity?identityMap.get(identity):null;
    const observedAt=input.last_seen_at||input.created_at||new Date().toISOString(),id=prior?.id||input.id,previousRecent=requesterRecentMap.get(`${input.workspace_id||'local'}|${requester}`),row={...(prior||{}),...input,id,criteria_fingerprint:criteria,first_seen_at:prior?.first_seen_at||input.first_seen_at||observedAt,last_seen_at:observedAt,expires_at:addDays(observedAt,activeDays),status:'ACTIVE',updated_at:observedAt};delete row.source;rememberDemand(row);changedDemandMap.set(id,row);
    const relatedUpdate=!prior&&requester&&previousRecent?.id!==id&&Math.abs(Date.parse(observedAt)-Date.parse(previousRecent?.last_seen_at||previousRecent?.created_at||0))<=activeDays*86400000;
    const incomingSource=input.source||{},priorSource=sourceIdentityMap.get(incomingSource.id?`id:${incomingSource.id}`:'')||sourceIdentityMap.get(incomingSource.source_reference?`ref:${incomingSource.source_reference}`:'');
    const source={...priorSource,...incomingSource,id:priorSource?.id||incomingSource.id,demand_id:id,source_kind:priorSource?.source_kind||(prior?'REPOST':relatedUpdate?'UPDATE':'ORIGINAL'),observed_at:incomingSource.observed_at||observedAt,raw_text:incomingSource.raw_text||input.raw_text};
    if(source.id){rememberSource(source);changedSourceMap.set(source.id,source);}
  }
  return {demands:[...demandMap.values()],sources:[...sourceMap.values()],changedDemands:[...changedDemandMap.values()],changedSources:[...changedSourceMap.values()],stats:{identity_index_size:identityMap.size,requester_index_size:requesterRecentMap.size,source_index_size:sourceIdentityMap.size,records_processed:records.length}};
}

export function legacyBuyerToClientDemand(buyer={}){
  const id=buyer.id||`buyer_${stableHash(`${buyer.name||''}|${buyer.phone||''}`)}`;
  const status=buyer.status==='closed'?'CLOSED':buyer.status==='paused'?'PAUSED':'ACTIVE';
  const client={id:`client_${id}`,workspace_id:buyer.workspace_id||'local',legacy_buyer_id:id,name:buyer.name||'Comprador',phone:buyer.phone||'',status,created_at:buyer.created_at||new Date().toISOString(),updated_at:buyer.updated_at||new Date().toISOString()};
  const propertyTypes=(buyer.property_types||[]).filter(Boolean),demand={id:`demand_client_${id}`,workspace_id:client.workspace_id,client_id:client.id,legacy_buyer_id:id,origin:'CLIENT',status,operation:buyer.operation||null,property_types:propertyTypes.length?propertyTypes:buyer.property_type?[buyer.property_type]:[],municipality_ids:buyer.municipality_ids||[],territory_ids:buyer.territory_ids||buyer.zone_ids||[],min_price:buyer.min_price||null,max_price:buyer.max_price||null,budget_tolerance:Number(buyer.budget_tolerance||0),min_bedrooms:buyer.min_bedrooms||null,min_bathrooms:buyer.min_bathrooms||null,min_parking:buyer.min_parking||null,min_area:buyer.min_area||null,max_area:buyer.max_area||null,required_features:[...(buyer.required_features||[])],desired_features:[...(buyer.desired_features||[])],created_at:buyer.created_at||client.created_at,updated_at:buyer.updated_at||client.updated_at};
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
  const evaluationAt=options.now??Date.now();
  if(!isDemandActive(demand,evaluationAt)){conflicts.push(demand.origin==='MARKET'?'Solicitud de mercado expirada':'Demanda inactiva');return scoreResult('REJECTED',reasons,gaps,conflicts,0,0,0);}
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
  const minArea=positive(demand.min_area),maxArea=positive(demand.max_area),area=positive(property.area_m2);
  if(minArea||maxArea){if(area==null)gaps.push('Área: dato requerido ausente');else if((minArea&&area<minArea)||(maxArea&&area>maxArea))conflicts.push('Área incompatible con el rango requerido');else reasons.push('Área cumple');}
  for(const feature of demand.required_features||[]){const state=featureKnowledge(property,feature);if(state==='TRUE')reasons.push(`${feature}: confirmado`);else if(state==='FALSE')conflicts.push(`${feature}: requisito incompatible`);else gaps.push(`${feature}: requisito sin evidencia`);}
  for(const feature of demand.desired_features||[]){const state=featureKnowledge(property,feature);if(state==='TRUE')reasons.push(`${feature}: deseable confirmado`);else gaps.push(`${feature}: deseable no confirmado`);}
  const territory=territoryGate(demand,property,options.territoryOntology);
  if(territory.reason)reasons.push(territory.reason);if(territory.gap)gaps.push(territory.gap);if(territory.conflict)conflicts.push(territory.conflict);
  const hardConflict=conflicts.some(x=>/Operación|Tipo|Precio|inferior|territorio|municipio|Estado|requiere inventario|inactiva|Área incompatible|requisito incompatible/.test(x));
  if(hardConflict)return scoreResult('REJECTED',reasons,gaps,conflicts,0,availabilityScore(property),0);
  const classification=gaps.some(x=>x.includes('dentro de tolerancia'))?'ALTERNATIVE':gaps.length?'VERIFY':'EXACT',fit=classification==='EXACT'?100:classification==='ALTERNATIVE'?64:72,evidence=Math.max(25,100-gaps.length*22),availability=availabilityScore(property);
  return scoreResult(classification,reasons,gaps,conflicts,fit,evidence,availability);
}

function featureKnowledge(property,feature){
  const evidence=property.feature_evidence?.[feature];
  if(evidence===true||String(evidence).toUpperCase()==='TRUE'||String(evidence).toUpperCase()==='PRESENT')return 'TRUE';
  if(evidence===false||String(evidence).toUpperCase()==='FALSE'||String(evidence).toUpperCase()==='ABSENT')return 'FALSE';
  if(property[feature]===true)return 'TRUE';
  if((property.known_features||[]).includes(feature)&&property[feature]===false)return 'FALSE';
  return 'UNKNOWN';
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

export function prefilterDemandPropertyCandidates(demands=[],properties=[],options={}){
  const demandIds=options.demandIds?new Set(options.demandIds):null,propertyIds=options.propertyIds?new Set(options.propertyIds):null;
  const scopedDemands=demands.filter(row=>!demandIds||demandIds.has(row.id)),scopedProperties=properties.filter(row=>!propertyIds||propertyIds.has(row.id)),eligibleProperties=scopedProperties.filter(row=>!EXCLUDED_STATUSES.has(String(row.status||'ACTIVE').toUpperCase()));
  const byOperation=new Map(),byType=new Map(),own=new Set();
  const add=(map,key,row)=>{if(!key)return;const set=map.get(key)||new Set();set.add(row);map.set(key,set);};
  for(const property of eligibleProperties){add(byOperation,norm(property.operation),property);add(byType,norm(property.property_type),property);if(property.ownership_scope==='OWN')own.add(property);}
  const pairs=[];
  for(const demand of scopedDemands){
    if(!isDemandActive(demand,options.now??Date.now()))continue;
    let candidates=demand.origin==='MARKET'?[...own]:eligibleProperties;
    const operation=norm(demand.operation);if(operation&&byOperation.has(operation))candidates=candidates.filter(row=>byOperation.get(operation).has(row));else if(operation)candidates=candidates.filter(row=>!norm(row.operation));
    const types=normalizedList(demand.property_types);if(types.length)candidates=candidates.filter(row=>!norm(row.property_type)||types.some(type=>byType.get(type)?.has(row)));
    const max=positive(demand.max_price),tolerance=Math.max(0,Number(demand.budget_tolerance||0))/100;if(max)candidates=candidates.filter(row=>!positive(row.price_usd)||positive(row.price_usd)<=max*(1+tolerance));
    const territories=new Set(demand.territory_ids||[]),municipalities=new Set(demand.municipality_ids||[]);if(territories.size)candidates=candidates.filter(row=>!row.territory_id&&!row.zone_id||territories.has(row.territory_id||row.zone_id)||options.territoryOntology&&[...territories].some(id=>options.territoryOntology.descendants(id).some(x=>x.id===(row.territory_id||row.zone_id))));else if(municipalities.size)candidates=candidates.filter(row=>!row.municipality_id||municipalities.has(row.municipality_id));
    for(const property of candidates)pairs.push({demand,property});
  }
  return {pairs,stats:{demands_total:demands.length,properties_total:properties.length,scoped_demands:scopedDemands.length,scoped_properties:scopedProperties.length,cartesian_universe:demands.length*properties.length,scoped_universe:scopedDemands.length*scopedProperties.length,prefiltered_pairs:pairs.length}};
}

export function matchPrefilteredCandidates(demands=[],properties=[],options={}){
  const prefilter=prefilterDemandPropertyCandidates(demands,properties,options),candidates=prefilter.pairs.map(({demand,property})=>({id:`candidate_${stableHash(`${demand.id}|${property.id}`)}`,demand_id:demand.id,property_id:property.id,...evaluateDemandProperty(demand,property,options)}));
  return {...prefilter,candidates};
}

export class OpportunityEngine{
  constructor({opportunities=[],scores=[],events=[],clock=()=>Date.now()}={}){this.opportunities=new Map(opportunities.map(x=>[x.id,{...x}]));this.scores=[...scores];this.events=[...events];this.clock=clock;}
  reconcile(candidates=[],demands=[],scope={full:true}){
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
    const demandScope=scope.demandIds?new Set(scope.demandIds):null,propertyScope=scope.propertyIds?new Set(scope.propertyIds):null,inScope=row=>scope.full===true||demandScope?.has(row.demand_id)||propertyScope?.has(row.property_id);
    for(const row of this.opportunities.values())if(row.status==='ACTIVE'&&inScope(row)&&!seen.has(row.id))this.transition(row,'INVALIDATED','NOT_IN_CURRENT_RUN',at);
    return {opportunities:[...this.opportunities.values()],scores:this.scores,events:this.events};
  }
  transition(row,status,reason,at){row.status=status;row.invalidated_at=at;row.invalidation_reason=reason;row.updated_at=at;this.events.push({event_type:'OPPORTUNITY_INVALIDATED',opportunity_id:row.id,reason,occurred_at:at});}
}
