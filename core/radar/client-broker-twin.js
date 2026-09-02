const unique=values=>[...new Set((values||[]).filter(Boolean))];
const iso=value=>new Date(value||Date.now()).toISOString();

export function buildClientTwin(buyer={},previous=null,now=Date.now()){
  const id=`client_twin_${buyer.id}`;
  return {
    id,buyer_id:buyer.id,workspace_id:'local',name:buyer.name||'',status:buyer.status||'active',urgency:buyer.urgency||'media',
    intent:buyer.intent||previous?.intent||'BUSCANDO',
    mandatory:{operation:buyer.operation||null,property_types:unique(buyer.property_types?.length?buyer.property_types:buyer.property_type?[buyer.property_type]:[]),municipality_ids:unique(buyer.municipality_ids),zone_ids:unique(buyer.zone_ids),min_price:buyer.min_price||null,max_price:buyer.max_price||null,min_bedrooms:buyer.min_bedrooms||null,min_bathrooms:buyer.min_bathrooms||null,min_parking:buyer.min_parking||null,min_area:buyer.min_area||null,max_area:buyer.max_area||null,features:unique(buyer.required_features)},
    preferences:{features:unique(buyer.desired_features)},alternatives:{budget_tolerance:Number(buyer.budget_tolerance||0),authorized:buyer.alternatives_authorized!==false},
    next_action:buyer.next_action||previous?.next_action||null,next_action_at:buyer.next_action_at||previous?.next_action_at||null,last_contact_at:buyer.last_contact_at||previous?.last_contact_at||null,
    created_at:previous?.created_at||iso(now),updated_at:iso(now)
  };
}

export function propertyStateId(buyerId,propertyId){return `client_property_${buyerId}_${propertyId}`;}
export function evolveClientPropertyState(previous,{buyer_id,property_id,status,reason=null,evidence_at=null},now=Date.now()){
  const at=iso(now),allowed=new Set(['REVIEWED','SELECTED','DISCARDED']);if(!allowed.has(status))throw new Error('Estado comprador-propiedad inválido.');
  return {id:propertyStateId(buyer_id,property_id),buyer_id,property_id,status,reason:status==='DISCARDED'?String(reason||'Sin interés').trim():null,evidence_at:evidence_at||previous?.evidence_at||null,created_at:previous?.created_at||at,updated_at:at};
}
export function hasNewEvidence(state,property){return Boolean(state?.status==='DISCARDED'&&property?.updated_at&&String(property.updated_at)>String(state.updated_at));}
export function recommendationAllowed(state,property){return !state||state.status!=='DISCARDED'||hasNewEvidence(state,property);}

export function buildBrokerAgenda({twins=[],matches=[],propertyStates=[],readiness=[],properties=[],now=Date.now()}={}){
  const stateByKey=new Map(propertyStates.map(x=>[`${x.buyer_id}|${x.property_id}`,x])),propertyById=new Map(properties.map(x=>[x.id,x])),readyByProperty=new Map(readiness.filter(x=>x.is_current!==false).map(x=>[x.property_id,x]));
  const at=Number(new Date(now)),items=[];
  for(const twin of twins.filter(x=>x.status==='active')){
    const due=twin.next_action_at&&Number(new Date(twin.next_action_at))<=at;
    if(due)items.push({id:`due_${twin.buyer_id}`,buyer_id:twin.buyer_id,type:'FOLLOW_UP_DUE',priority:100,title:`Seguimiento vencido · ${twin.name}`,why:twin.next_action||'Contactar comprador'});
    for(const match of matches.filter(x=>x.buyer_id===twin.buyer_id)){
      const property=propertyById.get(match.master_id),state=stateByKey.get(`${twin.buyer_id}|${match.master_id}`);if(!recommendationAllowed(state,property))continue;
      const kind=match.strict_ok||match.match_kind==='exact'||match.match_kind==='estricto'?'EXACT':match.match_kind==='alternative'||match.match_kind==='alternativa'?'ALTERNATIVE':'VERIFY';
      if(kind==='EXACT'&&!state)items.push({id:`new_${twin.buyer_id}_${match.master_id}`,buyer_id:twin.buyer_id,property_id:match.master_id,type:'NEW_MATCH',priority:80,title:`Nueva coincidencia · ${twin.name}`,why:(match.reasons||[]).join(' · ')||'Cumple requisitos obligatorios'});
      const ready=readyByProperty.get(match.master_id);if(kind==='VERIFY'||(ready&&ready.status!=='READY'))items.push({id:`verify_${twin.buyer_id}_${match.master_id}`,buyer_id:twin.buyer_id,property_id:match.master_id,type:'VERIFY_PROPERTY',priority:60,title:`Verificar propiedad · ${twin.name}`,why:[...(match.gaps||[]),...(ready?.gaps||[])].join(' · ')||'Falta evidencia comercial'});
    }
  }
  return items.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
}

export function prepareBrokerDraft({twin,properties=[]}={}){
  const names=properties.map(p=>p.residence||p.property_type||'Propiedad').filter(Boolean);
  return {buyer_id:twin?.buyer_id||null,property_ids:properties.map(p=>p.id),message:`Hola ${twin?.name||''}, preparé ${properties.length} ${properties.length===1?'opción':'opciones'} que cumplen tus requisitos: ${names.join(', ')}. ¿Quieres que validemos disponibilidad?`,sent:false};
}
