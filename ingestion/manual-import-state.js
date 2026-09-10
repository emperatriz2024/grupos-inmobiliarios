export const IMPORT_ENGINE_VERSION='0780-iphone-zip';

export function fileSelectionKey(file){
  return `${String(file?.name||'')}\u0000${Number(file?.size||0)}\u0000${Number(file?.lastModified||0)}`;
}

export function mergeSelectedZipFiles(previous=[],incoming=[]){
  const merged=new Map();
  for(const file of [...previous,...incoming]){
    if(/\.zip$/i.test(String(file?.name||'')))merged.set(fileSelectionKey(file),file);
  }
  return [...merged.values()];
}

export function checkpointDisposition(checkpoint){
  const status=String(checkpoint?.status||'').toUpperCase();
  if(!['COMPLETED','COMPLETE','ALREADY_PROCESSED'].includes(status))return 'RESUME';
  const properties=Number(checkpoint?.unique??checkpoint?.detected??checkpoint?.properties_detected??0);
  return properties>0?'ALREADY_PROCESSED':'REINDEX_REQUIRED';
}

export function importSanity(result={}){
  const total=Number(result.messages_total??result.messages??0),afterAge=Number(result.messages??0),detected=Number(result.properties_detected??0),unique=Number(result.unique?.length??result.unique??0),requestsSkipped=Number(result.requests_skipped??0);
  return {messages_total:total,messages_after_age_filter:afterAge,properties_detected:detected,unique,requests_skipped:requestsSkipped,parser_diagnostics:{date_order:result.date_order??null,cutoff_date:result.cutoff_date??null,messages_skipped_age:Number(result.messages_skipped_age??0)},suspicious:afterAge>0&&detected===0&&unique===0};
}
