const A={á:'a',é:'e',í:'i',ó:'o',ú:'u',ü:'u',ñ:'n'};
export function normLocation(s=''){
  return String(s).toLowerCase().replace(/[áéíóúüñ]/g,c=>A[c]||c)
    .replace(/[^\p{L}\p{N}\s\-]/gu,' ').replace(/\s+/g,' ').trim();
}
export function slugLocation(s=''){
  return normLocation(s).replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
}

export const SEED_MUNICIPALITIES=[
  {id:"mun_valencia",nombre:"Valencia",aliases:["Valencia", "Municipio Valencia", "Valencia Norte"],activo:true},
  {id:"mun_san-diego",nombre:"San Diego",aliases:["San Diego", "Municipio San Diego"],activo:true},
  {id:"mun_naguanagua",nombre:"Naguanagua",aliases:["Naguanagua", "Municipio Naguanagua"],activo:true},
  {id:"mun_los-guayos",nombre:"Los Guayos",aliases:["Los Guayos", "Municipio Los Guayos"],activo:true},
  {id:"mun_guacara",nombre:"Guacara",aliases:["Guacara", "Municipio Guacara"],activo:true}
];

const Z=(municipio_id,nombre,aliases=[])=>({id:`zone_${slugLocation(nombre)}_${municipio_id.replace(/^mun_/,'')}`,nombre,municipio_id,aliases:[nombre,...aliases],fuente:'catalogo_territorial_0412',activo:true});
export const SEED_ZONES=[
  Z("mun_valencia","Agua Blanca",["Aqua Blanca"]),
  Z("mun_valencia","Altos de Guataparo",["Alto de Guataparo"]),
  Z("mun_valencia","Camoruco",["Camoruco Viejo"]),
  Z("mun_valencia","Campo Alegre",[]),
  Z("mun_valencia","Colinas de Guataparo",[]),
  Z("mun_valencia","Country Club",["Guataparo Country Club"]),
  Z("mun_valencia","El Bosque",[]),
  Z("mun_valencia","El Parral",[]),
  Z("mun_valencia","El Recreo",[]),
  Z("mun_valencia","El Trigal",["Trigal"]),
  Z("mun_valencia","Guaparo",["Guaparo Norte"]),
  Z("mun_valencia","Guataparo",[]),
  Z("mun_valencia","La Alegría",["La Alegria"]),
  Z("mun_valencia","La Arboleda",[]),
  Z("mun_valencia","La Trigaleña",["Trigaleña", "La Trigalena", "La Trigaleña Alta", "La Trigaleña Baja"]),
  Z("mun_valencia","La Viña",["La Vina"]),
  Z("mun_valencia","Las Acacias",["La Acacia", "Acacias"]),
  Z("mun_valencia","Las Chimeneas",["La Chimenea", "Chimeneas"]),
  Z("mun_valencia","Lomas del Este",["Loma del Este", "Lomas de Este", "Loma Este"]),
  Z("mun_valencia","Los Colorados",[]),
  Z("mun_valencia","Los Mangos",[]),
  Z("mun_valencia","Los Nísperos",["Los Nisperos"]),
  Z("mun_valencia","Los Sauces",[]),
  Z("mun_valencia","Piedras Pintadas",["Piedra Pintada"]),
  Z("mun_valencia","Portachuelo",[]),
  Z("mun_valencia","Prebo",["Callejón Prebo", "Callejon Prebo"]),
  Z("mun_valencia","Prebo I",["Prebo 1"]),
  Z("mun_valencia","Prebo II",["Prebo 2"]),
  Z("mun_valencia","Prebo III",["Prebo 3"]),
  Z("mun_valencia","Sabana Larga",[]),
  Z("mun_valencia","San José de Tarbes",["San Jose de Tarbes"]),
  Z("mun_valencia","Santa Cecilia",[]),
  Z("mun_valencia","Trigal Centro",["El Trigal Centro"]),
  Z("mun_valencia","Trigal Norte",["El Trigal Norte"]),
  Z("mun_valencia","Trigal Sur",["El Trigal Sur"]),
  Z("mun_valencia","Valles de Camoruco",["Valle de Camoruco"]),
  Z("mun_valencia","El Viñedo",["Viñedo", "El Vinedo"]),
  Z("mun_valencia","Michelena",["La Michelena"]),
  Z("mun_valencia","La Isabelica",[]),
  Z("mun_valencia","Los Caobos",[]),
  Z("mun_valencia","Flor Amarillo",[]),
  Z("mun_valencia","La Candelaria",[]),
  Z("mun_valencia","Santa Rosa",[]),
  Z("mun_valencia","San Blas",[]),
  Z("mun_valencia","La Michelena",["Michelena"]),
  Z("mun_san-diego","Pueblo de San Diego",["Poblado de San Diego", "Pueblo San Diego"]),
  Z("mun_san-diego","El Remanso",[]),
  Z("mun_san-diego","La Esmeralda",[]),
  Z("mun_san-diego","Monte Serino",["Monteserino", "MonteSerino"]),
  Z("mun_san-diego","Terrazas de San Diego",[]),
  Z("mun_san-diego","El Morro",["Morro I", "Morro II"]),
  Z("mun_san-diego","La Cumaca",["Parque Residencial La Cumaca"]),
  Z("mun_san-diego","Paso Real",[]),
  Z("mun_san-diego","Tulipán",["Tulipan"]),
  Z("mun_san-diego","Valle de Oro",[]),
  Z("mun_san-diego","Los Jarales",["Los Arales", "Los Árales", "Los Jaureles"]),
  Z("mun_san-diego","Campo Solo",[]),
  Z("mun_san-diego","Mini Granjas San Diego",["Mini Granja San Diego", "Las Minigranjas", "MiniGranjas"]),
  Z("mun_san-diego","Brisas del Valle",[]),
  Z("mun_san-diego","Castillito",["Terrazas de Castillito"]),
  Z("mun_san-diego","La Ciudadela",[]),
  Z("mun_san-diego","La Colonia",[]),
  Z("mun_san-diego","Las Morochas",["Las Morochas I", "Las Morochas II", "Las Morochas III", "Las Morochas IV"]),
  Z("mun_san-diego","Los Frailes",[]),
  Z("mun_san-diego","Los Tamarindos",[]),
  Z("mun_san-diego","Lomas de Esmeralda",[]),
  Z("mun_san-diego","Valle Verde",[]),
  Z("mun_san-diego","Villa de San Diego",["Villas de San Diego"]),
  Z("mun_san-diego","Villa Jardín",["Villa Jardin"]),
  Z("mun_san-diego","Villa Paraíso",["Villa Paraiso", "Villa Paraíso I"]),
  Z("mun_san-diego","Yuma",["Yuma I", "Yuma II", "Yuma 27", "Yuma 28"]),
  Z("mun_san-diego","San Francisco de Cúpira",["San Francisco de Cupira"]),
  Z("mun_san-diego","Santa Marta",[]),
  Z("mun_san-diego","Las Trianas",[]),
  Z("mun_san-diego","El Paraíso",["El Paraiso"]),
  Z("mun_san-diego","El Otro Lado",[]),
  Z("mun_san-diego","Los Andes",[]),
  Z("mun_san-diego","Los Anaucos",[]),
  Z("mun_san-diego","Las Gaviotas",[]),
  Z("mun_san-diego","La Lopera",[]),
  Z("mun_san-diego","Laguna Villa",[]),
  Z("mun_san-diego","Trinitarias",["Las Trinitarias"]),
  Z("mun_san-diego","Valparaíso",["Valparaiso"]),
  Z("mun_san-diego","Monte Mayor",[]),
  Z("mun_naguanagua","Bárbula",["Barbula"]),
  Z("mun_naguanagua","Mañongo",["Manongo", "Ciudad Jardín Mañongo", "Ciudad Jardin Mañongo", "Jardín Mañongo", "Jardin Mañongo", "Sector Mañongo"]),
  Z("mun_naguanagua","Tazajal",[]),
  Z("mun_naguanagua","Manantial",[]),
  Z("mun_naguanagua","El Rincón",["El Rincon"]),
  Z("mun_naguanagua","La Entrada",[]),
  Z("mun_naguanagua","La Granja",[]),
  Z("mun_naguanagua","Las Quintas",["Las Quintas I", "Las Quintas II"]),
  Z("mun_naguanagua","La Campiña",["La Campina"]),
  Z("mun_naguanagua","El Cafetal",[]),
  Z("mun_naguanagua","Palma Real",[]),
  Z("mun_naguanagua","La Florida",[]),
  Z("mun_naguanagua","Guayabal",[]),
  Z("mun_naguanagua","Parque Naguanagua",[]),
  Z("mun_naguanagua","Colinas de Girardot",["Colinas Girardot"]),
  Z("mun_naguanagua","Capremco",["Caprenco"]),
  Z("mun_naguanagua","Carialinda",[]),
  Z("mun_naguanagua","Los Guayabitos",[]),
  Z("mun_naguanagua","Las Mercedes",[]),
  Z("mun_naguanagua","El Naranjal",["Naranjal I", "Naranjal II"]),
  Z("mun_naguanagua","La Palmera",[]),
  Z("mun_naguanagua","Parque Cabriales",[]),
  Z("mun_naguanagua","Santa Ana",[]),
  Z("mun_naguanagua","Terrazas de Paramacay",["Terraza Paramacay"]),
  Z("mun_naguanagua","Valle Alto",[]),
  Z("mun_naguanagua","Terrazas de Naguanagua",[]),
  Z("mun_naguanagua","El Retobo",[]),
  Z("mun_naguanagua","Tarapío",["Tarapio"]),
  Z("mun_naguanagua","Los Candiles",[]),
  Z("mun_naguanagua","Rotafé",["Rotafe", "Rota Fe"]),
  Z("mun_naguanagua","La Begoña",["La Begona"]),
  Z("mun_naguanagua","El Samán",["El Saman"]),
  Z("mun_naguanagua","Mango Parado",[]),
  Z("mun_naguanagua","Mangos Villas",[]),
  Z("mun_naguanagua","Quintas de Naguanagua",[]),
  Z("mun_naguanagua","Quintas del Norte",[]),
  Z("mun_naguanagua","Villa Rincón I",["Villa Rincon I"]),
  Z("mun_naguanagua","Villa Rincón II",["Villa Rincon II"]),
  Z("mun_naguanagua","Villa del Norte",[]),
  Z("mun_los-guayos","Centro Los Guayos",["Los Guayos", "Casco Central Los Guayos"]),
  Z("mun_los-guayos","Paraparal",[]),
  Z("mun_los-guayos","Las Agüitas",["Las Aguitas"]),
  Z("mun_los-guayos","El Roble",[]),
  Z("mun_los-guayos","La Ensenada",[]),
  Z("mun_los-guayos","Las Garcitas",[]),
  Z("mun_los-guayos","Bello Monte I",[]),
  Z("mun_los-guayos","Bello Monte II",[]),
  Z("mun_los-guayos","Bello Monte III",[]),
  Z("mun_los-guayos","Caño Seco",["Cano Seco"]),
  Z("mun_los-guayos","El Barrial",[]),
  Z("mun_los-guayos","El Jabillo",[]),
  Z("mun_los-guayos","Ciudadela Tacarigua",[]),
  Z("mun_los-guayos","Las Vegas",[]),
  Z("mun_los-guayos","Los Cerritos",[]),
  Z("mun_los-guayos","Los Guayos II",[]),
  Z("mun_los-guayos","Los Tuqueques",[]),
  Z("mun_los-guayos","Malabal",[]),
  Z("mun_los-guayos","Maná",["Mana"]),
  Z("mun_los-guayos","María Polanco",["Maria Polanco"]),
  Z("mun_los-guayos","Mira Valle",[]),
  Z("mun_los-guayos","Nomentana",[]),
  Z("mun_los-guayos","Orizabal",[]),
  Z("mun_los-guayos","Paraíso Real",["Paraiso Real"]),
  Z("mun_los-guayos","Piedras Negras",[]),
  Z("mun_los-guayos","Rómulo Betancourt",["Romulo Betancourt"]),
  Z("mun_los-guayos","Rosa Linda",[]),
  Z("mun_los-guayos","Parque Valencia",[]),
  Z("mun_los-guayos","La Quizanda",["Zona Industrial La Quizanda"]),
  Z("mun_guacara","Guacara",["Centro Guacara"]),
  Z("mun_guacara","Yagua",[]),
  Z("mun_guacara","Ciudad Alianza",[]),
  Z("mun_guacara","Villas del Lago",[]),
  Z("mun_guacara","Villa Lago",[]),
  Z("mun_guacara","Valle Verde",[]),
  Z("mun_guacara","Agua Day",[]),
  Z("mun_guacara","Casas Dignas",[]),
  Z("mun_guacara","Ciudad Alianza 1ra Etapa",[]),
  Z("mun_guacara","Ciudad Alianza 2da Etapa",[]),
  Z("mun_guacara","Ciudad Alianza 4ta Etapa",[]),
  Z("mun_guacara","Ciudad Alianza 5ta Etapa",[])
];

