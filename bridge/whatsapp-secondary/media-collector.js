import {createHash} from 'node:crypto';

export const MAX_MEDIA_CHUNK_BYTES=3_500_000;
export async function downloadMessageMedia(message,{thumbnailer=null}={}){
  if(!message?.hasMedia||typeof message.downloadMedia!=='function')return null;
  const media=await message.downloadMedia();if(!media?.data)return null;
  const bytes=Buffer.from(media.data,'base64'),sha256=createHash('sha256').update(bytes).digest('hex'),mimeType=media.mimetype||'application/octet-stream',filename=media.filename||`${message.id?._serialized||sha256}.${mimeType.split('/')[1]?.split(';')[0]||'bin'}`;
  const chunks=[];for(let offset=0;offset<bytes.length;offset+=MAX_MEDIA_CHUNK_BYTES)chunks.push(bytes.subarray(offset,offset+MAX_MEDIA_CHUNK_BYTES).toString('base64'));
  const thumbnail=thumbnailer&&mimeType.startsWith('image/')?await thumbnailer(bytes,mimeType):null;
  return {sha256,mimeType,filename,sizeBytes:bytes.length,chunks,thumbnail:thumbnail?Buffer.from(thumbnail).toString('base64'):null};
}
