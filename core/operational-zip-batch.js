const defaultYield=()=>new Promise(resolve=>setTimeout(resolve,0));

export const ZIP_BATCH_PHASES=Object.freeze({
  DOWNLOADING:'DESCARGANDO',
  ANALYZING:'ANALIZANDO',
  SAVING:'GUARDANDO',
  FINALIZING:'FINALIZANDO',
  MOVING:'MOVIENDO',
  COMPLETED:'COMPLETADO',
  ERROR:'ERROR'
});

export async function runOperationalZipBatch({entries=[],download,processFile,move,finalize,onProgress,yieldControl=defaultYield}){
  const results=[],failures=[];
  const emit=(phase,index,entry,extra={})=>onProgress?.({phase,index,total:entries.length,entry,...extra});
  for(let index=0;index<entries.length;index++){
    const entry=entries[index];
    try{
      emit(ZIP_BATCH_PHASES.DOWNLOADING,index,entry);
      const blob=await download(entry);
      emit(ZIP_BATCH_PHASES.ANALYZING,index,entry);
      const result=await processFile(entry,blob,progress=>{
        const phase=progress.phase==='save'?ZIP_BATCH_PHASES.SAVING:progress.phase==='finalize'?ZIP_BATCH_PHASES.FINALIZING:ZIP_BATCH_PHASES.ANALYZING;
        emit(phase,index,entry,{progress});
      });
      emit(ZIP_BATCH_PHASES.FINALIZING,index,entry,{result});
      emit(ZIP_BATCH_PHASES.MOVING,index,entry,{result});
      await move(entry,result);
      results.push({entry,result});
      emit(ZIP_BATCH_PHASES.COMPLETED,index,entry,{result,completed:index+1});
    }catch(error){
      failures.push({entry,error});
      emit(ZIP_BATCH_PHASES.ERROR,index,entry,{error});
    }
    await yieldControl();
  }
  let finalizationError=null;
  try{await finalize?.({results,failures});}
  catch(error){finalizationError=error;onProgress?.({phase:ZIP_BATCH_PHASES.ERROR,index:entries.length,total:entries.length,entry:null,error,finalization:true});}
  return {results,failures,completed:results.length,failed:failures.length,total:entries.length,...(finalizationError?{finalizationError}:{})};
}