const C=(zona_id,nombre,tipo='conjunto_cerrado',aliases=[])=>({id:`complex_${slugLocation(nombre)}_${zona_id.replace(/^zone_/,'')}`,nombre,zona_id,tipo,aliases:[nombre,...aliases],fuente:'catalogo_territorial_0412',activo:true});
export const SEED_COMPLEXES=[
  C("zone_el-rincon_naguanagua","Doral Country","conjunto_cerrado",["Residencias Doral Country", "Res. Doral Country"]),
  C("zone_manongo_naguanagua","Terramar","torre",["Torre Terramar", "Residencias Terramar"]),
  C("zone_lomas-del-este_valencia","Lo Más Alto","conjunto_cerrado",["Lo Mas Alto"]),
  C("zone_el-remanso_san-diego","Villa Serino Country Park","conjunto_cerrado",["Villa Serino", "Villaserino", "Country Park Villaserino"]),
  C("zone_pueblo-de-san-diego_san-diego","Villas Corina","conjunto_cerrado",["Villa Corina"]),
  C("zone_la-cumaca_san-diego","Villas de Alcalá","conjunto_cerrado",["Villas de Alcala", "Villa de Alcalá", "Villa de Alcala"]),
  C("zone_la-cumaca_san-diego","Villas de San Diego Country Club","urbanizacion_privada",["Villas San Diego Country Club", "San Diego Country Club"])
];
export const SEED_LOCATION_CATALOG={municipalities:SEED_MUNICIPALITIES,zones:SEED_ZONES,complexes:SEED_COMPLEXES};

