import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION,APP_LABEL,RADAR_DEMAND_ENGINE_DEFAULT} from '../version.js';
import {radarDemandEngineEnabled} from '../core/radar/config.js';

test('operational beta identity and demand engine are branch-local',()=>{
  assert.equal(APP_VERSION,'0.7.2-operativo');assert.equal(APP_LABEL,'RADAR OPERATIVO BETA');assert.equal(RADAR_DEMAND_ENGINE_DEFAULT,true);assert.equal(radarDemandEngineEnabled({RADAR_DEMAND_ENGINE_ENABLED:String(RADAR_DEMAND_ENGINE_DEFAULT)}),true);
  const db=fs.readFileSync(new URL('../db.js',import.meta.url),'utf8'),app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');assert.match(db,/const DB_NAME = 'grupos-inmobiliarios'/);assert.match(app,/RADAR_DEMAND_ENGINE_DEFAULT\?'true':'/);
});
