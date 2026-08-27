import {sha256,uuidV7} from './ids.js';

export const MEDIA_RIGHTS=Object.freeze(['OWNED','AUTHORIZED','INTERNAL_ONLY','SOURCE_LINK_ONLY','UNKNOWN']);
export const PUBLIC_MEDIA_RIGHTS=new Set(['OWNED','AUTHORIZED']);
const bitCount=n=>{let count=0;for(;n;n>>>=1)count+=n&1;return count;};

// dHash over a caller-supplied 9x8 grayscale sample. Decode/resize remains an adapter concern.
export function differenceHash(gray,width=9,height=8){
  if(!gray||gray.length<width*height||width<2)throw new Error('invalid_grayscale_sample');
  let bits='';for(let y=0;y<height;y++)for(let x=0;x<width-1;x++)bits+=Number(gray[y*width+x])>Number(gray[y*width+x+1])?'1':'0';
  return bits.match(/.{1,4}/g).map(chunk=>parseInt(chunk.padEnd(4,'0'),2).toString(16)).join('');
}
export function perceptualDistance(a,b){if(!a||!b||a.length!==b.length)return Infinity;let total=0;for(let i=0;i<a.length;i++)total+=bitCount(parseInt(a[i],16)^parseInt(b[i],16));return total;}

export class MediaFoundation{
  constructor({workspaceId,storage,id=()=>uuidV7(),cryptoImpl=globalThis.crypto,clock=Date.now,eventSink=()=>{}}={}){this.workspaceId=workspaceId;this.storage=storage;this.id=id;this.crypto=cryptoImpl;this.clock=clock;this.eventSink=eventSink;this.attachments=new Map();this.assets=new Map();this.assetsByHash=new Map();this.propertyMedia=new Map();}
  emit(event_type,aggregate_id,payload={}){this.eventSink({event_type,aggregate_id,payload_json:structuredClone(payload),occurred_at:new Date(this.clock()).toISOString()});}
  receiveAttachment(input){const at=new Date(this.clock()).toISOString(),row={id:input.id||this.id(),workspace_id:this.workspaceId,source_message_id:input.source_message_id,external_media_id:input.external_media_id||null,media_type:input.media_type||'UNKNOWN',mime_type:input.mime_type||null,original_filename:input.original_filename||null,size_bytes:input.size_bytes??null,width:input.width??null,height:input.height??null,duration_ms:input.duration_ms??null,sha256:input.sha256||null,storage_locator:input.storage_locator||null,media_status:input.media_status||'OBSERVED',received_at:input.received_at||at,ingested_at:at,metadata_json:structuredClone(input.metadata_json||{}),created_at:at};this.attachments.set(row.id,row);this.emit('SOURCE_ATTACHMENT_RECEIVED',row.id,{source_message_id:row.source_message_id,media_status:row.media_status});return row;}
  async ingestBytes(attachmentId,bytes,{phash=null,media_role='UNKNOWN',rights_status='UNKNOWN',metadata={}}={}){
    const attachment=this.attachments.get(attachmentId);if(!attachment)throw new Error('attachment_not_found');if(!MEDIA_RIGHTS.includes(rights_status))throw new Error('invalid_media_rights');
    const hash=await sha256(bytes,this.crypto),key=`${this.workspaceId}:${hash}`;let asset=this.assets.get(this.assetsByHash.get(key)),deduplicated=Boolean(asset);
    if(!asset){const at=new Date(this.clock()).toISOString();asset={id:this.id(),workspace_id:this.workspaceId,sha256:hash,phash,mime_type:attachment.mime_type,storage_key:`media/${hash}`,width:attachment.width,height:attachment.height,duration_ms:attachment.duration_ms,rights_status,quality_score:null,media_role,created_at:at,updated_at:at};await this.storage.put(asset.storage_key,bytes,{sha256:hash,...metadata});this.assets.set(asset.id,asset);this.assetsByHash.set(key,asset.id);this.emit('MEDIA_ASSET_CREATED',asset.id,{sha256:hash,source_attachment_id:attachmentId});}
    else this.emit('MEDIA_DEDUPLICATED',asset.id,{sha256:hash,source_attachment_id:attachmentId});
    Object.assign(attachment,{sha256:hash,storage_locator:asset.storage_key,media_status:'STORED'});return {attachment,asset,deduplicated};
  }
  markFailed(attachmentId,status='FAILED'){const row=this.attachments.get(attachmentId);if(!row)throw new Error('attachment_not_found');row.media_status=status;return row;}
  linkProperty({property_id,media_asset_id,source_attachment_id=null,relation_type='SOURCE_MEDIA',relation_confidence=null,client_allowed=false,is_primary=false,sort_order=null,linked_by=null}){
    const asset=this.assets.get(media_asset_id);if(!asset)throw new Error('media_asset_not_found');if(client_allowed&&!PUBLIC_MEDIA_RIGHTS.has(asset.rights_status))throw new Error('media_rights_do_not_allow_public_use');
    const row={id:this.id(),workspace_id:this.workspaceId,property_id,media_asset_id,source_attachment_id,relation_type,relation_confidence,client_allowed:Boolean(client_allowed),is_primary:Boolean(is_primary),sort_order,linked_at:new Date(this.clock()).toISOString(),linked_by};this.propertyMedia.set(row.id,row);this.emit('PROPERTY_MEDIA_LINKED',property_id,{media_asset_id,source_attachment_id,relation_type});return row;
  }
  provenance(mediaAssetId){return [...this.propertyMedia.values()].filter(x=>x.media_asset_id===mediaAssetId).map(link=>({link,attachment:link.source_attachment_id?this.attachments.get(link.source_attachment_id)||null:null,asset:this.assets.get(mediaAssetId)||null}));}
}