function uniq(arr=[]){return [...new Set(arr.filter(Boolean))];}
function escRx(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function cleanCandidate(v=''){
  let x=String(v).replace(/[“”"'*•_]/g,' ').replace(/[^\p{L}\p{N}\s.'\-]/gu,' ').replace(/\s+/g,' ').trim();
  x=x.replace(/^[^\p{L}\p{N}]+/u,'').trim();
  x=x.replace(/^(?:residencias?|resd|res|conjunto(?: residencial| cerrado)?|torre|edificio)\s*[:.\-]?\s+/i,'').trim();
  x=x.split(/\s*(?:\||\/\/|;)+\s*/)[0].trim();
  x=x.split(/\s+\.\s+/)[0].trim();
  x=x.replace(/\s*\([^)]*$/,'').trim();
  x=x.split(/\s+(?:en|ubicad[oa]s?|sector|zona|urb(?:anizacion)?|urbanizacion|cerca\s+de|hacia|valencia|carabobo|precio|ref(?:erencia)?|canon|de\s+\d{2,5}\b|consta\b|con\b|cuenta\b|planta\b|pozo\b|tanque\b|vigilancia\b|mantenimiento\b|areas?\s+comunes?\b)/i)[0].trim();
  x=x.replace(/[,:;.\-]+$/,'').trim();
  if(x.length<2||x.length>48||x.split(/\s+/).length>6)return null;
  if(/\$|\b(?:venta|vendo|alquiler|alquilo|apartamento|casa|townhouse|habitaciones?|banos?|precio|mts?|m2)\b/i.test(x))return null;
  return x;
}
const DESC_WORDS=/\b(?:cuenta|exclusiv[oa]|vigilancia|privada|privado|cerrado|pozo|piscina|habitaciones?|banos?|baños?|puestos?|metros?|mts?|m2|data|hermos[oa]s?|optimas?|óptimas?|condiciones?|tranquil[oa]|excelente|ubicacion|ubicación|consta|servicio|garantizado|adultos?|perfil|juridic[oa]|jurídic[oa]|amoblad[oa]|equipad[oa]|comercial|mamposteria|mampostería|piso|nivel|obra\s+blanca|grano|mantenimiento|planta|electrica|eléctrica|areas?|áreas?|comunes?|tanque|subterraneo|subterráneo|sobredimensionado|acabados?|cocina|sala|comedor|estacionamiento|edificio\s+de|casa\s+de|town\s*house|apartamento)\b/i;
function likelyPlace(v='',kind='zone'){
  const x=cleanCandidate(v);if(!x)return null;const n=normLocation(x);
  if(DESC_WORDS.test(x))return null;
  if(/^(?:de|del|un|una|id|l o|con|cuenta|exclusivo|exclusiva|cerrado|privado|privada|piso|nivel|obra|planta|tanque|pozo)\b/i.test(x))return null;
  if(kind==='zone'&&/^(?:torre|edificio|residencias?|res\b|conjunto|villa(?:s)?)\b/i.test(x))return null;
  if(n.split(' ').filter(Boolean).length>5)return null;
  return x;
}
function editDistance(a,b){
  a=normLocation(a);b=normLocation(b);const n=a.length,m=b.length;if(!n)return m;if(!m)return n;
  const prev=Array.from({length:m+1},(_,i)=>i),cur=new Array(m+1);
  for(let i=1;i<=n;i++){cur[0]=i;for(let j=1;j<=m;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));for(let j=0;j<=m;j++)prev[j]=cur[j];}
  return prev[m];
}
function tokenScore(a,b){
  const A=new Set(normLocation(a).split(' ').filter(Boolean)),B=new Set(normLocation(b).split(' ').filter(Boolean));if(!A.size||!B.size)return 0;
  let i=0;for(const x of A)if(B.has(x))i++;return i/(A.size+B.size-i);
}
export function fuzzyScore(a,b){
  const x=normLocation(a),y=normLocation(b);if(!x||!y)return 0;if(x===y)return 1;
  if(x.length>=5&&y.length>=5&&(x.includes(y)||y.includes(x)))return .94;
  const dist=editDistance(x,y);if(dist===1&&Math.max(x.length,y.length)>=6)return .92;
  const lev=1-dist/Math.max(x.length,y.length);return Math.max(0,Math.min(1,lev*.78+tokenScore(x,y)*.22));
}
function catalogOrSeed(catalog){return catalog&&catalog.zones?.length?catalog:SEED_LOCATION_CATALOG;}
function zoneAliases(z){return uniq([z.nombre,...(z.aliases||[])]);}
function complexAliases(c){return uniq([c.nombre,...(c.aliases||[])]);}
function municipalityById(cat,id){return cat.municipalities?.find(x=>x.id===id)||null;}

function explicitZonePhrases(raw){
  const out=[];
  const strong=[
    /\b(?:urb(?:anizaci[oó]n)?\.?|urbanizaci[oó]n|sector|zona)\s*[:\-]?\s*([^\n,;|]{3,60})/gi,
    /\b(?:ubicad[oa](?:s)?\s+en|queda\s+en|se\s+encuentra\s+en)\s+([^\n,;|]{3,60})/gi
  ];
  for(const rx of strong)for(const m of raw.matchAll(rx)){const c=likelyPlace(m[1],'zone');if(c)out.push({value:c,pos:m.index||0,source:'strong'});}
  for(const m of raw.matchAll(/\b(?:en)\s+([\p{L}][^\n,;|]{2,48})/giu)){const original=String(m[1]||'').trim();if(!/^[A-ZÁÉÍÓÚÑ]/.test(original))continue;const c=likelyPlace(original,'zone');if(c)out.push({value:c,pos:m.index||0,source:'generic'});}
  return out;
}
function explicitComplexPhrases(raw){
  const out=[];const rxs=[
    /\b(?:conjunto(?:\s+residencial|\s+cerrado)?|residencias?|resd\.?|res\.?|torre|edificio|urbanizaci[oó]n\s+privada)\s*[:\-]?\s*[“"']?([^\n,;|]{2,65})/gi
  ];
  for(const rx of rxs)for(const m of raw.matchAll(rx)){const c=likelyPlace(m[1],'complex');if(c)out.push({value:c,pos:m.index||0,source:'explicit'});}
  for(const line0 of raw.split(/\r?\n/).slice(0,18)){
    const line=likelyPlace(line0.replace(/^[ *•\-:,.“”"']+|[ *•\-:,.“”"']+$/g,'').trim(),'complex');
    if(line&&/^villas?\s+[\p{L}0-9][\p{L}0-9 .'-]{2,38}$/iu.test(line)&&!/\b(?:venta|alquiler|casa|townhouse|apartamento|precio)\b/i.test(line))out.push({value:line,pos:raw.indexOf(line0),source:'villa_line'});
  }
  return out;
}
function exactZoneMentions(raw,cat){
  const n=normLocation(raw),out=[];
  for(const z of (cat.zones||[]).filter(x=>x.activo!==false))for(const alias of zoneAliases(z)){
    const an=normLocation(alias);if(an.length<3)continue;let pos=n.indexOf(an);if(pos<0)continue;
    let score=1;const before=n.slice(Math.max(0,pos-30),pos);
    if(/(?:cerca de|hacia)\s*$/.test(before))score=.93;else if(/(?:en|urb|urbanizacion|sector|zona)\s*$/.test(before))score=1;
    out.push({zone:z,alias,score,pos,source:'catalog_exact'});
  }
  return out;
}
function matchZoneCandidate(candidate,cat,threshold=.85){
  let best=null;
  for(const z of (cat.zones||[]).filter(x=>x.activo!==false))for(const alias of zoneAliases(z)){
    const score=fuzzyScore(candidate,alias);if(!best||score>best.score)best={zone:z,alias,score};
  }
  return best&&best.score>=threshold?best:null;
}
function exactComplexMentions(raw,cat,zoneId=null){
  const n=normLocation(raw),rows=[];
  const list=(cat.complexes||[]).filter(c=>c.activo!==false&&(!zoneId||c.zona_id===zoneId));
  for(const c of list)for(const alias of complexAliases(c)){const an=normLocation(alias);const pos=n.indexOf(an);if(an.length>=3&&pos>=0)rows.push({complex:c,alias,score:1,pos});}
  return rows;
}
function matchComplexCandidate(candidate,cat,zoneId=null,threshold=.85){
  let best=null,second=null;
  const list=(cat.complexes||[]).filter(c=>c.activo!==false&&(!zoneId||c.zona_id===zoneId));
  for(const c of list)for(const alias of complexAliases(c)){
    const score=fuzzyScore(candidate,alias);const row={complex:c,alias,score};if(!best||score>best.score){second=best;best=row;}else if(!second||score>second.score)second=row;
  }
  if(!best||best.score<threshold)return null;
  if(second&&Math.abs(best.score-second.score)<.025&&best.complex.id!==second.complex.id)return null;
  return best;
}
function detectMunicipality(raw,cat){
  const n=normLocation(raw);for(const m of cat.municipalities||[])for(const a of [m.nombre,...(m.aliases||[])])if(n.includes(normLocation(a)))return m;return null;
}
function complexTypeHint(raw,candidate){
  const n=normLocation(raw),c=normLocation(candidate),pos=n.indexOf(c),pre=n.slice(Math.max(0,pos-35),pos);
  if(/torre\s*$/.test(pre))return 'torre';if(/edificio\s*$/.test(pre))return 'edificio';if(/urbanizacion privada\s*$/.test(pre))return 'urbanizacion_privada';return 'conjunto_cerrado';
}

export function resolveLocationRecord(text='',catalog=null,options={}){
  const cat=catalogOrSeed(catalog),raw=String(text),exact=exactZoneMentions(raw,cat);
  const phrases=explicitZonePhrases(raw);
  let zoneMatch=null,zoneDetected=null;

  if(exact.length){
    exact.sort((a,b)=>b.score-a.score||normLocation(b.alias).length-normLocation(a.alias).length||a.pos-b.pos);zoneMatch=exact[0];zoneDetected=zoneMatch.alias;
  }
  if(!zoneMatch){
    for(const p of phrases){const m=matchZoneCandidate(p.value,cat,.85);if(m){zoneMatch={...m,pos:p.pos,source:'fuzzy_phrase'};zoneDetected=p.value;break;}}
  }
  if(!zoneMatch&&options.existingZone){const m=matchZoneCandidate(options.existingZone,cat,.82);if(m){zoneMatch={...m,source:'legacy'};zoneDetected=options.existingZone;}}
  if(!zoneDetected&&phrases.length)zoneDetected=phrases[0].value;

  // A known residential complex is a stronger geographic signal than a vague market phrase.
  // Because every complex belongs to one canonical zone, it can infer the parent zone/municipality.
  const globalKnownComplex=exactComplexMentions(raw,cat,null).sort((a,b)=>a.pos-b.pos)[0]||null;
  if(globalKnownComplex){
    const parent=(cat.zones||[]).find(z=>z.id===globalKnownComplex.complex.zona_id);
    if(parent){
      zoneMatch={zone:parent,alias:parent.nombre,score:1,pos:globalKnownComplex.pos,source:'complex_parent'};
      zoneDetected=zoneDetected||parent.nombre;
    }
  }

  const zone=zoneMatch?.zone||null,municipality=zone?municipalityById(cat,zone.municipio_id):detectMunicipality(raw,cat);
  const complexCandidates=[];
  if(options.existingComplex){const ec=likelyPlace(options.existingComplex,'complex');if(ec)complexCandidates.push({value:ec,source:'legacy'});}
  complexCandidates.push(...explicitComplexPhrases(raw));
  const exactComplex=exactComplexMentions(raw,cat,zone?.id||null);
  let complexMatch=exactComplex.sort((a,b)=>a.pos-b.pos)[0]||null,complexDetected=complexMatch?.alias||complexCandidates[0]?.value||null;
  if(!complexMatch&&complexDetected)complexMatch=matchComplexCandidate(complexDetected,cat,zone?.id||null,.85);
  const complexLooksLikeZone=complexDetected?matchZoneCandidate(complexDetected,cat,.88):null;
  if(complexLooksLikeZone&&!complexMatch)complexDetected=null;

  const allExactZones=uniq(exact.map(x=>x.zone.nombre));
  const locationTerms=uniq([municipality?.nombre,zone?.nombre,...allExactZones,...phrases.map(x=>x.value),zoneDetected,complexMatch?.complex?.nombre,complexDetected].filter(Boolean));
  const pending=[];
  const zoneIsActuallyComplex=zoneDetected&&complexDetected&&normLocation(zoneDetected)===normLocation(complexDetected);
  if(!zone&&zoneDetected&&!zoneIsActuallyComplex){pending.push({kind:'zone',detected:zoneDetected,detected_norm:normLocation(zoneDetected),municipality_id:municipality?.id||null,confidence:0,source:'local_rules'});}
  if(complexDetected&&!complexMatch){pending.push({kind:'complex',detected:complexDetected,detected_norm:normLocation(complexDetected),municipality_id:municipality?.id||null,zone_id:zone?.id||null,zone_nombre:zone?.nombre||null,complex_type_hint:complexTypeHint(raw,complexDetected),confidence:0,source:'local_rules'});}

  return {
    municipality_id:municipality?.id||null,municipality:municipality?.nombre||null,
    zone_id:zone?.id||null,zone:zone?.nombre||null,zone_detected:zoneDetected||null,zone_detected_norm:normLocation(zoneDetected||''),
    zone_confidence:zoneMatch?.score||0,zone_matches:exact.map(x=>({id:x.zone.id,nombre:x.zone.nombre,score:x.score})),
    complex_id:complexMatch?.complex?.id||null,complex:complexMatch?.complex?.nombre||null,complex_detected:complexDetected||null,complex_detected_norm:normLocation(complexDetected||''),
    complex_confidence:complexMatch?.score||0,location_terms:locationTerms,requires_review:pending.length>0,pending
  };
}
