import {PUBLIC_MEDIA_RIGHTS} from './media-foundation.js';
import {serializePublicProperty} from './own-listings.js';
import {masterAvailabilityGate,sourceFreshness} from '../../freshness-utils.js';

export const READINESS_STATUSES=Object.freeze(['READY','VERIFY_AVAILABILITY','NEEDS_FACTS','NEEDS_MEDIA','PRICE_CONFLICT','IDENTITY_REVIEW','RIGHTS_REVIEW','BLOCKED']);
export const ENRICHMENT_TASK_TYPES=Object.freeze(['VERIFY_AVAILABILITY','FIND_FACTS','FIND_MEDIA','VERIFY_PRICE','REVIEW_IDENTITY','VERIFY_MEDIA_RIGHTS']);
const CLOSED=new Set(['SOLD','RENTED','ARCHIVED','EXPIRED','INACTIVE','UNAVAILABLE']);
const REQUIRED_FACTS=['territory','operation','property_type','price_usd'];
const PRIVATE_KEYS=new Set(['commission','commission_pct','own_listing_details','internal_notes','notes','owner','owner_name','owner_phone','phone','phones','private_phone','groups','group','messages','whatsapp','captor','captor_id','fit_score','evidence_score','availability_score','ready_score','readiness_score']);
const clone=value=>value==null?value:structuredClone(value);
const iso=now=>new Date(now).toISOString();
const stableId=value=>String(value??'').replace(/[^a-zA-Z0-9_-]+/g,'_');

function factValues(property,field,evidence=[]){
  const values=[];
  if(property[field]!==undefined&&property[field]!==null&&property[field]!=='')values.push(property[field]);
  for(const row of evidence){
    const key=row.field_name||row.field||row.fact_key;
    if(key===field&&row.active!==false&&row.status!=='REJECTED'){
      const value=row.normalized_value??row.value??row.value_json;
      if(value!==undefined&&value!==null&&value!=='')values.push(typeof value==='object'&&value.value!==undefined?value.value:value);
    }
  }
  return values;
}

const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const hasValue=value=>value!==undefined&&value!==null&&value!=='';
const hasTerritory=property=>['territory_id','municipality_id','municipality','zone_id','zone','complex_id','residence_name','residence'].some(key=>hasValue(property[key]));
function essentialFields(property){
  const type=normalized(property.property_type);
  if(/TERRENO|PARCELA|LOCAL|OFICINA|GALPON/.test(type))return ['area'];
  if(/CASA|APARTAMENTO|APTO|TOWNHOUSE|QUINTA|RESIDENCIAL/.test(type))return ['area','bedrooms','bathrooms'];
  return [];
}
function fieldPresent(property,field,evidence){
  if(field==='territory')return hasTerritory(property);
  if(field==='area')return ['area_m2','land_area_m2'].some(key=>factValues(property,key,evidence).length);
  return factValues(property,field,evidence).length>0;
}

function priceConflict(property,evidence,sourcePosts,now){
  if(property.price_conflict===true||String(property.price_audit_status||'').toUpperCase()==='CONFLICT')return true;
  const explicit=factValues({},'price_usd',evidence).map(Number).filter(Number.isFinite);
  const activeSourcePrices=sourcePosts.filter(row=>row.master_id===property.id&&row.active!==false&&row.is_historical!==true&&!['HISTORICAL','INACTIVE'].includes(normalized(row.status))&&!['expired','unavailable','sold'].includes(sourceFreshness(row,now).code)).map(row=>Number(row.observed_price)).filter(Number.isFinite);
  return new Set([...explicit,...activeSourcePrices]).size>1;
}

