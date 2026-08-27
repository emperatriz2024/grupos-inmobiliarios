let lastMs=0,lastSequence=0;
const hex=bytes=>[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');

export function uuidV7({now=Date.now(),cryptoImpl=globalThis.crypto}={}){
  if(!cryptoImpl?.getRandomValues)throw new Error('secure_random_unavailable');
  const ms=Math.max(Number(now),lastMs);lastSequence=ms===lastMs?(lastSequence+1)&0xfff:0;lastMs=ms;
  const bytes=new Uint8Array(16);cryptoImpl.getRandomValues(bytes);
  const time=BigInt(ms);for(let index=5;index>=0;index--){bytes[index]=Number(time>>BigInt((5-index)*8)&255n);}
  bytes[6]=0x70|((lastSequence>>8)&0x0f);bytes[7]=lastSequence&0xff;bytes[8]=0x80|(bytes[8]&0x3f);
  const value=hex(bytes);return `${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`;
}

export async function sha256(value,cryptoImpl=globalThis.crypto){
  if(!cryptoImpl?.subtle)throw new Error('sha256_unavailable');
  const data=typeof value==='string'?new TextEncoder().encode(value):value;
  return hex(new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',data)));
}
