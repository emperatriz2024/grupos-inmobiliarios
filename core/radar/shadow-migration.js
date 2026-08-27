const LEGACY_STORES=Object.freeze(['properties','master_properties','source_posts','contacts','municipalities','zones','complexes']);
const clone=value=>structuredClone(value);

export function validateLegacySnapshot(snapshot){
  if(!snapshot||snapshot.format!=='radar-inmobiliario-backup')return {valid:false,error:'invalid_backup_format'};
  if(snapshot.db_name&&snapshot.db_name!=='grupos-inmobiliarios')return {valid:false,error:'db_name_changed'};
  for(const store of LEGACY_STORES)if(snapshot.stores?.[store]!==undefined&&!Array.isArray(snapshot.stores[store]))return {valid:false,error:`invalid_store:${store}`};
  return {valid:true};
}

export function buildShadowExport(snapshot,{workspace_id='00000000-0000-7000-8000-000000000001'}={}){
  const validation=validateLegacySnapshot(snapshot);if(!validation.valid)throw new Error(validation.error);
  const source=clone(snapshot),masters=(source.stores.master_properties||source.stores.properties||[]).map(row=>({...row,legacy_id:row.id,workspace_id}));
  const messages=(source.stores.source_posts||[]).map(row=>({legacy_id:row.id,workspace_id,raw_text:row.original_text||row.text||'',published_at:row.publishedAt||row.published_at||null,source_type:row.sourceType||row.source_type||'legacy',source_channel:row.sourceChannel||row.source_channel||null,legacy_master_id:row.master_id||null}));
  const territories=[...(source.stores.municipalities||[]),...(source.stores.zones||[]),...(source.stores.complexes||[])].map(row=>({...row,legacy_id:row.id,workspace_id}));
  return {format:'radar-core-shadow-0a',workspace_id,source_snapshot_created_at:source.created_at||null,source_counts:Object.fromEntries(LEGACY_STORES.map(store=>[store,(source.stores[store]||[]).length])),master_properties:masters,source_messages:messages,territories};
}

export function validateShadowExport(shadow){
  if(shadow?.format!=='radar-core-shadow-0a')return {valid:false,error:'invalid_shadow_format'};
  if(!Array.isArray(shadow.master_properties)||!Array.isArray(shadow.source_messages)||!Array.isArray(shadow.territories))return {valid:false,error:'invalid_shadow_tables'};
  if(shadow.master_properties.some(row=>!row.legacy_id)||shadow.source_messages.some(row=>!row.legacy_id))return {valid:false,error:'missing_legacy_mapping'};
  return {valid:true};
}

export class AtomicShadowTarget{
  constructor(){this.current=null;}
  migrate(snapshot,{validate=validateShadowExport,logger=()=>{}}={}){
    logger({event:'SHADOW_MIGRATION_STARTED'});const candidate=buildShadowExport(snapshot),result=validate(candidate);
    if(!result.valid){logger({event:'SHADOW_MIGRATION_FAILED',error:result.error});throw new Error(result.error);}
    this.current=clone(candidate);logger({event:'SHADOW_MIGRATION_COMPLETED'});return clone(this.current);
  }
}

export function assertSnapshotUnchanged(before,after){return JSON.stringify(before)===JSON.stringify(after);}

export const SHADOW_LEGACY_DB_NAME='grupos-inmobiliarios';
export const SHADOW_LEGACY_STORES=LEGACY_STORES;
