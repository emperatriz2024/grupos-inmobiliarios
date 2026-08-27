import {CandidateIndex,PropertyIdentityEngine} from './identity-engine.js';

export class PropertyIdentityService{
  constructor({foundation,engine=new PropertyIdentityEngine(),index=new CandidateIndex(),mediaFoundation=null}={}){this.foundation=foundation;this.engine=engine;this.index=index;this.mediaFoundation=mediaFoundation;this.links=new Map();this.redirects=new Map();this.reviewQueue=new Map();}
  indexProperty(property){this.index.add(property);return property;}
  assessSource(source){return this.engine.resolve(source,this.index);}
  recordReview(type,entity_id,payload,context={}){const id=this.foundation.id(),row={id,workspace_id:this.foundation.workspaceId,review_type:type,entity_type:'master_property',entity_id,status:'PENDING',priority:type==='PRICE_CONFLICT'?20:10,payload_json:structuredClone(payload),created_at:new Date(this.foundation.clock()).toISOString(),resolved_at:null,resolved_by:null};this.reviewQueue.set(id,row);this.foundation.emit('IDENTITY_REVIEW_REQUIRED','review',id,payload,context);return row;}
  linkRecord(a,b,evaluation,decision='PENDING'){const [property_a_id,property_b_id]=[a,b].sort(),key=`${property_a_id}:${property_b_id}`,old=this.links.get(key),row={id:old?.id||this.foundation.id(),workspace_id:this.foundation.workspaceId,property_a_id,property_b_id,identity_score:evaluation.score,decision,signals_json:[...evaluation.strong,...evaluation.compatible],conflicts_json:evaluation.conflicts,identity_model_version:evaluation.identity_model_version,created_at:old?.created_at||new Date(this.foundation.clock()).toISOString(),reviewed_at:null,reviewed_by:null,resolution_notes:null};this.links.set(key,row);return row;}
  ingestDecision(source,{source_message_id,identity_key,fields={},correlation_id}={}){
    const result=this.assessSource(source),best=result.best;
    if(best?.band==='AUTO_LINK'){const linked=this.foundation.linkSourceToProperty({property_id:best.candidate_id,source_message_id,identity_confidence:best.score,correlation_id});this.foundation.emit('IDENTITY_AUTO_LINKED','master_property',best.candidate_id,{source_message_id,signals:best.strong},{correlation_id});return {decision:'AUTO_LINK',property_id:best.candidate_id,evaluation:best,linked};}
    if(best?.band==='REVIEW'){const review=this.recordReview(best.price_conflict?.pct>20?'PRICE_CONFLICT':'POSSIBLE_DUPLICATE',best.candidate_id,{source_message_id,evaluation:best},{correlation_id});return {decision:'REVIEW',review,evaluation:best};}
    const created=this.foundation.createOrLinkProperty({identity_key,fields,source_message_id,correlation_id});this.indexProperty({...created.property,...source});return {decision:'NEW_PROPERTY',property_id:created.property.id,evaluation:best,created};
  }
  mergePropertyMasters(sourceMasterId,targetMasterId,{decisionReference,actorId,reason='confirmed_same_property'}={}){
    if(!decisionReference||!actorId)throw new Error('merge_requires_human_decision');const source=this.foundation.properties.get(sourceMasterId),target=this.foundation.properties.get(targetMasterId);if(!source||!target)throw new Error('property_not_found');
    for(const link of this.foundation.propertySources.values())if(link.property_id===sourceMasterId)link.property_id=targetMasterId;
    for(const fact of this.foundation.evidence.values())if(fact.entity_id===sourceMasterId)fact.entity_id=targetMasterId;
    for(const [key,fact] of [...this.foundation.canonicalFacts])if(fact.property_id===sourceMasterId){const targetKey=`${targetMasterId}:${fact.field_key}`;if(!this.foundation.canonicalFacts.has(targetKey))this.foundation.canonicalFacts.set(targetKey,{...fact,property_id:targetMasterId});this.foundation.canonicalFacts.delete(key);}
    if(this.mediaFoundation)for(const link of this.mediaFoundation.propertyMedia.values())if(link.property_id===sourceMasterId)link.property_id=targetMasterId;
    source.status='ARCHIVED';source.updated_at=new Date(this.foundation.clock()).toISOString();const redirect={old_property_id:sourceMasterId,canonical_property_id:targetMasterId,merged_at:source.updated_at,reason,decision_reference:decisionReference};this.redirects.set(sourceMasterId,redirect);
    const context={actor_type:'user',correlation_id:this.foundation.id()};this.foundation.emit('PROPERTY_MERGED','master_property',targetMasterId,{source_property_id:sourceMasterId,decision_reference:decisionReference},{...context});this.foundation.emit('PROPERTY_REDIRECT_CREATED','master_property',sourceMasterId,redirect,{...context});return {source,target,redirect};
  }
}

export async function ingestMessageWithOptionalMedia({saveMessage,saveFacts,mediaWork,markAttachmentFailed=()=>{}},input){const message=await saveMessage(input);const facts=await saveFacts(message,input);let media=null;try{media=await mediaWork?.(message,input)??null;}catch(error){markAttachmentFailed(error);media={status:'FAILED',error_name:error?.name||'Error'};}return {message,facts,media};}
