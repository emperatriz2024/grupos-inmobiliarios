import { extractWhatsAppChat, decodeChat } from './zip-reader.js?v=0410';
import { processChatText } from './engine.js?v=0410';

self.onmessage = async (e) => {
  const { file, group } = e.data;
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
    const result = processChatText(text, group, { maxAgeDays: 60, now: Date.now() });

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
