import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateDemandProperty,legacyBuyerToClientDemand} from '../core/radar/demand-engine.js';
import {inferReliablePropertyType} from '../db.js';
import {scoreBuyerMaster} from '../buyer-utils.js';

const linda={id:'demand-client-linda',origin:'CLIENT',status:'ACTIVE',property_types:['Townhouse']};
const property=property_type=>({id:'mp-test',status:'ACTIVE',ownership_scope:'MARKET',property_type,last_seen_at:new Date().toISOString()});

test('Linda Townhouse + Apartamento confirmado es REJECTED',()=>{assert.equal(evaluateDemandProperty(linda,property('Apartamento')).classification,'REJECTED');});
test('buyer.property_type singular conserva el hard gate legacy',()=>{const demand=legacyBuyerToClientDemand({id:'linda',property_type:'Townhouse'}).demand;assert.deepEqual(demand.property_types,['Townhouse']);assert.equal(evaluateDemandProperty(demand,property('Apartamento')).classification,'REJECTED');});
test('Linda Townhouse + tipo desconocido es VERIFY y explica el faltante',()=>{const result=evaluateDemandProperty(linda,property(null));assert.equal(result.classification,'VERIFY');assert.ok(result.gaps.some(gap=>/Tipo de inmueble no detectado/.test(gap)));});
test('matcher legacy también separa tipo desconocido de incompatible',()=>{assert.equal(scoreBuyerMaster({property_type:'Townhouse'},property('Apartamento')),null);const unknown=scoreBuyerMaster({property_type:'Townhouse'},property(null));assert.equal(unknown.match_kind,'por_verificar');assert.ok(unknown.gaps.includes('Tipo de inmueble no detectado'));});
test('master recupera tipo fiable de sources y no inventa ante conflicto',()=>{assert.equal(inferReliablePropertyType(null,[{property_type:'Apartamento'},{observed_property_type:'Apartamento'}]),'Apartamento');assert.equal(inferReliablePropertyType(null,[{property_type:'Apartamento'},{property_type:'Casa'}]),null);});
test('UI separa categorías, restaura contexto y no imprime IDs internos',async()=>{const [app,html]=await Promise.all([readFile(new URL('../app.js',import.meta.url),'utf8'),readFile(new URL('../index.html',import.meta.url),'utf8')]);assert.match(html,/data-kind="exact"[^>]*>Compatibles/);assert.match(html,/data-kind="verify"[^>]*>Por verificar/);assert.match(app,/POR VERIFICAR/);assert.match(app,/scrollTop:list\.scrollTop/);assert.match(app,/buyerMatchFilter=context\.filter/);assert.doesNotMatch(app,/buyerEsc\(row\.demand_id\)\s*} → \$\{buyerEsc\(row\.property_id\)/);assert.match(app,/buyer\?\.name/);});
