export const emptyZipBatchSummary=total=>({selected:total,processed:0,skipped:0,failed:0,added:0,updated:0,duplicates:0,pending:total});

export async function runManualZipBatch(files=[],{
  importOneZip,groupFromName=file=>file.name.replace(/\.zip$/i,''),onProgress=()=>{},onlyNames=null
}={}){
  if(typeof importOneZip!=='function')throw new Error('importOneZip_required');
  const selected=[...files].filter(file=>/\.zip$/i.test(file?.name||'')&&(!onlyNames||onlyNames.has(file.name)));
  const summary=emptyZipBatchSummary(selected.length),results=[],failures=[];
  onProgress({stage:'start',index:0,total:selected.length,summary:{...summary}});
  for(let index=0;index<selected.length;index++){
    const file=selected[index],position=index+1;onProgress({stage:'file_start',file,index:position,total:selected.length,summary:{...summary}});
    try{
      const result=await importOneZip(file,groupFromName(file),progress=>onProgress({stage:'file_progress',file,index:position,total:selected.length,progress,summary:{...summary}}),{deferMatching:true});
      const row=result?.summary||{},skipped=Boolean(row.already_processed||String(row.status).toLowerCase()==='already_processed');
      if(skipped)summary.skipped++;else summary.processed++;
      summary.added+=Number(row.added||0);summary.updated+=Number(row.updated||0);summary.duplicates+=Number(row.duplicates_detected??row.updated??0);
      results.push({file:file.name,status:skipped?'skipped':'completed',summary:row});
    }catch(error){summary.failed++;failures.push({file:file.name,error:error?.message||String(error)});results.push({file:file.name,status:'failed',error:error?.message||String(error)});}
    finally{summary.pending=selected.length-position;onProgress({stage:'file_done',file,index:position,total:selected.length,summary:{...summary}});}
  }
  onProgress({stage:'complete',index:selected.length,total:selected.length,summary:{...summary},failures});
  return {summary,results,failures};
}
