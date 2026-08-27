export class MediaStorageAdapter{
  async put(){throw new Error('not_implemented');}
  async exists(){throw new Error('not_implemented');}
  async getMetadata(){throw new Error('not_implemented');}
  async get(){throw new Error('not_implemented');}
  async delete(){throw new Error('delete_requires_explicit_implementation');}
}

export class InMemoryMediaStorage extends MediaStorageAdapter{
  constructor(){super();this.items=new Map();}
  async put(key,bytes,metadata={}){const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);this.items.set(key,{data:new Uint8Array(data),metadata:structuredClone(metadata)});return {key,size:data.byteLength};}
  async exists(key){return this.items.has(key);}
  async getMetadata(key){const item=this.items.get(key);return item?{...structuredClone(item.metadata),size:item.data.byteLength}:null;}
  async get(key){const item=this.items.get(key);return item?new Uint8Array(item.data):null;}
  async delete(key,{confirmed=false}={}){if(!confirmed)throw new Error('media_delete_confirmation_required');return this.items.delete(key);}
}
