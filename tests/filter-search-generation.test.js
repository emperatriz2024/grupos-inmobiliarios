import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
test('botón ejecuta una búsqueda; segunda invalida primera y solo publica la última',async()=>{
 const pending=[],nodes=new Map();let renders=0;
 const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'recent',textContent:'',setAttribute(){},removeAttribute(){}});return nodes.get(id);};
 const ctx=vm.createContext({$,getFilters:()=>({}),renderResults:()=>renders++,rememberSearchPosition(){},searchPropertiesChunked:(rows,f,mode,options)=>new Promise(resolve=>pending.push({resolve,options}))});
 vm.runInContext('let allProperties=[],currentResults=[],visibleCount=30;',ctx);
 vm.runInContext(app.slice(app.indexOf('let searchGeneration=0;'),app.indexOf('function renderResults()')),ctx);
 vm.runInContext("$('#searchBtn').onclick=()=>runSearch()",ctx);
 const first=$('#searchBtn').onclick();assert.equal(pending.length,1);assert.equal($('#searchBtn').textContent,'Buscando…');
 const second=$('#searchBtn').onclick();assert.equal(pending.length,2);assert.equal(pending[0].options.cancelled(),true);
 pending[1].resolve([{id:'new'}]);await second;pending[0].resolve([{id:'old'}]);await first;
 assert.equal(renders,1);assert.equal(vm.runInContext('currentResults[0].id',ctx),'new');assert.equal($('#searchBtn').textContent,'Buscar propiedades');
});
