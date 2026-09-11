(() => {
  // intent-utils.js?v=0786
  var A = { \u00E1: "a", \u00E9: "e", \u00ED: "i", \u00F3: "o", \u00FA: "u", \u00FC: "u", \u00F1: "n" };
  function n(s = "") {
    return String(s).toLowerCase().replace(/[áéíóúüñ]/g, (c) => A[c] || c).replace(/[^\p{L}\p{N}$%+./\-\s]/gu, " ").replace(/\s+/g, " ").trim();
  }
  var PROPERTY = /\b(apartamento|apto|apartamento|casa|quinta|vivienda|town\s*house|townhouse|town\s*home|townhome|townhause|\bth\b|penthouse|\bph\b|terreno|parcela|lote|local|oficina|galpon|anexo|inmueble|apart[o-]?quinta)\b/i;
  var STRONG_REQUEST_START = /^(?:urgente\s+)?(?:solicito|solicitamos|solicitud(?:es)?|se\s+solicita|se\s+solicitan|busco|buscamos|se\s+busca|se\s+buscan|ando\s+buscando|estoy\s+buscando|estamos\s+buscando|buscando\s+para\s+cliente|cliente\s+(?:busca|buscando|solicita|requiere|necesita)|tengo\s+(?:un\s+)?cliente(?:\s+que)?\s+(?:busca|buscando|requiere|necesita)|requiero|requerimos|se\s+requiere|necesito|necesitamos|en\s+busqueda\s+de|requerimiento|demanda)\b/i;
  var EARLY_REQUEST = /\b(?:solicito|solicitamos|solicitud(?:es)?|se\s+solicita|busco|buscamos|se\s+busca|ando\s+buscando|cliente\s+(?:busca|buscando|solicita|requiere|necesita)|tengo\s+(?:un\s+)?cliente|requiero|requerimos|necesito|necesitamos|requerimiento)\b/i;
  var REQUEST_BUDGET = /\b(?:presupuesto|maximo|maxima|tope|rango|canon)\b.{0,40}(?:\$|usd|us\$)?\s*\d/i;
  var LISTING_START = /^(?:.{0,25}\b)?(?:en\s+venta|venta\b|vendo|vende|se\s+vende|en\s+alquiler|alquiler\b|alquilo|alquila|se\s+alquila|canon\b|nueva\s+captacion|captacion\b|oportunidad\b|precio\b|hermos[oa]\b|excelente\b|amplio\b|moderno\b|comodo\b)/i;
  function isDemandRequest(text = "") {
    const x = n(text);
    if (!x) return false;
    const head = x.slice(0, 260);
    const first = x.slice(0, 130);
    if (STRONG_REQUEST_START.test(head)) return true;
    const req = EARLY_REQUEST.exec(head);
    if (req && req.index < 115) {
      const around = head.slice(req.index, Math.min(head.length, req.index + 155));
      if (PROPERTY.test(around) || REQUEST_BUDGET.test(around) || /\bzonas?\b/.test(around)) return true;
    }
    if (/^(?:urgente\s+)?(?:solicitud(?:es)?|requerimiento|demanda)\b/.test(head) && !LISTING_START.test(first)) return true;
    if (/^.{0,35}\btengo\s+(?:un\s+)?cliente\b/.test(first) && PROPERTY.test(head)) return true;
    return false;
  }

  // location-catalog.js?v=0786
  var A2 = { \u00E1: "a", \u00E9: "e", \u00ED: "i", \u00F3: "o", \u00FA: "u", \u00FC: "u", \u00F1: "n" };
  function normLocation(s = "") {
    return String(s).toLowerCase().replace(/[áéíóúüñ]/g, (c) => A2[c] || c).replace(/[^\p{L}\p{N}\s\-]/gu, " ").replace(/\s+/g, " ").trim();
  }
  function slugLocation(s = "") {
    return normLocation(s).replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }
  var SEED_MUNICIPALITIES = [
    { id: "mun_valencia", nombre: "Valencia", aliases: ["Valencia", "Municipio Valencia", "Valencia Norte"], activo: true },
    { id: "mun_san-diego", nombre: "San Diego", aliases: ["San Diego", "Municipio San Diego"], activo: true },
    { id: "mun_naguanagua", nombre: "Naguanagua", aliases: ["Naguanagua", "Municipio Naguanagua"], activo: true },
    { id: "mun_los-guayos", nombre: "Los Guayos", aliases: ["Los Guayos", "Municipio Los Guayos"], activo: true },
    { id: "mun_guacara", nombre: "Guacara", aliases: ["Guacara", "Municipio Guacara"], activo: true }
  ];
  var Z = (municipio_id, nombre, aliases = []) => ({ id: `zone_${slugLocation(nombre)}_${municipio_id.replace(/^mun_/, "")}`, nombre, municipio_id, aliases: [nombre, ...aliases], fuente: "catalogo_territorial_0412", activo: true });
  var SEED_ZONES = [
    Z("mun_valencia", "Agua Blanca", ["Aqua Blanca"]),
    Z("mun_valencia", "Altos de Guataparo", ["Alto de Guataparo"]),
    Z("mun_valencia", "Camoruco", ["Camoruco Viejo"]),
    Z("mun_valencia", "Campo Alegre", []),
    Z("mun_valencia", "Colinas de Guataparo", []),
    Z("mun_valencia", "Country Club", ["Guataparo Country Club"]),
    Z("mun_valencia", "El Bosque", []),
    Z("mun_valencia", "El Parral", []),
    Z("mun_valencia", "El Recreo", []),
    Z("mun_valencia", "El Trigal", ["Trigal"]),
    Z("mun_valencia", "Guaparo", ["Guaparo Norte"]),
    Z("mun_valencia", "Guataparo", []),
    Z("mun_valencia", "La Alegr\xEDa", ["La Alegria"]),
    Z("mun_valencia", "La Arboleda", []),
    Z("mun_valencia", "La Trigale\xF1a", ["Trigale\xF1a", "La Trigalena", "La Trigale\xF1a Alta", "La Trigale\xF1a Baja"]),
    Z("mun_valencia", "La Vi\xF1a", ["La Vina"]),
    Z("mun_valencia", "Las Acacias", ["La Acacia", "Acacias"]),
    Z("mun_valencia", "Las Chimeneas", ["La Chimenea", "Chimeneas"]),
    Z("mun_valencia", "Lomas del Este", ["Loma del Este", "Lomas de Este", "Loma Este"]),
    Z("mun_valencia", "Los Colorados", []),
    Z("mun_valencia", "Los Mangos", []),
    Z("mun_valencia", "Los N\xEDsperos", ["Los Nisperos"]),
    Z("mun_valencia", "Los Sauces", []),
    Z("mun_valencia", "Piedras Pintadas", ["Piedra Pintada"]),
    Z("mun_valencia", "Portachuelo", []),
    Z("mun_valencia", "Prebo", ["Callej\xF3n Prebo", "Callejon Prebo"]),
    Z("mun_valencia", "Prebo I", ["Prebo 1"]),
    Z("mun_valencia", "Prebo II", ["Prebo 2"]),
    Z("mun_valencia", "Prebo III", ["Prebo 3"]),
    Z("mun_valencia", "Sabana Larga", []),
    Z("mun_valencia", "San Jos\xE9 de Tarbes", ["San Jose de Tarbes"]),
    Z("mun_valencia", "Santa Cecilia", []),
    Z("mun_valencia", "Trigal Centro", ["El Trigal Centro"]),
    Z("mun_valencia", "Trigal Norte", ["El Trigal Norte"]),
    Z("mun_valencia", "Trigal Sur", ["El Trigal Sur"]),
    Z("mun_valencia", "Valles de Camoruco", ["Valle de Camoruco"]),
    Z("mun_valencia", "El Vi\xF1edo", ["Vi\xF1edo", "El Vinedo"]),
    Z("mun_valencia", "Michelena", ["La Michelena"]),
    Z("mun_valencia", "La Isabelica", []),
    Z("mun_valencia", "Los Caobos", []),
    Z("mun_valencia", "Flor Amarillo", []),
    Z("mun_valencia", "La Candelaria", []),
    Z("mun_valencia", "Santa Rosa", []),
    Z("mun_valencia", "San Blas", []),
    Z("mun_valencia", "La Michelena", ["Michelena"]),
    Z("mun_san-diego", "Pueblo de San Diego", ["Poblado de San Diego", "Pueblo San Diego"]),
    Z("mun_san-diego", "El Remanso", []),
    Z("mun_san-diego", "La Esmeralda", []),
    Z("mun_san-diego", "Monte Serino", ["Monteserino", "MonteSerino"]),
    Z("mun_san-diego", "Terrazas de San Diego", []),
    Z("mun_san-diego", "El Morro", ["Morro I", "Morro II"]),
    Z("mun_san-diego", "La Cumaca", ["Parque Residencial La Cumaca"]),
    Z("mun_san-diego", "Paso Real", []),
    Z("mun_san-diego", "Tulip\xE1n", ["Tulipan"]),
    Z("mun_san-diego", "Valle de Oro", []),
    Z("mun_san-diego", "Los Jarales", ["Los Arales", "Los \xC1rales", "Los Jaureles"]),
    Z("mun_san-diego", "Campo Solo", []),
    Z("mun_san-diego", "Mini Granjas San Diego", ["Mini Granja San Diego", "Las Minigranjas", "MiniGranjas"]),
    Z("mun_san-diego", "Brisas del Valle", []),
    Z("mun_san-diego", "Castillito", ["Terrazas de Castillito"]),
    Z("mun_san-diego", "La Ciudadela", []),
    Z("mun_san-diego", "La Colonia", []),
    Z("mun_san-diego", "Las Morochas", ["Las Morochas I", "Las Morochas II", "Las Morochas III", "Las Morochas IV"]),
    Z("mun_san-diego", "Los Frailes", []),
    Z("mun_san-diego", "Los Tamarindos", []),
    Z("mun_san-diego", "Lomas de Esmeralda", []),
    Z("mun_san-diego", "Valle Verde", []),
    Z("mun_san-diego", "Villa de San Diego", ["Villas de San Diego"]),
    Z("mun_san-diego", "Villa Jard\xEDn", ["Villa Jardin"]),
    Z("mun_san-diego", "Villa Para\xEDso", ["Villa Paraiso", "Villa Para\xEDso I"]),
    Z("mun_san-diego", "Yuma", ["Yuma I", "Yuma II", "Yuma 27", "Yuma 28"]),
    Z("mun_san-diego", "San Francisco de C\xFApira", ["San Francisco de Cupira"]),
    Z("mun_san-diego", "Santa Marta", []),
    Z("mun_san-diego", "Las Trianas", []),
    Z("mun_san-diego", "El Para\xEDso", ["El Paraiso"]),
    Z("mun_san-diego", "El Otro Lado", []),
    Z("mun_san-diego", "Los Andes", []),
    Z("mun_san-diego", "Los Anaucos", []),
    Z("mun_san-diego", "Las Gaviotas", []),
    Z("mun_san-diego", "La Lopera", []),
    Z("mun_san-diego", "Laguna Villa", []),
    Z("mun_san-diego", "Trinitarias", ["Las Trinitarias"]),
    Z("mun_san-diego", "Valpara\xEDso", ["Valparaiso"]),
    Z("mun_san-diego", "Monte Mayor", []),
    Z("mun_naguanagua", "B\xE1rbula", ["Barbula"]),
    Z("mun_naguanagua", "Ma\xF1ongo", ["Manongo", "Ciudad Jard\xEDn Ma\xF1ongo", "Ciudad Jardin Ma\xF1ongo", "Jard\xEDn Ma\xF1ongo", "Jardin Ma\xF1ongo", "Sector Ma\xF1ongo"]),
    Z("mun_naguanagua", "Tazajal", []),
    Z("mun_naguanagua", "Manantial", []),
    Z("mun_naguanagua", "El Rinc\xF3n", ["El Rincon"]),
    Z("mun_naguanagua", "La Entrada", []),
    Z("mun_naguanagua", "La Granja", []),
    Z("mun_naguanagua", "Las Quintas", ["Las Quintas I", "Las Quintas II"]),
    Z("mun_naguanagua", "La Campi\xF1a", ["La Campina"]),
    Z("mun_naguanagua", "El Cafetal", []),
    Z("mun_naguanagua", "Palma Real", []),
    Z("mun_naguanagua", "La Florida", []),
    Z("mun_naguanagua", "Guayabal", []),
    Z("mun_naguanagua", "Parque Naguanagua", []),
    Z("mun_naguanagua", "Colinas de Girardot", ["Colinas Girardot"]),
    Z("mun_naguanagua", "Capremco", ["Caprenco"]),
    Z("mun_naguanagua", "Carialinda", []),
    Z("mun_naguanagua", "Los Guayabitos", []),
    Z("mun_naguanagua", "Las Mercedes", []),
    Z("mun_naguanagua", "El Naranjal", ["Naranjal I", "Naranjal II"]),
    Z("mun_naguanagua", "La Palmera", []),
    Z("mun_naguanagua", "Parque Cabriales", []),
    Z("mun_naguanagua", "Santa Ana", []),
    Z("mun_naguanagua", "Terrazas de Paramacay", ["Terraza Paramacay"]),
    Z("mun_naguanagua", "Valle Alto", []),
    Z("mun_naguanagua", "Terrazas de Naguanagua", []),
    Z("mun_naguanagua", "El Retobo", []),
    Z("mun_naguanagua", "Tarap\xEDo", ["Tarapio"]),
    Z("mun_naguanagua", "Los Candiles", []),
    Z("mun_naguanagua", "Rotaf\xE9", ["Rotafe", "Rota Fe"]),
    Z("mun_naguanagua", "La Bego\xF1a", ["La Begona"]),
    Z("mun_naguanagua", "El Sam\xE1n", ["El Saman"]),
    Z("mun_naguanagua", "Mango Parado", []),
    Z("mun_naguanagua", "Mangos Villas", []),
    Z("mun_naguanagua", "Quintas de Naguanagua", []),
    Z("mun_naguanagua", "Quintas del Norte", []),
    Z("mun_naguanagua", "Villa Rinc\xF3n I", ["Villa Rincon I"]),
    Z("mun_naguanagua", "Villa Rinc\xF3n II", ["Villa Rincon II"]),
    Z("mun_naguanagua", "Villa del Norte", []),
    Z("mun_los-guayos", "Centro Los Guayos", ["Los Guayos", "Casco Central Los Guayos"]),
    Z("mun_los-guayos", "Paraparal", []),
    Z("mun_los-guayos", "Las Ag\xFCitas", ["Las Aguitas"]),
    Z("mun_los-guayos", "El Roble", []),
    Z("mun_los-guayos", "La Ensenada", []),
    Z("mun_los-guayos", "Las Garcitas", []),
    Z("mun_los-guayos", "Bello Monte I", []),
    Z("mun_los-guayos", "Bello Monte II", []),
    Z("mun_los-guayos", "Bello Monte III", []),
    Z("mun_los-guayos", "Ca\xF1o Seco", ["Cano Seco"]),
    Z("mun_los-guayos", "El Barrial", []),
    Z("mun_los-guayos", "El Jabillo", []),
    Z("mun_los-guayos", "Ciudadela Tacarigua", []),
    Z("mun_los-guayos", "Las Vegas", []),
    Z("mun_los-guayos", "Los Cerritos", []),
    Z("mun_los-guayos", "Los Guayos II", []),
    Z("mun_los-guayos", "Los Tuqueques", []),
    Z("mun_los-guayos", "Malabal", []),
    Z("mun_los-guayos", "Man\xE1", ["Mana"]),
    Z("mun_los-guayos", "Mar\xEDa Polanco", ["Maria Polanco"]),
    Z("mun_los-guayos", "Mira Valle", []),
    Z("mun_los-guayos", "Nomentana", []),
    Z("mun_los-guayos", "Orizabal", []),
    Z("mun_los-guayos", "Para\xEDso Real", ["Paraiso Real"]),
    Z("mun_los-guayos", "Piedras Negras", []),
    Z("mun_los-guayos", "R\xF3mulo Betancourt", ["Romulo Betancourt"]),
    Z("mun_los-guayos", "Rosa Linda", []),
    Z("mun_los-guayos", "Parque Valencia", []),
    Z("mun_los-guayos", "La Quizanda", ["Zona Industrial La Quizanda"]),
    Z("mun_guacara", "Guacara", ["Centro Guacara"]),
    Z("mun_guacara", "Yagua", []),
    Z("mun_guacara", "Ciudad Alianza", []),
    Z("mun_guacara", "Villas del Lago", []),
    Z("mun_guacara", "Villa Lago", []),
    Z("mun_guacara", "Valle Verde", []),
    Z("mun_guacara", "Agua Day", []),
    Z("mun_guacara", "Casas Dignas", []),
    Z("mun_guacara", "Ciudad Alianza 1ra Etapa", []),
    Z("mun_guacara", "Ciudad Alianza 2da Etapa", []),
    Z("mun_guacara", "Ciudad Alianza 4ta Etapa", []),
    Z("mun_guacara", "Ciudad Alianza 5ta Etapa", [])
  ];
  var C = (zona_id, nombre, tipo = "conjunto_cerrado", aliases = []) => ({ id: `complex_${slugLocation(nombre)}_${zona_id.replace(/^zone_/, "")}`, nombre, zona_id, tipo, aliases: [nombre, ...aliases], fuente: "catalogo_territorial_0412", activo: true });
  var SEED_COMPLEXES = [
    C("zone_el-rincon_naguanagua", "Doral Country", "conjunto_cerrado", ["Residencias Doral Country", "Res. Doral Country"]),
    C("zone_manongo_naguanagua", "Terramar", "torre", ["Torre Terramar", "Residencias Terramar"]),
    C("zone_lomas-del-este_valencia", "Lo M\xE1s Alto", "conjunto_cerrado", ["Lo Mas Alto"]),
    C("zone_el-remanso_san-diego", "Villa Serino Country Park", "conjunto_cerrado", ["Villa Serino", "Villaserino", "Country Park Villaserino"]),
    C("zone_pueblo-de-san-diego_san-diego", "Villas Corina", "conjunto_cerrado", ["Villa Corina"]),
    C("zone_la-cumaca_san-diego", "Villas de Alcal\xE1", "conjunto_cerrado", ["Villas de Alcala", "Villa de Alcal\xE1", "Villa de Alcala"]),
    C("zone_la-cumaca_san-diego", "Villas de San Diego Country Club", "urbanizacion_privada", ["Villas San Diego Country Club", "San Diego Country Club"])
  ];
  var SEED_LOCATION_CATALOG = { municipalities: SEED_MUNICIPALITIES, zones: SEED_ZONES, complexes: SEED_COMPLEXES };
  function uniq(arr = []) {
    return [...new Set(arr.filter(Boolean))];
  }
  function cleanCandidate(v = "") {
    let x = String(v).replace(/[“”"'*•_]/g, " ").replace(/[^\p{L}\p{N}\s.'\-]/gu, " ").replace(/\s+/g, " ").trim();
    x = x.replace(/^[^\p{L}\p{N}]+/u, "").trim();
    x = x.replace(/^(?:residencias?|resd|res|conjunto(?: residencial| cerrado)?|torre|edificio)\s*[:.\-]?\s+/i, "").trim();
    x = x.split(/\s*(?:\||\/\/|;)+\s*/)[0].trim();
    x = x.split(/\s+\.\s+/)[0].trim();
    x = x.replace(/\s*\([^)]*$/, "").trim();
    x = x.split(/\s+(?:en|ubicad[oa]s?|sector|zona|urb(?:anizacion)?|urbanizacion|cerca\s+de|hacia|valencia|carabobo|precio|ref(?:erencia)?|canon|de\s+\d{2,5}\b|consta\b|con\b|cuenta\b|planta\b|pozo\b|tanque\b|vigilancia\b|mantenimiento\b|areas?\s+comunes?\b)/i)[0].trim();
    x = x.replace(/[,:;.\-]+$/, "").trim();
    if (x.length < 2 || x.length > 48 || x.split(/\s+/).length > 6) return null;
    if (/\$|\b(?:venta|vendo|alquiler|alquilo|apartamento|casa|townhouse|habitaciones?|banos?|precio|mts?|m2)\b/i.test(x)) return null;
    return x;
  }
  var DESC_WORDS = /\b(?:cuenta|exclusiv[oa]|vigilancia|privada|privado|cerrado|pozo|piscina|habitaciones?|banos?|baños?|puestos?|metros?|mts?|m2|data|hermos[oa]s?|optimas?|óptimas?|condiciones?|tranquil[oa]|excelente|ubicacion|ubicación|consta|servicio|garantizado|adultos?|perfil|juridic[oa]|jurídic[oa]|amoblad[oa]|equipad[oa]|comercial|mamposteria|mampostería|piso|nivel|obra\s+blanca|grano|mantenimiento|planta|electrica|eléctrica|areas?|áreas?|comunes?|tanque|subterraneo|subterráneo|sobredimensionado|acabados?|cocina|sala|comedor|estacionamiento|edificio\s+de|casa\s+de|town\s*house|apartamento)\b/i;
  function likelyPlace(v = "", kind = "zone") {
    const x = cleanCandidate(v);
    if (!x) return null;
    const n2 = normLocation(x);
    if (DESC_WORDS.test(x)) return null;
    if (/^(?:de|del|un|una|id|l o|con|cuenta|exclusivo|exclusiva|cerrado|privado|privada|piso|nivel|obra|planta|tanque|pozo)\b/i.test(x)) return null;
    if (kind === "zone" && /^(?:torre|edificio|residencias?|res\b|conjunto|villa(?:s)?)\b/i.test(x)) return null;
    if (n2.split(" ").filter(Boolean).length > 5) return null;
    return x;
  }
  function editDistance(a, b) {
    a = normLocation(a);
    b = normLocation(b);
    const n2 = a.length, m = b.length;
    if (!n2) return m;
    if (!m) return n2;
    const prev = Array.from({ length: m + 1 }, (_, i) => i), cur = new Array(m + 1);
    for (let i = 1; i <= n2; i++) {
      cur[0] = i;
      for (let j = 1; j <= m; j++) cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      for (let j = 0; j <= m; j++) prev[j] = cur[j];
    }
    return prev[m];
  }
  function tokenScore(a, b) {
    const A3 = new Set(normLocation(a).split(" ").filter(Boolean)), B = new Set(normLocation(b).split(" ").filter(Boolean));
    if (!A3.size || !B.size) return 0;
    let i = 0;
    for (const x of A3) if (B.has(x)) i++;
    return i / (A3.size + B.size - i);
  }
  function fuzzyScore(a, b) {
    const x = normLocation(a), y = normLocation(b);
    if (!x || !y) return 0;
    if (x === y) return 1;
    if (x.length >= 5 && y.length >= 5 && (x.includes(y) || y.includes(x))) return 0.94;
    const dist = editDistance(x, y);
    if (dist === 1 && Math.max(x.length, y.length) >= 6) return 0.92;
    const lev = 1 - dist / Math.max(x.length, y.length);
    return Math.max(0, Math.min(1, lev * 0.78 + tokenScore(x, y) * 0.22));
  }
  function catalogOrSeed(catalog) {
    return catalog && catalog.zones?.length ? catalog : SEED_LOCATION_CATALOG;
  }
  function zoneAliases(z) {
    return uniq([z.nombre, ...z.aliases || []]);
  }
  function complexAliases(c) {
    return uniq([c.nombre, ...c.aliases || []]);
  }
  function municipalityById(cat, id) {
    return cat.municipalities?.find((x) => x.id === id) || null;
  }
  function explicitZonePhrases(raw) {
    const out = [];
    const strong = [
      /\b(?:urb(?:anizaci[oó]n)?\.?|urbanizaci[oó]n|sector|zona)\s*[:\-]?\s*([^\n,;|]{3,60})/gi,
      /\b(?:ubicad[oa](?:s)?\s+en|queda\s+en|se\s+encuentra\s+en)\s+([^\n,;|]{3,60})/gi
    ];
    for (const rx of strong) for (const m of raw.matchAll(rx)) {
      const c = likelyPlace(m[1], "zone");
      if (c) out.push({ value: c, pos: m.index || 0, source: "strong" });
    }
    for (const m of raw.matchAll(/\b(?:en)\s+([\p{L}][^\n,;|]{2,48})/giu)) {
      const original = String(m[1] || "").trim();
      if (!/^[A-ZÁÉÍÓÚÑ]/.test(original)) continue;
      const c = likelyPlace(original, "zone");
      if (c) out.push({ value: c, pos: m.index || 0, source: "generic" });
    }
    return out;
  }
  function explicitComplexPhrases(raw) {
    const out = [];
    const rxs = [
      /\b(?:conjunto(?:\s+residencial|\s+cerrado)?|residencias?|resd\.?|res\.?|torre|edificio|urbanizaci[oó]n\s+privada)\s*[:\-]?\s*[“"']?([^\n,;|]{2,65})/gi
    ];
    for (const rx of rxs) for (const m of raw.matchAll(rx)) {
      const c = likelyPlace(m[1], "complex");
      if (c) out.push({ value: c, pos: m.index || 0, source: "explicit" });
    }
    for (const line0 of raw.split(/\r?\n/).slice(0, 18)) {
      const line = likelyPlace(line0.replace(/^[ *•\-:,.“”"']+|[ *•\-:,.“”"']+$/g, "").trim(), "complex");
      if (line && /^villas?\s+[\p{L}0-9][\p{L}0-9 .'-]{2,38}$/iu.test(line) && !/\b(?:venta|alquiler|casa|townhouse|apartamento|precio)\b/i.test(line)) out.push({ value: line, pos: raw.indexOf(line0), source: "villa_line" });
    }
    return out;
  }
  function exactZoneMentions(raw, cat) {
    const n2 = normLocation(raw), out = [];
    for (const z of (cat.zones || []).filter((x) => x.activo !== false)) for (const alias of zoneAliases(z)) {
      const an = normLocation(alias);
      if (an.length < 3) continue;
      let pos = n2.indexOf(an);
      if (pos < 0) continue;
      let score = 1;
      const before = n2.slice(Math.max(0, pos - 30), pos);
      if (/(?:cerca de|hacia)\s*$/.test(before)) score = 0.93;
      else if (/(?:en|urb|urbanizacion|sector|zona)\s*$/.test(before)) score = 1;
      out.push({ zone: z, alias, score, pos, source: "catalog_exact" });
    }
    return out;
  }
  function matchZoneCandidate(candidate, cat, threshold = 0.85) {
    let best = null;
    for (const z of (cat.zones || []).filter((x) => x.activo !== false)) for (const alias of zoneAliases(z)) {
      const score = fuzzyScore(candidate, alias);
      if (!best || score > best.score) best = { zone: z, alias, score };
    }
    return best && best.score >= threshold ? best : null;
  }
  function exactComplexMentions(raw, cat, zoneId = null) {
    const n2 = normLocation(raw), rows = [];
    const list = (cat.complexes || []).filter((c) => c.activo !== false && (!zoneId || c.zona_id === zoneId));
    for (const c of list) for (const alias of complexAliases(c)) {
      const an = normLocation(alias);
      const pos = n2.indexOf(an);
      if (an.length >= 3 && pos >= 0) rows.push({ complex: c, alias, score: 1, pos });
    }
    return rows;
  }
  function matchComplexCandidate(candidate, cat, zoneId = null, threshold = 0.85) {
    let best = null, second = null;
    const list = (cat.complexes || []).filter((c) => c.activo !== false && (!zoneId || c.zona_id === zoneId));
    for (const c of list) for (const alias of complexAliases(c)) {
      const score = fuzzyScore(candidate, alias);
      const row = { complex: c, alias, score };
      if (!best || score > best.score) {
        second = best;
        best = row;
      } else if (!second || score > second.score) second = row;
    }
    if (!best || best.score < threshold) return null;
    if (second && Math.abs(best.score - second.score) < 0.025 && best.complex.id !== second.complex.id) return null;
    return best;
  }
  function detectMunicipality(raw, cat) {
    const n2 = normLocation(raw);
    for (const m of cat.municipalities || []) for (const a of [m.nombre, ...m.aliases || []]) if (n2.includes(normLocation(a))) return m;
    return null;
  }
  function complexTypeHint(raw, candidate) {
    const n2 = normLocation(raw), c = normLocation(candidate), pos = n2.indexOf(c), pre = n2.slice(Math.max(0, pos - 35), pos);
    if (/torre\s*$/.test(pre)) return "torre";
    if (/edificio\s*$/.test(pre)) return "edificio";
    if (/urbanizacion privada\s*$/.test(pre)) return "urbanizacion_privada";
    return "conjunto_cerrado";
  }
  function resolveLocationRecord(text = "", catalog = null, options = {}) {
    const cat = catalogOrSeed(catalog), raw = String(text), exact = exactZoneMentions(raw, cat);
    const phrases = explicitZonePhrases(raw);
    let zoneMatch = null, zoneDetected = null;
    if (exact.length) {
      exact.sort((a, b) => b.score - a.score || normLocation(b.alias).length - normLocation(a.alias).length || a.pos - b.pos);
      zoneMatch = exact[0];
      zoneDetected = zoneMatch.alias;
    }
    if (!zoneMatch) {
      for (const p of phrases) {
        const m = matchZoneCandidate(p.value, cat, 0.85);
        if (m) {
          zoneMatch = { ...m, pos: p.pos, source: "fuzzy_phrase" };
          zoneDetected = p.value;
          break;
        }
      }
    }
    if (!zoneMatch && options.existingZone) {
      const m = matchZoneCandidate(options.existingZone, cat, 0.82);
      if (m) {
        zoneMatch = { ...m, source: "legacy" };
        zoneDetected = options.existingZone;
      }
    }
    if (!zoneDetected && phrases.length) zoneDetected = phrases[0].value;
    const globalKnownComplex = exactComplexMentions(raw, cat, null).sort((a, b) => a.pos - b.pos)[0] || null;
    if (globalKnownComplex) {
      const parent = (cat.zones || []).find((z) => z.id === globalKnownComplex.complex.zona_id);
      if (parent) {
        zoneMatch = { zone: parent, alias: parent.nombre, score: 1, pos: globalKnownComplex.pos, source: "complex_parent" };
        zoneDetected = zoneDetected || parent.nombre;
      }
    }
    const zone = zoneMatch?.zone || null, municipality = zone ? municipalityById(cat, zone.municipio_id) : detectMunicipality(raw, cat);
    const complexCandidates = [];
    if (options.existingComplex) {
      const ec = likelyPlace(options.existingComplex, "complex");
      if (ec) complexCandidates.push({ value: ec, source: "legacy" });
    }
    complexCandidates.push(...explicitComplexPhrases(raw));
    const exactComplex = exactComplexMentions(raw, cat, zone?.id || null);
    let complexMatch = exactComplex.sort((a, b) => a.pos - b.pos)[0] || null, complexDetected = complexMatch?.alias || complexCandidates[0]?.value || null;
    if (!complexMatch && complexDetected) complexMatch = matchComplexCandidate(complexDetected, cat, zone?.id || null, 0.85);
    const complexLooksLikeZone = complexDetected ? matchZoneCandidate(complexDetected, cat, 0.88) : null;
    if (complexLooksLikeZone && !complexMatch) complexDetected = null;
    const allExactZones = uniq(exact.map((x) => x.zone.nombre));
    const locationTerms = uniq([municipality?.nombre, zone?.nombre, ...allExactZones, ...phrases.map((x) => x.value), zoneDetected, complexMatch?.complex?.nombre, complexDetected].filter(Boolean));
    const pending = [];
    const zoneIsActuallyComplex = zoneDetected && complexDetected && normLocation(zoneDetected) === normLocation(complexDetected);
    if (!zone && zoneDetected && !zoneIsActuallyComplex) {
      pending.push({ kind: "zone", detected: zoneDetected, detected_norm: normLocation(zoneDetected), municipality_id: municipality?.id || null, confidence: 0, source: "local_rules" });
    }
    if (complexDetected && !complexMatch) {
      pending.push({ kind: "complex", detected: complexDetected, detected_norm: normLocation(complexDetected), municipality_id: municipality?.id || null, zone_id: zone?.id || null, zone_nombre: zone?.nombre || null, complex_type_hint: complexTypeHint(raw, complexDetected), confidence: 0, source: "local_rules" });
    }
    return {
      municipality_id: municipality?.id || null,
      municipality: municipality?.nombre || null,
      zone_id: zone?.id || null,
      zone: zone?.nombre || null,
      zone_detected: zoneDetected || null,
      zone_detected_norm: normLocation(zoneDetected || ""),
      zone_confidence: zoneMatch?.score || 0,
      zone_matches: exact.map((x) => ({ id: x.zone.id, nombre: x.zone.nombre, score: x.score })),
      complex_id: complexMatch?.complex?.id || null,
      complex: complexMatch?.complex?.nombre || null,
      complex_detected: complexDetected || null,
      complex_detected_norm: normLocation(complexDetected || ""),
      complex_confidence: complexMatch?.score || 0,
      location_terms: locationTerms,
      requires_review: pending.length > 0,
      pending
    };
  }

  // location-utils.js?v=0786
  function normLoc(s = "") {
    return normLocation(s);
  }
  var KNOWN_ZONES = [...new Set(SEED_ZONES.flatMap((z) => [z.nombre, ...z.aliases || []]))].sort((a, b) => b.length - a.length);
  function extractLocationTerms(text = "", existingZone = null) {
    const r = resolveLocationRecord(text, SEED_LOCATION_CATALOG, { existingZone });
    return [...new Set([...r.location_terms || [], existingZone].filter(Boolean))];
  }

  // date-utils.js?v=0786
  function splitWhatsAppDate(s = "") {
    const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!m) return null;
    let y = Number(m[3]);
    if (y < 100) y += 2e3;
    return { a: Number(m[1]), b: Number(m[2]), y };
  }
  function parseFlexibleDate(value, order = "auto", fallback = "MDY") {
    if (!value) return 0;
    const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const y = Number(iso[1]), mo = Number(iso[2]), d = Number(iso[3]);
      const dt2 = new Date(y, mo - 1, d);
      if (dt2.getFullYear() === y && dt2.getMonth() === mo - 1 && dt2.getDate() === d) return dt2.getTime();
      return 0;
    }
    const p = splitWhatsAppDate(value);
    if (!p) return 0;
    let resolved = order;
    if (resolved === "auto" || !resolved) {
      if (p.a > 12 && p.b <= 12) resolved = "DMY";
      else if (p.b > 12 && p.a <= 12) resolved = "MDY";
      else resolved = fallback;
    }
    const day = resolved === "MDY" ? p.b : p.a;
    const month = resolved === "MDY" ? p.a : p.b;
    if (month < 1 || month > 12 || day < 1 || day > 31) return 0;
    const dt = new Date(p.y, month - 1, day);
    if (dt.getFullYear() !== p.y || dt.getMonth() !== month - 1 || dt.getDate() !== day) return 0;
    return dt.getTime();
  }
  function propertyTimestamp(p) {
    if (!p) return 0;
    if (p.date_iso) return parseFlexibleDate(p.date_iso, "auto", "MDY");
    return parseFlexibleDate(p.date, p.date_order || "auto", "MDY");
  }

  // search-utils.js?v=0786
  var ACCENTS = { \u00E1: "a", \u00E9: "e", \u00ED: "i", \u00F3: "o", \u00FA: "u", \u00FC: "u", \u00F1: "n" };
  function norm(s = "") {
    return String(s).toLowerCase().replace(/[áéíóúüñ]/g, (c) => ACCENTS[c] || c).replace(/[^\p{L}\p{N}$%+.\-\s]/gu, " ").replace(/\s+/g, " ").trim();
  }

  // search-index.js?v=0786
  var SEARCH_ALIAS = [
    [/\b(?:town\s*house|townhouse|townhause|town\s*home|townhome|\bth\b)\b/g, "townhouse"],
    [/\b(?:apto|apartamento)\b/g, "apartamento"],
    [/\b(?:quinta|vivienda|chalet|casa)\b/g, "casa"],
    [/\b(?:pent\s*house|penthouse|\bph\b)\b/g, "penthouse"],
    [/\b(?:galpon|galpón)\b/g, "galpon"]
  ];
  function canonSearch(s = "") {
    let x = norm(s);
    for (const [rx, v] of SEARCH_ALIAS) x = x.replace(rx, v);
    return x.replace(/\s+/g, " ").trim();
  }
  function editDistance1(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, d = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        i++;
        j++;
        continue;
      }
      if (++d > 1) return false;
      if (a.length > b.length) i++;
      else if (b.length > a.length) j++;
      else {
        i++;
        j++;
      }
    }
    return d + (i < a.length || j < b.length ? 1 : 0) <= 1;
  }
  function prepareFilters(filters = {}) {
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    return { ...filters, today: today.getTime(), residence: norm(filters.residence || ""), queryWords: canonSearch(filters.q || "").split(" ").filter(Boolean) };
  }
  function createSearchRecord(p) {
    const timestamp = propertyTimestamp(p), day = new Date(timestamp);
    day.setHours(0, 0, 0, 0);
    const normalizedSearchText = canonSearch([p.operation, p.property_type, p.municipality, p.zone, p.zone_detected, p.residence, p.complex_detected, p.sender, p.group, ...p.location_terms || [], p.text, p.normalized].filter(Boolean).join(" "));
    const normalizedLocation = normLoc([p.municipality, p.zone, p.zone_detected, p.residence, p.complex_detected, ...p.location_terms || [], ...(p.zone_matches || []).map((x) => x.nombre), ...extractLocationTerms(p.text || "", p.zone), p.text].filter(Boolean).join(" "));
    const record = { ...p, timestamp, day: day.getTime(), time: String(p.time || ""), normalizedSearchText, words: normalizedSearchText.split(" ").filter(Boolean), normalizedLocation, normalizedMunicipality: normLoc([p.municipality, p.zone, p.text].filter(Boolean).join(" ")), normalizedResidence: norm(p.residence || ""), normalizedText: norm(p.text || ""), isDemand: isDemandRequest(p.text || ""), hasPhone: !!(p.phone || p.resolved_phone) };
    for (const key of ["text", "location_terms", "zone_matches", "normalized", "sender", "group", "date", "date_iso", "date_order"]) delete record[key];
    return record;
  }
  function matchesSearchRecord(p, f) {
    const days = p.timestamp ? Math.floor((f.today - p.day) / 864e5) : 9999;
    if (days < 0 || days > 60 || p.isDemand) return false;
    for (const t of f.queryWords) {
      if (p.normalizedSearchText.includes(t)) continue;
      if (t.length >= 5 && p.words.some((w) => w.length >= 4 && editDistance1(t, w))) continue;
      return false;
    }
    if (f.operation && p.operation !== f.operation) return false;
    const types = Array.isArray(f.property_types) ? f.property_types.filter(Boolean) : [];
    if (types.length && !types.includes(p.property_type)) return false;
    const municipalityIds = Array.isArray(f.municipality_ids) ? f.municipality_ids.filter(Boolean) : [];
    if (municipalityIds.length && p.municipality_id && !municipalityIds.includes(p.municipality_id)) return false;
    if (municipalityIds.length && !p.municipality_id) {
      const names = (f.municipality_names || []).filter(Boolean);
      const mhay = p.normalizedMunicipality;
      if (names.length && !names.some((x) => mhay.includes(normLoc(x)))) return false;
    }
    const zoneIds = Array.isArray(f.zone_ids) ? f.zone_ids.filter(Boolean) : [];
    if (zoneIds.length && p.zone_id && !zoneIds.includes(p.zone_id)) return false;
    const zones = Array.isArray(f.zones) ? f.zones.filter(Boolean) : [];
    if (zones.length) {
      const locationHay = p.normalizedLocation;
      if (!zones.some((z) => locationHay.includes(normLoc(z)))) return false;
    }
    const residence = f.residence;
    if (residence && !p.normalizedResidence.includes(residence) && !p.normalizedText.includes(residence)) return false;
    const minPrice = Number(f.min_price || 0);
    const maxPrice = Number(f.max_price || 0);
    if (minPrice && (!p.price_usd || Number(p.price_usd) < minPrice)) return false;
    if (maxPrice && (!p.price_usd || Number(p.price_usd) > maxPrice)) return false;
    const minBeds = Number(f.bedrooms || 0);
    if (minBeds && (!p.bedrooms || Number(p.bedrooms) < minBeds)) return false;
    const minBaths = Number(f.bathrooms || 0);
    if (minBaths && (!p.bathrooms || Number(p.bathrooms) < minBaths)) return false;
    const minParking = Number(f.parking || 0);
    if (minParking && (!p.parking || Number(p.parking) < minParking)) return false;
    const minArea = Number(f.min_area || 0);
    const maxArea = Number(f.max_area || 0);
    if (minArea && (!p.area_m2 || Number(p.area_m2) < minArea)) return false;
    if (maxArea && (!p.area_m2 || Number(p.area_m2) > maxArea)) return false;
    for (const key of ["planta_100", "planta_electrica", "pozo", "tanque", "amoblado", "financiamiento", "piscina"]) {
      if (f[key] && !p[key]) return false;
    }
    if (f.only_phone && !p.hasPhone) return false;
    if (f.max_age_days) {
      const r = { days };
      if (r.days > Number(f.max_age_days)) return false;
    }
    return true;
  }

  // search-worker.js
  function installSearchWorker(port) {
    let revision = 0, records = [], ready = false, latest = null, running = false;
    const yieldTask = () => new Promise((resolve) => setTimeout(resolve, 0));
    const send = (message) => port.postMessage(message);
    async function pump() {
      if (running || !ready || !latest) return;
      running = true;
      try {
        while (ready && latest) {
          const query = latest;
          latest = null;
          const epoch = revision, started = performance.now(), filters = prepareFilters(query.filters);
          const cancelled = () => epoch !== revision || latest !== null;
          let rows = [];
          for (let i = 0; i < records.length; i++) {
            if (cancelled()) break;
            if (matchesSearchRecord(records[i], filters)) rows.push(records[i]);
            if (i % 250 === 249) await yieldTask();
          }
          if (cancelled()) continue;
          const mode = query.sortMode;
          const compare = (a, b) => mode === "price_asc" ? (a.price_usd ?? Infinity) - (b.price_usd ?? Infinity) : mode === "price_desc" ? (b.price_usd ?? -1) - (a.price_usd ?? -1) : mode === "appearances" ? (b.appearances || 0) - (a.appearances || 0) : b.timestamp - a.timestamp || b.time.localeCompare(a.time);
          let buffer = new Array(rows.length), work = 0;
          for (let width = 1; width < rows.length && !cancelled(); width *= 2) {
            for (let start = 0; start < rows.length && !cancelled(); start += width * 2) {
              const middle = Math.min(start + width, rows.length), end = Math.min(start + width * 2, rows.length);
              let left = start, right = middle;
              for (let out = start; out < end; out++) {
                buffer[out] = left < middle && (right >= end || !(compare(rows[left], rows[right]) > 0)) ? rows[left++] : rows[right++];
                if (++work % 2048 === 0) {
                  await yieldTask();
                  if (cancelled()) break;
                }
              }
            }
            [rows, buffer] = [buffer, rows];
          }
          if (!cancelled()) send({ type: "result", revision: epoch, generation: query.generation, ids: rows.map((p) => p.id), durationMs: performance.now() - started });
        }
      } catch {
        send({ type: "error", revision, message: "No se pudo completar la b\xFAsqueda." });
      } finally {
        running = false;
        if (ready && latest) pump();
      }
    }
    port.onmessage = async ({ data: m }) => {
      try {
        if (m.type === "reset") {
          revision = m.revision;
          records = [];
          ready = false;
          latest = null;
          return;
        }
        if (m.revision !== revision) return;
        if (m.type === "batch") {
          const epoch = revision;
          let deadline = performance.now() + 8;
          for (let i = 0; i < m.records.length; i++) {
            if (epoch !== revision) return;
            records.push(createSearchRecord(m.records[i]));
            if (performance.now() >= deadline) {
              await yieldTask();
              deadline = performance.now() + 8;
            }
          }
          if (epoch === revision) send({ type: "indexed", revision, batch: m.batch, count: records.length });
        } else if (m.type === "ready") {
          ready = true;
          send({ type: "ready", revision, count: records.length });
          pump();
        } else if (m.type === "query") {
          latest = m;
          pump();
        }
      } catch {
        send({ type: "error", revision, message: "No se pudo preparar la b\xFAsqueda." });
      }
    };
  }
  if (typeof self !== "undefined") installSearchWorker(self);
})();
