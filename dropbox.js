
const AUTH = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN = 'https://api.dropboxapi.com/oauth2/token';
const API = 'https://api.dropboxapi.com/2';
const CONTENT = 'https://content.dropboxapi.com/2';

const K = {
  appKey: 'gi_dropbox_app_key',
  refresh: 'gi_dropbox_refresh_token',
  access: 'gi_dropbox_access_token',
  expires: 'gi_dropbox_access_expires',
  verifier: 'gi_dropbox_pkce_verifier',
  state: 'gi_dropbox_oauth_state',
  pending: 'gi_dropbox_pending_path',
  processed: 'gi_dropbox_processed_path'
};

function b64url(bytes) {
  let s = '';
  bytes.forEach(b => s += String.fromCharCode(b));
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function randomString(n=64) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}
async function sha256(s) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}
export function redirectUri() {
  return location.origin + location.pathname;
}
export function getDropboxSettings() {
  return {
    appKey: localStorage.getItem(K.appKey) || 'rsyovq93iej48hn',
    pendingPath: localStorage.getItem(K.pending) || '/CHAT_PENDIENTES',
    processedPath: localStorage.getItem(K.processed) || '/CHAT_PROCESADOS',
    contactsPath: '/CONTACTOS',
    contactsProcessedPath: '/CONTACTOS_PROCESADOS',
    connected: !!localStorage.getItem(K.refresh)
  };
}
export function saveDropboxSettings({appKey,pendingPath,processedPath}) {
  if (appKey != null) localStorage.setItem(K.appKey, String(appKey).trim());
  if (pendingPath != null) localStorage.setItem(K.pending, normalizePath(pendingPath));
  if (processedPath != null) localStorage.setItem(K.processed, normalizePath(processedPath));
}
export function disconnectDropbox() {
  [K.refresh,K.access,K.expires,K.verifier,K.state].forEach(k=>localStorage.removeItem(k));
}
export function normalizePath(p='') {
  p = String(p).trim();
  if (!p || p === '/') return '';
  if (!p.startsWith('/')) p = '/' + p;
  return p.replace(/\/+/g,'/').replace(/\/$/,'');
}
export async function startDropboxOAuth() {
  const {appKey} = getDropboxSettings();
  if (!appKey) throw new Error('Primero guarda tu Dropbox App Key.');
  const verifier = randomString(64);
  const challenge = b64url(await sha256(verifier));
  const state = randomString(24);
  localStorage.setItem(K.verifier, verifier);
  localStorage.setItem(K.state, state);

  const u = new URL(AUTH);
  u.searchParams.set('client_id', appKey);
  u.searchParams.set('response_type','code');
  u.searchParams.set('redirect_uri', redirectUri());
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method','S256');
  u.searchParams.set('token_access_type','offline');
  u.searchParams.set('state', state);
  u.searchParams.set('scope','files.metadata.read files.content.read files.content.write');
  location.href = u.toString();
}
async function saveTokenResponse(data) {
  if (data.access_token) localStorage.setItem(K.access, data.access_token);
  if (data.refresh_token) localStorage.setItem(K.refresh, data.refresh_token);
  if (data.expires_in) localStorage.setItem(K.expires, String(Date.now() + (Number(data.expires_in)-60)*1000));
}
export async function finishDropboxOAuthIfPresent() {
  const u = new URL(location.href);
  const code = u.searchParams.get('code');
  const returnedState = u.searchParams.get('state');
  const error = u.searchParams.get('error_description') || u.searchParams.get('error');
  if (error) {
    history.replaceState({},'',redirectUri());
    throw new Error(`Dropbox: ${error}`);
  }
  if (!code) return false;

  const appKey = localStorage.getItem(K.appKey);
  const verifier = localStorage.getItem(K.verifier);
  const expectedState = localStorage.getItem(K.state);
  if (!appKey || !verifier) throw new Error('Falta el estado de conexión de Dropbox. Intenta conectar de nuevo.');
  if (!returnedState || returnedState !== expectedState) throw new Error('La validación de seguridad de Dropbox no coincide.');

  const body = new URLSearchParams({
    code,
    grant_type:'authorization_code',
    client_id:appKey,
    code_verifier:verifier,
    redirect_uri:redirectUri()
  });
  const r = await fetch(TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  const data = await r.json();
  if (!r.ok) throw new Error(data.error_description || data.error || 'No se pudo completar la conexión con Dropbox.');
  await saveTokenResponse(data);
  localStorage.removeItem(K.verifier); localStorage.removeItem(K.state);
  history.replaceState({},'',redirectUri());
  return true;
}
async function refreshToken() {
  const appKey = localStorage.getItem(K.appKey);
  const refresh = localStorage.getItem(K.refresh);
  if (!appKey || !refresh) throw new Error('Dropbox no está conectado.');
  const body = new URLSearchParams({
    grant_type:'refresh_token',
    refresh_token:refresh,
    client_id:appKey
  });
  const r = await fetch(TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  const data = await r.json();
  if (!r.ok) throw new Error(data.error_description || data.error || 'No se pudo renovar la sesión de Dropbox.');
  await saveTokenResponse(data);
  return data.access_token;
}
export async function getAccessToken() {
  const access = localStorage.getItem(K.access);
  const expires = Number(localStorage.getItem(K.expires) || 0);
  if (access && expires > Date.now()) return access;
  return refreshToken();
}
async function api(path, body={}) {
  const token = await getAccessToken();
  let r = await fetch(API+path,{
    method:'POST',
    headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  if (r.status === 401) {
    const fresh = await refreshToken();
    r = await fetch(API+path,{
      method:'POST',
      headers:{'Authorization':`Bearer ${fresh}`,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
  }
  const data = await r.json().catch(()=>({}));
  if (!r.ok) {
    const msg = data?.error_summary || data?.error?.['.tag'] || `Dropbox API ${r.status}`;
    throw new Error(msg);
  }
  return data;
}
export async function listDropboxFolder(path) {
  path = normalizePath(path);
  let data = await api('/files/list_folder',{path,recursive:false,include_deleted:false,include_non_downloadable_files:false});
  const entries = [...(data.entries||[])];
  while (data.has_more) {
    data = await api('/files/list_folder/continue',{cursor:data.cursor});
    entries.push(...(data.entries||[]));
  }
  return entries;
}
export async function listPendingZips(path) {
  const entries = await listDropboxFolder(path);
  return entries.filter(e=>e['.tag']==='file' && /\.zip$/i.test(e.name))
    .sort((a,b)=>String(b.server_modified||'').localeCompare(String(a.server_modified||'')));
}
export async function downloadDropboxFile(path) {
  const token = await getAccessToken();
  let r = await fetch(CONTENT+'/files/download',{
    method:'POST',
    headers:{
      'Authorization':`Bearer ${token}`,
      'Dropbox-API-Arg':JSON.stringify({path})
    }
  });
  if (r.status === 401) {
    const fresh = await refreshToken();
    r = await fetch(CONTENT+'/files/download',{
      method:'POST',
      headers:{'Authorization':`Bearer ${fresh}`,'Dropbox-API-Arg':JSON.stringify({path})}
    });
  }
  if (!r.ok) throw new Error(`No pude descargar ${path} desde Dropbox.`);
  return await r.blob();
}

export async function uploadDropboxFileOverwrite(path,blob) {
  path = normalizePath(path);
  const token = await getAccessToken();

  const doUpload = async(authToken) => fetch(CONTENT+'/files/upload',{
    method:'POST',
    headers:{
      'Authorization':`Bearer ${authToken}`,
      'Content-Type':'application/octet-stream',
      'Dropbox-API-Arg':JSON.stringify({
        path,
        mode:'overwrite',
        autorename:false,
        mute:true,
        strict_conflict:false
      })
    },
    body:blob
  });

  let r=await doUpload(token);
  if(r.status===401){
    const fresh=await refreshToken();
    r=await doUpload(fresh);
  }
  const data=await r.json().catch(()=>({}));
  if(!r.ok){
    const msg=data?.error_summary||data?.error?.['.tag']||`Dropbox upload ${r.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function deleteDropboxFile(path) {
  path = normalizePath(path);
  try{
    return await api('/files/delete_v2',{path});
  }catch(e){
    // If the file was already removed, the desired final state is already achieved.
    const msg=String(e.message||'');
    if(msg.includes('not_found')||msg.includes('path/not_found')) return {already_deleted:true};
    throw e;
  }
}

export async function archiveLatestDropboxFile(sourcePath,toFolder,fileName,blob) {
  sourcePath=normalizePath(sourcePath);
  toFolder=normalizePath(toFolder);
  await ensureDropboxFolder(toFolder);

  const targetPath=`${toFolder}/${fileName}`.replace(/\/+/g,'/');

  // 1) Save the new export as the canonical/current copy in PROCESADOS.
  // Dropbox overwrites the previous copy of this same group silently.
  await uploadDropboxFileOverwrite(targetPath,blob);

  // 2) Only after the processed copy exists, remove the pending source.
  // Therefore a failure before this line leaves the source available for retry.
  await deleteDropboxFile(sourcePath);

  return {source_path:sourcePath,target_path:targetPath,replaced:true};
}

export async function ensureDropboxFolder(path) {
  path = normalizePath(path);
  if (!path) return;
  try { await api('/files/create_folder_v2',{path,autorename:false}); }
  catch(e) {
    if (!String(e.message).includes('conflict')) throw e;
  }
}
export async function moveDropboxFile(fromPath,toFolder,fileName) {
  fromPath = normalizePath(fromPath);
  toFolder = normalizePath(toFolder);
  await ensureDropboxFolder(toFolder);
  const toPath = `${toFolder}/${fileName}`.replace(/\/+/g,'/');
  return api('/files/move_v2',{
    from_path:fromPath,
    to_path:toPath,
    allow_shared_folder:true,
    autorename:true,
    allow_ownership_transfer:false
  });
}

export async function listDropboxContactFiles(path){
  const e=await listDropboxFolder(path);
  return e.filter(x=>x['.tag']==='file'&&/\.(?:vcf|vcard|csv|tsv|txt|json|zip)$/i.test(x.name)).sort((a,b)=>String(b.server_modified||'').localeCompare(String(a.server_modified||'')));
}
