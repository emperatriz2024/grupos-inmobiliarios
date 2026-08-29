import test from 'node:test';
import assert from 'node:assert/strict';
import {runOperationalZipBatch,ZIP_BATCH_PHASES} from '../core/operational-zip-batch.js';

const entries=count=>Array.from({length:count},(_,index)=>({name:`chat-${index+1}.zip`,path:`/pending/chat-${index+1}.zip`}));

test('lote operativo de 18 ZIP avanza 1/18 a 18/18 y finaliza una sola vez',async()=>{
  const files=entries(18),checkpoints=new Set(),moves=[],phases=[],saveProgress=[],finalizations=[];
  const outcome=await runOperationalZipBatch({
    entries:files,
    download:async entry=>({entry}),
    processFile:async(entry,_blob,notify)=>{
      const total=entry===files[0]?1137:12;
      for(let done=Math.min(250,total);done<=total;done=Math.min(done+250,total)){
        notify({phase:'save',done,total});saveProgress.push([entry.name,done,total]);
        if(done===total)break;
      }
      checkpoints.add(entry.name);
      notify({phase:'finalize',done:total,total});
      return {summary:{status:'completed'},demandIds:[],propertyIds:[]};
    },
    move:async entry=>{assert.equal(checkpoints.has(entry.name),true);moves.push(entry.name);},
    finalize:async result=>finalizations.push(result),
    onProgress:event=>phases.push(event),
    yieldControl:async()=>{}
  });
  assert.deepEqual(outcome,{results:outcome.results,failures:[],completed:18,failed:0,total:18});
  assert.equal(moves.length,18);assert.equal(new Set(moves).size,18);assert.equal(finalizations.length,1);
  assert.deepEqual(phases.filter(x=>x.phase===ZIP_BATCH_PHASES.COMPLETED).map(x=>`${x.completed}/${x.total}`),Array.from({length:18},(_,i)=>`${i+1}/18`));
  assert.deepEqual(saveProgress.filter(x=>x[0]==='chat-1.zip').at(-1),['chat-1.zip',1137,1137]);
});

test('checkpoint permite reanudar tras fallo al mover sin reprocesar ni duplicar',async()=>{
  const files=entries(1),checkpoints=new Set();let saves=0,moves=0;
  const run=failMove=>runOperationalZipBatch({
    entries:files,download:async()=>({}),
    processFile:async entry=>{if(checkpoints.has(entry.name))return {summary:{status:'already_processed',already_processed:true},demandIds:[],propertyIds:[]};saves++;checkpoints.add(entry.name);return {summary:{status:'completed'},demandIds:[],propertyIds:[]};},
    move:async()=>{moves++;if(failMove)throw new Error('dropbox_temporal');},yieldControl:async()=>{}
  });
  const first=await run(true);assert.equal(first.failed,1);assert.equal(saves,1);
  const resumed=await run(false);assert.equal(resumed.completed,1);assert.equal(saves,1);assert.equal(moves,2);
});

test('un ZIP con error no detiene los archivos siguientes',async()=>{
  const files=entries(18),moved=[];
  const outcome=await runOperationalZipBatch({entries:files,download:async()=>({}),processFile:async entry=>{if(entry===files[4])throw new Error('zip_corrupto');return {summary:{status:'completed'}};},move:async entry=>moved.push(entry.name),yieldControl:async()=>{}});
  assert.equal(outcome.completed,17);assert.equal(outcome.failed,1);assert.equal(moved.length,17);assert.equal(moved.includes(files[5].name),true);
});

test('fallo del recálculo final no revierte checkpoints ni movimientos',async()=>{
  const files=entries(2),moved=[];
  const outcome=await runOperationalZipBatch({entries:files,download:async()=>({}),processFile:async()=>({summary:{status:'completed'}}),move:async entry=>moved.push(entry.name),finalize:async()=>{throw new Error('matching_temporal');},yieldControl:async()=>{}});
  assert.equal(outcome.completed,2);assert.equal(outcome.failed,0);assert.match(outcome.finalizationError.message,/matching_temporal/);assert.deepEqual(moved,files.map(x=>x.name));
});
