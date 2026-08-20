const MAX_ENTRIES=100;
const entries=[];
function redact(value){return String(value??'').replace(/(?:access|refresh|bearer|token)[=: ]+[^\s,;]+/gi,'$1=[REDACTED]').slice(0,800);}
export function diagnosticLog(module,operation,message,level='error'){
  const row={module:redact(module),operation:redact(operation),timestamp:new Date().toISOString(),message:redact(message),level};
  entries.push(row);if(entries.length>MAX_ENTRIES)entries.splice(0,entries.length-MAX_ENTRIES);
  if(level==='error'&&globalThis.console?.error)console.error(`[Radar:${row.module}] ${row.operation}: ${row.message}`);
  return row;
}
export function getDiagnostics(){return entries.map(x=>({...x}));}
export function clearDiagnostics(){entries.length=0;}
