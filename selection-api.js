const endpoint='/api/selections';

async function request(path='',options={}){
  const response=await fetch(`${endpoint}${path}`,options);
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
  return data;
}

export function publishSelection(payload,adminToken){
  if(!adminToken)throw new Error('Introduce la credencial de publicación.');
  return request('',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${adminToken}`},body:JSON.stringify(payload)});
}

export function updatePublishedSelection(slug,payload,adminToken){
  if(!adminToken)throw new Error('Introduce la credencial de publicación.');
  return request(`/${encodeURIComponent(slug)}`,{method:'PUT',headers:{'content-type':'application/json',authorization:`Bearer ${adminToken}`},body:JSON.stringify(payload)});
}

export function disablePublishedSelection(slug,adminToken){
  if(!adminToken)throw new Error('Introduce la credencial de publicación.');
  return request(`/${encodeURIComponent(slug)}`,{method:'DELETE',headers:{authorization:`Bearer ${adminToken}`}});
}

export function getPublicSelection(slug){return request(`/${encodeURIComponent(slug)}`);}
