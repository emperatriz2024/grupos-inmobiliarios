import {webkit} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd();let stage='server';let watchdog=setTimeout(()=>{console.error('WEBKIT_TIMEOUT_STAGE',stage);process.exit(1)},240000);watchdog.unref();const mark=s=>{clearTimeout(watchdog);stage=s;watchdog=setTimeout(()=>{console.error('WEBKIT_TIMEOUT_STAGE',stage);process.exit(1)},240000);watchdog.unref();console.log('WEBKIT_STAGE',s)};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/__seed'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Isolated test fixture</title>');return;}
 if(url.pathname.startsWith('/.netlify/')){res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"test_no_external_services"}');return;}
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{const body=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.webmanifest')?'application/manifest+json':'application/octet-stream');res.end(body);}catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 mark('launch');browser=await webkit.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 mark('seed');await page.goto(base+'/__seed');
 await page.evaluate(async()=>{
   const {openDB}=await import('/db.js?v=0786'),db=await openDB();
   for(let i=0;i<13051;i+=250){await new Promise((resolve,reject)=>{const tx=db.transaction('properties','readwrite');for(let j=i;j<Math.min(i+250,13051);j++)tx.objectStore('properties').put({id:String(j),operation:'Venta',property_type:'Casa',municipality_id:'m1',municipality:'Valencia',zone_id:'z1',zone:'Centro',residence:'Sol',price_usd:50000+j,area_m2:100,bedrooms:3,bathrooms:2,parking:1,phone:'04141234567',date_iso:new Date(Date.now()-86400000).toISOString().slice(0,10),text:'Casa en venta en Valencia Centro.\nMensaje original completo '+j,price_audit_version:'0600'});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
   await new Promise((resolve,reject)=>{const tx=db.transaction(['municipalities','zones'],'readwrite');for(let i=0;i<130;i++){tx.objectStore('municipalities').put({id:'m'+i,nombre:i===1?'Valencia':'Municipio '+i,activo:true});tx.objectStore('zones').put({id:'z'+i,nombre:i===1?'Centro':'Zona '+i,municipio_id:'m1',activo:true});}tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
 });
 mark('app');const started=Date.now();await page.goto(base+'/');await page.waitForFunction(()=>globalThis.RADAR_READY===true,{},{timeout:30000});
 const startup=Date.now()-started;mark('RADAR_READY');
 assert.equal(await page.locator('#results .propertyCard').count(),30);
 for(const id of ['openTypeSelector','openMunicipalitySelector','openZoneSelector']){
   await page.locator('#'+id).click();await page.locator('#multiSelectorPanel').waitFor({state:'visible'});
   assert.ok(await page.locator('#selectorOptionsList *').count()<=60);
   if(id==='openTypeSelector'){await page.locator('#selectorOptionsList input[value="Casa"]').check();await page.locator('#selectorApplyBtn').click();}else await page.locator('#closeMultiSelector').click();
 }
 mark('search');await page.locator('#searchBtn').click();await page.locator('#openZoneSelector').click();await page.locator('#multiSelectorPanel').waitFor({state:'visible'});await page.locator('#closeMultiSelector').click();
 await page.waitForFunction(()=>document.querySelector('#searchBtn').textContent==='Buscar propiedades'&&document.querySelector('#searchIndexStatus').textContent==='Búsqueda lista',{},{timeout:180000});
 assert.match(await page.locator('#resultCount').textContent(),/13[.,]051/);
 mark('detail');await page.locator('#results .propertyCard .detail').first().click();
 await page.locator('#detailDialog').waitFor({state:'visible'});
 const href=await page.locator('#detailWhatsApp').getAttribute('href'),message=new URL(href).searchParams.get('text');
 assert.match(message,/^Hola colega, esta propiedad sigue disponible:\n\nCasa en venta en Valencia Centro\.\nMensaje original completo \d+\n\nQuedo atenta, gracias\.$/);
 const metrics=await page.evaluate(()=>globalThis.radarSearchPerformance);
 for(const [name,metric] of Object.entries(metrics))if(/TaskMs$|openSelector_/.test(name))assert.ok(metric.max<=50,`${name} exceeded 50ms: ${metric.max}`);
 assert.equal(await page.evaluate(async()=>{const {probeLocalDatabase}=await import('/db.js?v=0786');return (await probeLocalDatabase()).properties;}),13051);
 for(const asset of ['app.js','styles.css','sw.js','search-worker.js','search-index.js','search-worker-controller.js','search-worker-classic.js']){const response=await fetch(`${base}/${asset}?v=0786`);assert.equal(response.status,200);assert.doesNotMatch(await response.text(),/^<!doctype html/i);if(asset.endsWith('.js'))assert.match(response.headers.get('content-type'),/javascript/);}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({WebKit:'PASS',properties:13051,startupMs:startup,metrics},null,2));
}catch(error){console.error('WEBKIT_FAIL_STAGE',stage,error);throw error;}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));clearTimeout(watchdog);}
