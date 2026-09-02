export const IDENTITY_MODEL_VERSION='identity-v1';
export const IDENTITY_BANDS=Object.freeze({AUTO_LINK:0.78,REVIEW:0.42,PRICE_COMPATIBLE_PCT:8,PRICE_MODERATE_PCT:20,PRICE_IMPORTANT_PCT:40,PRICE_STRONG_PCT:60,PHASH_SIMILAR_DISTANCE:10});
const norm=v=>String(v??'').trim().toLowerCase();
const close=(a,b,tolerance)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<=tolerance;
export function priceConflict(a,b){if(!Number.isFinite(Number(a))||!Number.isFinite(Number(b))||Number(a)<=0||Number(b)<=0)return null;const pct=Math.abs(Number(a)-Number(b))/Math.min(Number(a),Number(b))*100;return {pct,band:pct<=8?'COMPATIBLE':pct<=20?'MODERATE':pct<=40?'IMPORTANT':pct<=60?'STRONG':'EXTREME'};}
export function identityBlockKeys(p={}){const keys=[];if(p.external_listing_id)keys.push(`listing:${norm(p.source_type)}:${norm(p.external_listing_id)}`);if(p.external_property_code)keys.push(`code:${norm(p.external_property_code)}`);if(p.source_url)keys.push(`url:${norm(p.source_url)}`);if(p.image_sha256)keys.push(`sha:${p.image_sha256}`);if(p.territory_id&&p.property_type)keys.push(`territory-type:${p.territory_id}:${norm(p.property_type)}`);if(p.residence_name)keys.push(`residence:${norm(p.residence_name)}`);return [...new Set(keys)];}
export class CandidateIndex{
  constructor(){this.blocks=new Map();this.records=new Map();}
  add(property){this.records.set(property.id,property);for(const key of identityBlockKeys(property)){if(!this.blocks.has(key))this.blocks.set(key,new Set());this.blocks.get(key).add(property.id);}return property;}
  candidates(source){const ids=new Set();for(const key of identityBlockKeys(source))for(const id of this.blocks.get(key)||[])ids.add(id);return [...ids].map(id=>this.records.get(id));}
}
export class PropertyIdentityEngine{
  constructor({modelVersion=IDENTITY_MODEL_VERSION}={}){this.modelVersion=modelVersion;}
  evaluate(source,candidate){
    const strong=[],compatible=[],conflicts=[];let score=0,unequivocal=false;
    if(source.external_listing_id&&candidate.external_listing_id&&norm(source.source_type)===norm(candidate.source_type)&&norm(source.external_listing_id)===norm(candidate.external_listing_id)){strong.push('same_trusted_external_listing_id');score+=0.8;unequivocal=true;}
    if(source.external_property_code&&candidate.external_property_code&&norm(source.external_property_code)===norm(candidate.external_property_code)){strong.push('same_specific_external_property_code');score+=0.65;}
    if(source.source_url&&candidate.source_url&&norm(source.source_url)===norm(candidate.source_url)){strong.push('same_source_url');score+=0.5;}
    if(source.image_sha256&&candidate.image_sha256&&source.image_sha256===candidate.image_sha256){strong.push('same_image_sha256');score+=0.55;}
    if(source.phash_distance!=null&&source.phash_distance<=IDENTITY_BANDS.PHASH_SIMILAR_DISTANCE){compatible.push('perceptually_similar_image');score+=0.12;}
    if(Number(source.similar_image_count)>=2&&source.phash_distance!=null&&source.phash_distance<=IDENTITY_BANDS.PHASH_SIMILAR_DISTANCE){strong.push('multiple_perceptually_similar_images');score+=0.4;}
    for(const [field,weight] of [['territory_id',0.12],['property_type',0.1],['residence_name',0.14],['bedrooms',0.06],['bathrooms',0.05],['parking',0.04]])if(source[field]!=null&&candidate[field]!=null&&norm(source[field])===norm(candidate[field])){compatible.push(`same_${field}`);score+=weight;}
    if(close(source.area_m2,candidate.area_m2,Math.max(4,Number(candidate.area_m2||0)*0.05))){compatible.push('compatible_area');score+=0.1;}
    if(source.operation&&candidate.operation&&norm(source.operation)!==norm(candidate.operation))conflicts.push('incompatible_operation');
    if(source.property_type&&candidate.property_type&&norm(source.property_type)!==norm(candidate.property_type))conflicts.push('incompatible_property_type');
    if(source.territory_id&&candidate.territory_id&&source.territory_id!==candidate.territory_id)conflicts.push('incompatible_territory');
    if(Number(source.area_m2)>0&&Number(candidate.area_m2)>0&&Math.abs(Number(source.area_m2)-Number(candidate.area_m2))/Math.max(Number(source.area_m2),Number(candidate.area_m2))>0.35)conflicts.push('radically_incompatible_area');
    if(source.image_conflict===true)conflicts.push('clearly_different_images');
    const price=priceConflict(source.price_usd,candidate.price_usd);if(price&&price.band!=='COMPATIBLE')conflicts.push(`price_${price.band.toLowerCase()}`);
    score=Math.max(0,Math.min(1,score-conflicts.filter(x=>!x.startsWith('price_')).length*0.35));
    const hard=conflicts.some(x=>['incompatible_operation','incompatible_property_type','incompatible_territory','radically_incompatible_area'].includes(x));let band;
    if((price?.pct||0)>60&&!unequivocal&&strong.length===0)band='KEEP_SEPARATE';
    else if(unequivocal&&price&&price.pct>20)band='REVIEW';
    else if(score>=IDENTITY_BANDS.AUTO_LINK&&!hard&&!(price&&price.pct>40))band='AUTO_LINK';
    else if(score>=IDENTITY_BANDS.REVIEW||strong.length||hard)band='REVIEW';
    else band='NEW_PROPERTY';
    return {candidate_id:candidate.id,score,band,strong,compatible,conflicts,price_conflict:price,identity_model_version:this.modelVersion,recommended_decision:band};
  }
  resolve(source,index){const evaluations=index.candidates(source).map(candidate=>this.evaluate(source,candidate)).sort((a,b)=>b.score-a.score);return {candidates:evaluations,best:evaluations[0]||null,decision:evaluations[0]?.band||'NEW_PROPERTY',identity_model_version:this.modelVersion};}
}
