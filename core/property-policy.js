const ACCIDENTAL=/^(?:apartamento|casa|inmueble|propiedad|revestido|pecto\s+a\s+los\s+servicios|servicios|informacion|descripcion)$/i;

export function cleanPropertyName(value=''){
  const name=String(value||'').replace(/[\r\n]+/g,' ').replace(/^[\s*•:;,.-]+|[\s*•:;,.-]+$/g,'').replace(/\s+/g,' ').trim();
  if(name.length<3||name.length>80||ACCIDENTAL.test(name))return null;
  return name;
}

export function propertyDisplayName(property={}){
  const residence=cleanPropertyName(property.residence||property.complex_detected);
  if(residence)return residence;
  const explicit=cleanPropertyName(property.explicit_name||property.external_title);
  if(explicit)return explicit;
  const type=String(property.property_type||'').replace(/[\r\n]+/g,' ').trim()||'Propiedad';
  const zone=cleanPropertyName(property.zone||property.zone_detected);
  return zone?`${type} · ${zone}`:type;
}

export function evidenceRecord({field,value,evidence=null,confidence='missing',method='unknown',sourceId=null}={}){
  return {field,value:value??null,evidence:evidence||null,confidence,method,sourceId:sourceId||null,verified:confidence==='high'&&!!evidence};
}
