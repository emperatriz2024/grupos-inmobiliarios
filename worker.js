import { extractWhatsAppChat, decodeChat } from './zip-reader.js?v=0522';
import { processChatText } from './engine.js?v=0522';

self.onmessage = async (e) => {
  const { file, group, locationCatalog } = e.data;
  try {
    postMessage({ type: 'status', step: 'zip', text: 'Abriendo ZIP…' });
    const extracted = await extractWhatsAppChat(file);

    postMessage({
      type: 'status',
      step: 'decode',
      text: 'Leyendo chat…',
      bytes: extracted.uncompressedSize
    });
    const text = decodeChat(extracted.bytes);

    postMessage({
      type: 'status',
      step: 'process',
      text: 'Detectando propiedades…'
    });
    const result = processChatText(text, group, { maxAgeDays: 60, now: Date.now(), locationCatalog });

    postMessage({
      type: 'done',
      result,
      entryName: extracted.entryName
    });
  } catch (error) {
    postMessage({
      type: 'error',
      message: error?.message || String(error)
    });
  }
};
