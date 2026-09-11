import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const read=file=>fs.readFileSync(file,'utf8');
test('0786 runtime assets never mix old versions; worker imports resolve',()=>{
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name.startsWith('.')||['node_modules','tests','docs'].includes(e.name))continue;const file=path.join(dir,e.name);if(e.isDirectory())walk(file);else if(/\.(js|html|css)$/.test(file))assert.doesNotMatch(read(file),/\?v=078[345]/,file);}};walk('.');
 assert.match(read('version.js'),/ASSET_VERSION='0786'/);assert.match(read('sw.js'),/v0786-production/);assert.match(read('sw.js'),/const V='\?v=0786'/);assert.match(read('app.js'),/register\('\.\/sw.js\?v=0786'\)/);
 for(const file of ['search-worker.js','search-index.js','search-worker-controller.js','search-worker-classic.js']){assert.ok(read('sw.js').includes(file));for(const m of read(file).matchAll(/from\s+['"](\.[^'"]+)['"]/g))assert.ok(fs.existsSync(path.resolve(path.dirname(file),m[1].split('?')[0])),m[1]);}
});
test('operational startup excludes intelligence and preserves existing DB identity',()=>{
 const app=read('app.js'),load=app.slice(app.indexOf('async function loadData('),app.indexOf("$('#resetBtn').onclick"));
 for(const call of ['patchPropertyPriceAudits','syncRadarCore','runDemandOpportunityMatching','recalculateAllBuyerMatches','rematchAllPropertyLocations','refreshBuyersData','refreshExternalSourcesUI','initDropbox'])assert.ok(!load.includes(call),call);
 assert.ok(load.indexOf("startupPhase('RADAR_READY')")<load.indexOf('scheduleIntelligence()'));
 assert.match(read('db.js'),/DB_NAME = 'grupos-inmobiliarios'/);assert.match(read('db.js'),/DB_VERSION = 15/);
 assert.doesNotMatch(load,/deleteDatabase|\.clear\(/);
});