function availability(property,sourcePosts,now){
  if(CLOSED.has(normalized(property.status)))return {blocked:true,verify:false,reason:'PROPERTY_NOT_ACTIVE'};
  const gate=masterAvailabilityGate(property,now);
  if(gate.pass)return {blocked:false,verify:false};
  if(sourcePosts.some(row=>row.master_id===property.id&&['verified','recent','probable'].includes(sourceFreshness(row,now).code)))return {blocked:false,verify:false};
  return {blocked:false,verify:true,reason:gate.reason||'AVAILABILITY_REQUIRES_CONFIRMATION'};
}

function mediaState(propertyId,mediaAssets,propertyMedia){
  const assets=new Map(mediaAssets.map(row=>[row.id,row]));
  const linked=propertyMedia.filter(row=>row.property_id===propertyId).map(link=>({link,asset:assets.get(link.media_asset_id)})).filter(row=>row.asset);
  const safe=linked.filter(({link,asset})=>link.client_allowed!==false&&PUBLIC_MEDIA_RIGHTS.has(asset.rights_status));
  const rightsUnknown=linked.some(({asset})=>['UNKNOWN','SOURCE_LINK_ONLY','INTERNAL_ONLY'].includes(asset.rights_status));
  return {linked,safe,rightsUnknown};
}

function identityPending(property,identityLinks=[],reviewQueue=[]){
  if(property.identity_review_required===true||String(property.identity_status||'').toUpperCase()==='REVIEW')return true;
  return identityLinks.some(row=>(row.property_a_id===property.id||row.property_b_id===property.id)&&['PENDING','REVIEW'].includes(String(row.status||row.decision||'PENDING').toUpperCase()))||reviewQueue.some(row=>row.status!=='RESOLVED'&&row.status!=='CLOSED'&&(row.property_id===property.id||row.entity_id===property.id)&&String(row.review_type||'').includes('IDENTITY'));
}

function task(opportunity,type,now,details={}){
  return {id:`enrich_${stableId(opportunity.id)}_${type}`,workspace_id:opportunity.workspace_id||'local',opportunity_id:opportunity.id,property_id:opportunity.property_id,task_type:type,status:'OPEN',details_json:clone(details),created_at:iso(now),updated_at:iso(now)};
}

export function assessOpportunity({opportunity,property,evidence=[],sourcePosts=[],mediaAssets=[],propertyMedia=[],identityLinks=[],reviewQueue=[],now=Date.now()}={}){
  if(!opportunity||!property)throw new Error('opportunity_and_property_required');
  let status='READY',reasons=[],missing_fields=[],tasks=[];
  const available=availability(property,sourcePosts,now);
  if(opportunity.status!=='ACTIVE'||available.blocked){status='BLOCKED';reasons.push(available.reason||'OPPORTUNITY_NOT_ACTIVE');}
  else if(priceConflict(property,evidence,sourcePosts,now)){status='PRICE_CONFLICT';reasons.push('ACTIVE_PRICE_EVIDENCE_CONFLICTS');tasks.push(task(opportunity,'VERIFY_PRICE',now));}
  else if(identityPending(property,identityLinks,reviewQueue)){status='IDENTITY_REVIEW';reasons.push('IDENTITY_REQUIRES_REVIEW');tasks.push(task(opportunity,'REVIEW_IDENTITY',now));}
  else if(available.verify){status='VERIFY_AVAILABILITY';reasons.push(available.reason);tasks.push(task(opportunity,'VERIFY_AVAILABILITY',now));}
  else {
    missing_fields=[...REQUIRED_FACTS,...essentialFields(property)].filter(field=>!fieldPresent(property,field,evidence));
    if(missing_fields.length){status='NEEDS_FACTS';reasons.push('REQUIRED_FACTS_MISSING');tasks.push(task(opportunity,'FIND_FACTS',now,{missing_fields}));}
    else {
      const media=mediaState(property.id,mediaAssets,propertyMedia);
      if(!media.linked.length){status='NEEDS_MEDIA';reasons.push('CLIENT_MEDIA_MISSING');tasks.push(task(opportunity,'FIND_MEDIA',now));}
      else if(!media.safe.length&&media.rightsUnknown){status='RIGHTS_REVIEW';reasons.push('MEDIA_RIGHTS_NOT_PUBLIC');tasks.push(task(opportunity,'VERIFY_MEDIA_RIGHTS',now));}
      else if(!media.safe.length){status='NEEDS_MEDIA';reasons.push('CLIENT_MEDIA_MISSING');tasks.push(task(opportunity,'FIND_MEDIA',now));}
      else reasons.push('FACTS_MEDIA_AVAILABILITY_READY');
    }
  }
  const penalties={READY:0,VERIFY_AVAILABILITY:25,NEEDS_FACTS:35,NEEDS_MEDIA:30,PRICE_CONFLICT:50,IDENTITY_REVIEW:55,RIGHTS_REVIEW:45,BLOCKED:100};
  return {assessment:{id:`readiness_${stableId(opportunity.id)}_${stableId(iso(now))}`,workspace_id:opportunity.workspace_id||'local',opportunity_id:opportunity.id,property_id:opportunity.property_id,status,reasons,gaps:missing_fields,readiness_score:Math.max(0,100-penalties[status]),is_current:true,assessed_at:iso(now),updated_at:iso(now)},tasks};
}

