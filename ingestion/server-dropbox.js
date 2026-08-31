const API='https://api.dropboxapi.com/2',CONTENT='https://content.dropboxapi.com/2',TOKEN='https://api.dropboxapi.com/oauth2/token';
const normalizePath=value=>{let path=String(value||'').trim();if(!path||path==='/')return '';if(!path.startsWith('/'))path=`/${path}`;return path.replace(/\/+/g,'/').replace(/\/$/,'');};

export function createServerDropbox({env=process.env,fetchImpl=fetch}={}){
  let access=null,expires=0;
  async function token(){
    if(access&&expires>Date.now())return access;
    const appKey=env.RADAR_DROPBOX_APP_KEY,refreshToken=env.RADAR_DROPBOX_REFRESH_TOKEN;
    if(!appKey||!refreshToken)throw new Error('server_dropbox_not_configured');
    const response=await fetchImpl(TOKEN,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:refreshToken,client_id:appKey})});
    const data=await response.json().catch(()=>({}));if(!response.ok||!data.access_token)throw new Error('server_dropbox_auth_failed');
    access=data.access_token;expires=Date.now()+(Math.max(60,Number(data.expires_in)||3600)-60)*1000;return access;
  }
  async function api(path,body){const response=await fetchImpl(`${API}${path}`,{method:'POST',headers:{authorization:`Bearer ${await token()}`,'content-type':'application/json'},body:JSON.stringify(body)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`dropbox_${response.status}`);return data;}
  return {
    async listPending(path=env.RADAR_DROPBOX_PENDING_PATH||'/CHAT_PENDIENTES'){
      let page=await api('/files/list_folder',{path:normalizePath(path),recursive:false,include_deleted:false,include_non_downloadable_files:false}),entries=[...(page.entries||[])];
      while(page.has_more){page=await api('/files/list_folder/continue',{cursor:page.cursor});entries.push(...page.entries||[]);}
      return entries.filter(row=>row['.tag']==='file'&&/\.zip$/i.test(row.name)).sort((a,b)=>String(a.server_modified||'').localeCompare(String(b.server_modified||'')));
    },
    async download(path){const response=await fetchImpl(`${CONTENT}/files/download`,{method:'POST',headers:{authorization:`Bearer ${await token()}`,'dropbox-api-arg':JSON.stringify({path:normalizePath(path)})}});if(!response.ok)throw new Error(`dropbox_download_${response.status}`);return new Uint8Array(await response.arrayBuffer());},
    async move(fromPath,fileName,toFolder=env.RADAR_DROPBOX_PROCESSED_PATH||'/CHAT_PROCESADOS'){
      const folder=normalizePath(toFolder);try{await api('/files/create_folder_v2',{path:folder,autorename:false});}catch(error){if(!String(error.message).includes('409'))throw error;}
      return api('/files/move_v2',{from_path:normalizePath(fromPath),to_path:`${folder}/${fileName}`.replace(/\/+/g,'/'),autorename:true,allow_shared_folder:true,allow_ownership_transfer:false});
    }
  };
}
