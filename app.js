import {
  mergeProperties,
  addImport,
  getStats,
  getRecentImports,
  clearDatabase
} from './db.js';

const $ = (q) => document.querySelector(q);
const fileInput = $('#zipInput');
const importBtn = $('#importBtn');
const resetBtn = $('#resetBtn');
const statusBox = $('#statusBox');
const progress = $('#progress');
const resultBox = $('#resultBox');
let selectedFile = null;

function prettySize(n = 0) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#039;'
  }[c]));
}

function groupFromName(name = '') {
  return name
    .replace(/\.zip$/i, '')
    .replace(/^WhatsApp Chat\s*-?\s*/i, '')
    .trim() || 'Grupo inmobiliario';
}

function setStatus(text, pct = null) {
  statusBox.hidden = false;
  $('#statusText').textContent = text;
  if (pct == null) progress.removeAttribute('value');
  else {
    progress.value = pct;
    progress.max = 100;
  }
}

fileInput.addEventListener('change', () => {
  selectedFile = fileInput.files?.[0] || null;
  if (!selectedFile) return;

  $('#fileName').textContent = selectedFile.name;
  $('#fileMeta').textContent = `${prettySize(selectedFile.size)} · listo para procesar`;
  $('#fileCard').hidden = false;
  importBtn.disabled = false;
  resultBox.hidden = true;
});

importBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  importBtn.disabled = true;
  fileInput.disabled = true;
  resultBox.hidden = true;
  setStatus('Preparando importación…');

  const worker = new Worker('./worker.js', { type: 'module' });
  const group = groupFromName(selectedFile.name);

  worker.onmessage = async (e) => {
    const m = e.data;

    if (m.type === 'status') {
      const map = { zip: 12, decode: 28, process: 48 };
      setStatus(
        m.bytes ? `${m.text} ${prettySize(m.bytes)}` : m.text,
        map[m.step] ?? null
      );
      return;
    }

    if (m.type === 'error') {
      setStatus(`Error: ${m.message}`, 0);
      importBtn.disabled = false;
      fileInput.disabled = false;
      worker.terminate();
      return;
    }

    if (m.type === 'done') {
      setStatus(
        `Guardando ${m.result.unique.length.toLocaleString('es-VE')} publicaciones únicas…`,
        60
      );

      const saved = await mergeProperties(
        m.result.unique,
        (done, total) => setStatus(
          `Guardando base local… ${done.toLocaleString('es-VE')} / ${total.toLocaleString('es-VE')}`,
          60 + Math.round((done / Math.max(total, 1)) * 35)
        )
      );

      const summary = {
        group,
        file_name: selectedFile.name,
        chat_file: m.entryName,
        messages: m.result.messages,
        detected: m.result.properties_detected,
        unique: m.result.unique.length,
        added: saved.added,
        updated: saved.updated
      };

      await addImport(summary);
      setStatus('Importación completada', 100);

      resultBox.innerHTML = `
        <div class="successMark">✓</div>
        <h3>Importación completada</h3>
        <div class="summaryGrid">
          <div><b>${summary.messages.toLocaleString('es-VE')}</b><span>mensajes</span></div>
          <div><b>${summary.detected.toLocaleString('es-VE')}</b><span>publicaciones</span></div>
          <div><b>${summary.unique.toLocaleString('es-VE')}</b><span>textos únicos</span></div>
          <div><b>${summary.added.toLocaleString('es-VE')}</b><span>nuevas en base</span></div>
        </div>`;

      resultBox.hidden = false;
      importBtn.disabled = false;
      fileInput.disabled = false;
      worker.terminate();
      await refreshDashboard();
    }
  };

  worker.postMessage({ file: selectedFile, group });
});

async function refreshDashboard() {
  const s = await getStats();
  $('#propertyCount').textContent = s.properties.toLocaleString('es-VE');
  $('#importCount').textContent = s.imports.toLocaleString('es-VE');

  const recent = await getRecentImports();
  $('#recent').innerHTML = recent.length
    ? recent.map(r => `
      <div class="recentItem">
        <div>
          <b>${esc(r.group)}</b>
          <small>${new Date(r.imported_at).toLocaleString('es-VE')}</small>
        </div>
        <span>+${Number(r.added || 0).toLocaleString('es-VE')}</span>
      </div>`).join('')
    : '<p class="muted">Aún no has importado grupos.</p>';
}

resetBtn.addEventListener('click', async () => {
  if (!confirm('¿Eliminar toda la base local y el historial de importaciones de este dispositivo?')) return;
  await clearDatabase();
  await refreshDashboard();
  resultBox.hidden = true;
  statusBox.hidden = true;
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

refreshDashboard();
