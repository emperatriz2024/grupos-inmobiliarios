import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','node_modules'].includes(entry.name))continue;const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(entry.name.endsWith('.js'))files.push(full);}}
walk(root);

const graph=new Map(),errors=[];
for(const file of files){
  const text=fs.readFileSync(file,'utf8'),deps=[];
  for(const match of text.matchAll(/(?:from\s+|import\s*\()['"](\.\.?\/[^'"?]+)(?:\?[^'"]*)?['"]/g)){
    const resolved=path.resolve(path.dirname(file),match[1]);deps.push(resolved);
    if(!fs.existsSync(resolved))errors.push(`Import inexistente: ${path.relative(root,file)} -> ${match[1]}`);
  }
  graph.set(file,deps.filter(x=>files.includes(x)));
}

const cycles=[],visiting=new Set(),visited=new Set();
function visit(file,stack=[]){if(visiting.has(file)){cycles.push([...stack.slice(stack.indexOf(file)),file]);return;}if(visited.has(file))return;visiting.add(file);for(const dep of graph.get(file)||[])visit(dep,[...stack,file]);visiting.delete(file);visited.add(file);}
for(const file of files)visit(file);
for(const cycle of cycles)errors.push(`Dependencia circular: ${cycle.map(x=>path.relative(root,x)).join(' -> ')}`);

const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const id of ['searchBtn','newBuyerBtn','zipInput','importBtn','clearExternalSource','analyzeExternalUrl','backupFileInput','analyzeRequestText','runRequest','createSelection','selectionAdminToken']){
  const count=(index.match(new RegExp(`id=["']${id}["']`,'g'))||[]).length;
  if(count!==1)errors.push(`ID crítico ${id}: esperado 1, encontrado ${count}`);
}

const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
for(const match of sw.matchAll(/'\.\/([^'?]+)(?:\?[^']*)?'/g)){
  const asset=path.join(root,match[1]);if(!fs.existsSync(asset))errors.push(`Asset SW inexistente: ${match[1]}`);
}

const allText=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
for(const [name,rx] of [['indexedDB.deleteDatabase',/indexedDB\.deleteDatabase\s*\(/],['localStorage.clear',/localStorage\.clear\s*\(/]])if(rx.test(allText))errors.push(`Operación prohibida: ${name}`);

if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`ARCHITECTURE_OK files=${files.length} cycles=0 critical_ids=11 sw_assets=ok`);
