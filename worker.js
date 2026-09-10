import { extractWhatsAppChat, decodeChat } from './zip-reader.js?v=0783';
import { processChatText } from './engine.js?v=0783';

self.onmessage = async (e) => {
  const { bytes, fileName, group, locationCatalog } = e.data;
  let phase='unzip';
  try {
    postMessage({ type: 'status', step: 'zip', text: 'Abriendo ZIP…' });
    const extracted = await extractWhatsAppChat({name:fileName,arrayBuffer:async()=>bytes});

    phase='parse';
    postMessage({
      type: 'status',
      step: 'decode',
      text: 'Leyendo chat…',
      bytes: extracted.uncompressedSize
    });
    const text = decodeChat(extracted.bytes);

    phase='process';
    postMessage({
      type: 'status',
      step: 'process',
      text: 'Detectando propiedades…'
    });
    const result = processChatText(text, group, {
      maxAgeDays:60,now:Date.now(),locationCatalog,
      onProgress:progress=>postMessage({type:'status',step:'process_progress',text:'Detectando propiedades…',...progress})
    });

    postMessage({
      type: 'done',
      result,
      entryName: extracted.entryName
    });
  } catch (error) {
    postMessage({
      type: 'error',
      name: error?.name || 'Error',
      message: error?.message || String(error),
      phase
    });
  }
};