export function buildClientPackage({opportunity,property,assessment,mediaAssets=[],propertyMedia=[],now=Date.now()}={}){
  if(assessment?.status!=='READY')return null;
  const assets=new Map(mediaAssets.map(row=>[row.id,row]));
  const media=propertyMedia.filter(row=>row.property_id===property.id&&row.client_allowed!==false).map(link=>({link,asset:assets.get(link.media_asset_id)})).filter(({asset})=>asset&&PUBLIC_MEDIA_RIGHTS.has(asset.rights_status)).map(({link,asset})=>({id:asset.id,mime_type:asset.mime_type||null,media_role:asset.media_role||null,is_primary:Boolean(link.is_primary),sort_order:link.sort_order??null}));
  const payload={property:serializePublicProperty(property),media:clone(media)};
  for(const key of Object.keys(payload.property))if(PRIVATE_KEYS.has(key))delete payload.property[key];
  return {package:{id:`package_${stableId(opportunity.id)}`,workspace_id:opportunity.workspace_id||'local',opportunity_id:opportunity.id,property_id:property.id,status:'READY',payload_json:payload,created_at:iso(now),updated_at:iso(now)},media:media.map((row,index)=>({id:`package_media_${stableId(opportunity.id)}_${stableId(row.id)}`,package_id:`package_${stableId(opportunity.id)}`,media_asset_id:row.id,status:'ACTIVE',sort_order:row.sort_order??index,is_primary:row.is_primary,created_at:iso(now),updated_at:iso(now)}))};
}

export function reconcileReadiness({opportunities=[],properties=[],evidence=[],sourcePosts=[],mediaAssets=[],propertyMedia=[],identityLinks=[],reviewQueue=[],scope={},now=Date.now()}={}){
  const propertyMap=new Map(properties.map(row=>[row.id,row]));
  const ids=new Set(scope.opportunityIds||[]),propertyIds=new Set(scope.propertyIds||[]);
  const selected=opportunities.filter(row=>scope.full||ids.has(row.id)||propertyIds.has(row.property_id));
  const assessments=[],tasks=[],packages=[],packageMedia=[];
  for(const opportunity of selected){const property=propertyMap.get(opportunity.property_id);if(!property)continue;const result=assessOpportunity({opportunity,property,evidence,sourcePosts,mediaAssets,propertyMedia,identityLinks,reviewQueue,now});assessments.push(result.assessment);tasks.push(...result.tasks);const built=buildClientPackage({opportunity,property,assessment:result.assessment,mediaAssets,propertyMedia,now});if(built){packages.push(built.package);packageMedia.push(...built.media);}}
  return {assessments,tasks,packages,packageMedia,evaluated:selected.length};
}
