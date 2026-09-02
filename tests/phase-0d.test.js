import test from 'node:test';
import assert from 'node:assert/strict';
import {assessOpportunity,buildClientPackage,reconcileReadiness,READINESS_STATUSES} from '../core/radar/readiness-engine.js';

const NOW=Date.parse('2026-08-28T12:00:00Z');
const opportunity=(id,property_id)=>({id,property_id,workspace_id:'ws',status:'ACTIVE'});
const property=(id,extra={})=>({id,territory_id:'san-diego',operation:'SALE',property_type:'HOUSE',price_usd:55000,area_m2:120,bedrooms:3,bathrooms:2,status:'active',availability_status:'verified',last_verified_at:'2026-08-27T12:00:00Z',last_seen_at:'2026-08-27T12:00:00Z',...extra});
const media=(property_id,rights_status='AUTHORIZED')=>({mediaAssets:[{id:`m_${property_id}`,rights_status,storage_key:`media/${property_id}.jpg`,mime_type:'image/jpeg'}],propertyMedia:[{id:`pm_${property_id}`,property_id,media_asset_id:`m_${property_id}`,client_allowed:true,is_primary:true}]});

test('P1 exact + current facts + AUTHORIZED media is READY',()=>{
  const p=property('p1'),m=media('p1');const out=assessOpportunity({opportunity:opportunity('o1','p1'),property:p,...m,now:NOW});
  assert.equal(out.assessment.status,'READY');assert.equal(out.assessment.readiness_score,100);assert.equal(out.tasks.length,0);
});

test('P2 missing media creates FIND_MEDIA and authorized media reevaluates READY',()=>{
  const p=property('p2'),o=opportunity('o2','p2');const missing=assessOpportunity({opportunity:o,property:p,now:NOW});
  assert.equal(missing.assessment.status,'NEEDS_MEDIA');assert.equal(missing.tasks[0].task_type,'FIND_MEDIA');
  assert.equal(assessOpportunity({opportunity:o,property:p,...media('p2'),now:NOW}).assessment.status,'READY');
});

test('P3 active price conflict never resolves silently',()=>{
  const out=assessOpportunity({opportunity:opportunity('o3','p3'),property:property('p3'),evidence:[{field_name:'price_usd',value:55000,active:true},{field_name:'price_usd',value:60000,active:true}],...media('p3'),now:NOW});
  assert.equal(out.assessment.status,'PRICE_CONFLICT');assert.equal(out.tasks[0].task_type,'VERIFY_PRICE');
});

test('P4 insufficient freshness requires availability verification',()=>{
  const out=assessOpportunity({opportunity:opportunity('o4','p4'),property:property('p4',{source_types:['external_web'],availability_status:'unverified',last_verified_at:null,last_seen_at:'2026-08-01T00:00:00Z'}),...media('p4'),now:NOW});
  assert.equal(out.assessment.status,'VERIFY_AVAILABILITY');assert.equal(out.tasks[0].task_type,'VERIFY_AVAILABILITY');
});

test('missing facts remain missing and closed property is blocked',()=>{
  const missing=assessOpportunity({opportunity:opportunity('o5','p5'),property:property('p5',{price_usd:null}),...media('p5'),now:NOW});
  assert.equal(missing.assessment.status,'NEEDS_FACTS');assert.deepEqual(missing.assessment.gaps,['price_usd']);
  assert.equal(assessOpportunity({opportunity:opportunity('o6','p6'),property:property('p6',{status:'ARCHIVED'}),now:NOW}).assessment.status,'BLOCKED');
});

test('UNKNOWN/SOURCE_LINK_ONLY media is never client-ready',()=>{
  for(const rights of ['UNKNOWN','SOURCE_LINK_ONLY'])assert.equal(assessOpportunity({opportunity:opportunity(`o_${rights}`,'p'),property:property('p'),...media('p',rights),now:NOW}).assessment.status,'RIGHTS_REVIEW');
});

test('client package uses allowlist and leaks no private or internal scores',()=>{
  const p=property('safe',{commission_pct:5,own_listing_details:{internal_notes:'secret'},owner_phone:'0412',groups:['private'],messages:['wa'],captor:'agent',fit_score:99,zone:'San Diego'}),o=opportunity('safe_op','safe'),m=media('safe');
  const assessment=assessOpportunity({opportunity:o,property:p,...m,now:NOW}).assessment,built=buildClientPackage({opportunity:o,property:p,assessment,...m,now:NOW});
  const raw=JSON.stringify(built);for(const secret of ['commission','own_listing','owner_phone','groups','messages','captor','fit_score','secret','0412'])assert.equal(raw.includes(secret),false);
  assert.equal(built.package.payload_json.property.zone,'San Diego');assert.equal(built.media.length,1);
});

test('targeted reevaluation touches only requested opportunity and remains idempotent',()=>{
  const opportunities=[opportunity('oa','pa'),opportunity('ob','pb')],properties=[property('pa'),property('pb')],m={mediaAssets:[...media('pa').mediaAssets,...media('pb').mediaAssets],propertyMedia:[...media('pa').propertyMedia,...media('pb').propertyMedia]};
  const one=reconcileReadiness({opportunities,properties,...m,scope:{opportunityIds:['oa']},now:NOW}),again=reconcileReadiness({opportunities,properties,...m,scope:{opportunityIds:['oa']},now:NOW});
  assert.equal(one.evaluated,1);assert.deepEqual(one,again);assert.deepEqual(one.assessments.map(x=>x.opportunity_id),['oa']);assert.equal(new Set(one.packages.map(x=>x.id)).size,one.packages.length);
});

test('readiness and match scores are distinct contracts',()=>{
  assert.deepEqual(READINESS_STATUSES,['READY','VERIFY_AVAILABILITY','NEEDS_FACTS','NEEDS_MEDIA','PRICE_CONFLICT','IDENTITY_REVIEW','RIGHTS_REVIEW','BLOCKED']);
  const assessment=assessOpportunity({opportunity:{...opportunity('score','scorep'),fit_score:12},property:property('scorep'),...media('scorep'),now:NOW}).assessment;
  assert.equal(assessment.readiness_score,100);assert.equal('fit_score' in assessment,false);
});
