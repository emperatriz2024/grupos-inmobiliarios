// Minimal ZIP reader for WhatsApp exports. Supports stored (0) and deflate (8).
const u16 = (v, o) => v.getUint16(o, true);
const u32 = (v, o) => v.getUint32(o, true);

function findEOCD(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const min = Math.max(0, bytes.length - 0xffff - 22);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (u32(v, i) === 0x06054b50) return i;
  }
  throw new Error('ZIP inválido: no se encontró el directorio central.');
}

export function listZipEntries(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEOCD(bytes);
  const total = u16(v, eocd + 10);
  const cdOffset = u32(v, eocd + 16);
  const decoder = new TextDecoder('utf-8');
  const out = [];
  let p = cdOffset;
  for (let i = 0; i < total; i++) {
    if (u32(v, p) !== 0x02014b50) throw new Error('ZIP inválido: entrada central dañada.');
    const flags = u16(v, p + 8);
    const method = u16(v, p + 10);
    const compressedSize = u32(v, p + 20);
    const uncompressedSize = u32(v, p + 24);
    const nameLen = u16(v, p + 28);
    const extraLen = u16(v, p + 30);
    const commentLen = u16(v, p + 32);
    const localOffset = u32(v, p + 42);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    out.push({ name, flags, method, compressedSize, uncompressedSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

export async function extractZipEntry(bytes, entry) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const p = entry.localOffset;
  if (u32(v, p) !== 0x04034b50) throw new Error('ZIP inválido: cabecera local dañada.');
  const nameLen = u16(v, p + 26);
  const extraLen = u16(v, p + 28);
  const start = p + 30 + nameLen + extraLen;
  const compressed = bytes.subarray(start, start + entry.compressedSize);

  if (entry.method === 0) return compressed.slice();
  if (entry.method !== 8) throw new Error(`ZIP no compatible: método ${entry.method}.`);
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador no permite descomprimir ZIP localmente. Actualiza iOS/Safari.');
  }
  const stream = new Blob([compressed]).stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function extractWhatsAppChat(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = listZipEntries(bytes);
  const entry = entries.find(e => /(^|\/)_(chat|conversation)\.txt$/i.test(e.name))
    || entries.find(e => /\.txt$/i.test(e.name));
  if (!entry) throw new Error('El ZIP no contiene un archivo de chat .txt.');
  const raw = await extractZipEntry(bytes, entry);
  return { bytes: raw, entryName: entry.name, uncompressedSize: entry.uncompressedSize };
}

export function decodeChat(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = new Uint8Array(bytes.length - 2);
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      swapped[i - 2] = bytes[i + 1];
      swapped[i - 1] = bytes[i];
    }
    return new TextDecoder('utf-16le').decode(swapped);
  }

  const sample = bytes.subarray(0, Math.min(bytes.length, 400));
  let oddZero = 0, evenZero = 0;
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) (i % 2 ? oddZero++ : evenZero++);
  }
  if (oddZero > sample.length * 0.15) return new TextDecoder('utf-16le').decode(bytes);
  if (evenZero > sample.length * 0.15) {
    const swapped = new Uint8Array(bytes.length);
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      swapped[i] = bytes[i + 1];
      swapped[i + 1] = bytes[i];
    }
    return new TextDecoder('utf-16le').decode(swapped);
  }
  return new TextDecoder('utf-8').decode(bytes);
}
