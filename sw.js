const CACHE_PREFIX='grupos-inmobiliarios-';
const CACHE=`${CACHE_PREFIX}v0786-production`;
const V='?v=0786';
const ASSETS=[
  './search-worker.js'+V,'./search-worker-controller.js'+V,'./search-index.js'+V,'./search-worker-classic.js'+V,'./intelligence-worker.js'+V,
  './','./index.html','./styles.css'+V,'./app.js'+V,'./db.js'+V,'./idb-open.js'+V,'./worker.js'+V,'./engine.js'+V,
  './zip-reader.js'+V,'./search-utils.js'+V,'./date-utils.js'+V,'./contact-utils.js'+V,
  './location-utils.js'+V,'./location-catalog.js'+V,'./intent-utils.js'+V,'./dedupe-utils.js'+V,
  './dropbox.js'+V,'./buyer-utils.js'+V,'./external-source-utils.js'+V,'./freshness-utils.js'+V,
  './version.js','./diagnostics.js','./core/property-policy.js','./core/operational-zip-batch.js','./external/adapters.js','./ingestion/source-ingestion.js','./ingestion/secondary-processing.js','./ingestion/demand-processing.js','./ingestion/manual-zip-batch.js','./ingestion/manual-import-state.js','./ingestion/worker-client.js','./core/radar/demand-engine.js','./core/radar/territory.js','./core/radar/config.js','./secondary-whatsapp/contract.js',
  './manifest.webmanifest','./icon.svg','./icon-180.png','./icon-192.png','./icon-512.png'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(Promise.resolve()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(new Request(event.request,{cache:'no-store'}));
      if(response.ok){const cache=await caches.open(CACHE);cache.put(event.request,response.clone()).catch(()=>{});}
      return response;
    }catch{
      const cached=await caches.match(event.request);
      if(cached)return cached;
      if(event.request.mode==='navigate')return caches.match('./index.html');
      return Response.error();
    }
  })());
});
