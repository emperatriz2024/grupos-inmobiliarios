const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const median=values=>{const rows=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!rows.length)return null;const mid=Math.floor(rows.length/2);return rows.length%2?rows[mid]:(rows[mid-1]+rows[mid])/2;};

export function temporalFingerprint(event={},windowMinutes=10){
  const bucket=Math.floor(Date.parse(event.timestamp||event.receivedAt||0)/(windowMinutes*60_000));
  const body=norm([event.text,event.caption].filter(Boolean).join(' ')).replace(/\s+/g,' ').slice(0,1200);
  return `${norm(event.groupId)}|${norm(event.authorIdentifier||event.authorId)}|${bucket}|${body}`;
}

export function deduplicateTemporal(events=[],windowMinutes=10){
  const seen=new Set(),unique=[],duplicates=[];
  for(const event of [...events].sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp))){const key=temporalFingerprint(event,windowMinutes);(seen.has(key)?duplicates:unique).push(event);seen.add(key);}
  return {unique,duplicates};
}

export function buildMarketIndex(properties=[]){
  const groups=new Map();
  for(const property of properties){const zone=property.zone||property.zona||'Sin zona',type=property.property_type||property.type||property.tipo||'Sin tipo',key=`${norm(zone)}|${norm(type)}`,price=Number(property.price_usd??property.price),area=Number(property.area_m2??property.area),row=groups.get(key)||{zone,type,count:0,prices:[],areas:[],pricesM2:[]};row.count++;if(Number.isFinite(price)&&price>0)row.prices.push(price);if(Number.isFinite(area)&&area>0)row.areas.push(area);if(price>0&&area>0)row.pricesM2.push(price/area);groups.set(key,row);}
  return [...groups.values()].map(row=>({zone:row.zone,type:row.type,count:row.count,median_price_usd:median(row.prices),median_area_m2:median(row.areas),median_price_m2_usd:median(row.pricesM2)})).sort((a,b)=>b.count-a.count||a.zone.localeCompare(b.zone));
}

export function naturalMarketQuery(query='',properties=[]){
  const q=norm(query),priceMatch=q.match(/(?:hasta|maximo|max)\s*\$?\s*([\d.,]+)/),roomsMatch=q.match(/(\d+)\s*(?:hab|habitaciones?)/),maxPrice=priceMatch?Number(priceMatch[1].replace(/\./g,'').replace(',','.')):null,rooms=roomsMatch?Number(roomsMatch[1]):null;
  const typeWords=['apartamento','casa','townhouse','penthouse','terreno','local','oficina','galpon'],type=typeWords.find(word=>q.includes(word));
  return properties.filter(property=>{const haystack=norm([property.zone,property.zona,property.municipality,property.municipio,property.residence,property.conjunto].join(' ')),propertyType=norm(property.property_type||property.tipo),price=Number(property.price_usd??property.price),bedrooms=Number(property.bedrooms??property.habitaciones);return (!type||propertyType.includes(type))&&(!maxPrice||price<=maxPrice)&&(!rooms||bedrooms>=rooms)&&q.split(/\s+/).filter(word=>word.length>3&&!typeWords.includes(word)&&!['hasta','maximo','habitaciones'].includes(word)&&!/^\d/.test(word)).every(word=>haystack.includes(word)||propertyType.includes(word));});
}
