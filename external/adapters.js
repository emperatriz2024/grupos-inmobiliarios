const HTTP_PROTOCOLS=new Set(['http:','https:']);

export function safeExternalUrl(raw=''){
  try{const u=new URL(String(raw).trim());return HTTP_PROTOCOLS.has(u.protocol)?u.toString():null;}catch{return null;}
}

export function sourceTypeFromUrl(raw=''){
  const safe=safeExternalUrl(raw);if(!safe)return 'otro';
  const h=new URL(safe).hostname.replace(/^www\./,'').toLowerCase();
  if(h.endsWith('instagram.com'))return 'instagram';
  if(h.endsWith('facebook.com')||h.endsWith('fb.com'))return 'marketplace';
  if(h.includes('mercadolibre.')||h.includes('mercadolivre.'))return 'mercadolibre';
  if(h.includes('remax'))return 'remax';
  if(h.includes('rentahouse'))return 'rentahouse';
  if(h.includes('skygroup'))return 'skygroup';
  return 'portal';
}

function decodeEntities(s=''){
  const el=typeof document!=='undefined'?document.createElement('textarea'):null;
  if(el){el.innerHTML=s;return el.value;}
  return s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
}
function meta(html,key){
  const escaped=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const patterns=[
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,'i')
  ];
  for(const rx of patterns){const m=html.match(rx);if(m)return decodeEntities(m[1]).trim();}
  return '';
}

export class ExternalSourceAdapter{
  constructor(type='portal'){this.type=type;}
  canHandle(url){return sourceTypeFromUrl(url)===this.type;}
  async analyze(url,{fetchImpl=globalThis.fetch}={}){
    const safe=safeExternalUrl(url);if(!safe)return {ok:false,code:'invalid_url',message:'La URL no es válida o no usa HTTP/HTTPS.'};
    if(typeof fetchImpl!=='function')return {ok:false,code:'unavailable',message:'Radar no tiene un lector web disponible en este dispositivo.'};
    try{
      const response=await fetchImpl(safe,{method:'GET',credentials:'omit',redirect:'follow',headers:{Accept:'text/html,application/xhtml+xml'}});
      if(!response.ok)return {ok:false,code:`http_${response.status}`,message:'Radar no pudo leer automáticamente esta publicación.'};
      const html=(await response.text()).slice(0,2_000_000);
      const title=meta(html,'og:title')||meta(html,'twitter:title');
      const description=meta(html,'og:description')||meta(html,'description')||meta(html,'twitter:description');
      const image=meta(html,'og:image');
      if(!title&&!description)return {ok:false,code:'no_public_metadata',message:'Radar no pudo leer automáticamente esta publicación. Usa los campos manuales.'};
      return {ok:true,type:this.type,url:safe,title,description,image:safeExternalUrl(image),evidence:{method:'public_metadata',fields:['title','description','image'].filter(k=>({title,description,image})[k])}};
    }catch{
      return {ok:false,code:'blocked_or_cors',message:'Radar no pudo leer automáticamente esta publicación. La plataforma puede exigir autenticación o bloquear la lectura desde el navegador.'};
    }
  }
}

export class InstagramAdapter extends ExternalSourceAdapter{constructor(){super('instagram');}}
export class FacebookMarketplaceAdapter extends ExternalSourceAdapter{constructor(){super('marketplace');}}
export class MercadoLibreAdapter extends ExternalSourceAdapter{
  constructor(){super('mercadolibre');}
  async analyze(url,{fetchImpl=globalThis.fetch}={}){
    const safe=safeExternalUrl(url);if(!safe)return {ok:false,code:'invalid_url',message:'La URL no es válida o no usa HTTP/HTTPS.'};
    const id=(safe.match(/\b(M[A-Z]{2})[-_ ]?(\d{6,})\b/i)||[]).slice(1).join('').toUpperCase();
    if(id&&typeof fetchImpl==='function'){
      try{
        const response=await fetchImpl(`https://api.mercadolibre.com/items/${encodeURIComponent(id)}`,{credentials:'omit'});
        if(response.ok){
          const item=await response.json();let description='';
          try{const d=await fetchImpl(`https://api.mercadolibre.com/items/${encodeURIComponent(id)}/description`,{credentials:'omit'});if(d.ok)description=(await d.json()).plain_text||'';}catch{}
          return {ok:true,type:this.type,url:safe,title:item.title||'',description,price:item.price??null,currency:item.currency_id||null,publisherId:item.seller_id||null,evidence:{method:'mercadolibre_public_api',itemId:id,fields:['title',description&&'description',item.price!=null&&'price',item.currency_id&&'currency'].filter(Boolean)}};
        }
      }catch{}
    }
    return super.analyze(safe,{fetchImpl});
  }
}
export class PortalAdapter extends ExternalSourceAdapter{constructor(type='portal'){super(type);}}

export function adapterForUrl(url){
  const type=sourceTypeFromUrl(url);
  if(type==='instagram')return new InstagramAdapter();
  if(type==='marketplace')return new FacebookMarketplaceAdapter();
  if(type==='mercadolibre')return new MercadoLibreAdapter();
  return new PortalAdapter(type);
}
