import {MAX_BODY_BYTES} from '../../secondary-whatsapp/contract.js';

export function json(statusCode,body){return {statusCode,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify(body)};}
export function bearer(headers={}){const value=headers.authorization||headers.Authorization||'';return /^Bearer\s+(.+)$/i.exec(value)?.[1]||'';}
export function secureEqual(a='',b=''){const x=String(a),y=String(b);if(!x||x.length!==y.length)return false;let result=0;for(let i=0;i<x.length;i++)result|=x.charCodeAt(i)^y.charCodeAt(i);return result===0;}
export function parseJsonBody(event={}){
  const type=String(event.headers?.['content-type']||event.headers?.['Content-Type']||'').split(';')[0].trim().toLowerCase();
  if(type!=='application/json')return {ok:false,response:json(415,{error:'content_type_required'})};
  const raw=event.isBase64Encoded?Buffer.from(event.body||'','base64').toString('utf8'):String(event.body||'');
  if(Buffer.byteLength(raw)>MAX_BODY_BYTES)return {ok:false,response:json(413,{error:'payload_too_large'})};
  try{return {ok:true,value:JSON.parse(raw)}}catch{return {ok:false,response:json(400,{error:'invalid_json'})};}
}
