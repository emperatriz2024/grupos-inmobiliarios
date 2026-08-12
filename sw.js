const CACHE='grupos-inmobiliarios-v0501-core';
const V='?v=0501';
const ASSETS=['./','./index.html','./styles.css'+V,'./app.js'+V,'./db.js'+V,'./worker.js'+V,'./engine.js'+V,'./zip-reader.js'+V,'./search-utils.js'+V,'./date-utils.js'+V,'./contact-utils.js'+V,'./location-utils.js'+V,'./location-catalog.js'+V,'./intent-utils.js'+V,'./dedupe-utils.js'+V,'./dropbox.js'+V,'./manifest.webmanifest','./icon.svg','./icon-180.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(new Request(e.request,{cache:'no-store'})).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return resp;}).catch(()=>caches.match(e.request)));});
