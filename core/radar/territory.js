export const TERRITORY_TYPES=Object.freeze(['country','state','municipality','macrozone','zone_family','zone','subzone','urbanization','complex','landmark']);
export const normalizeTerritory=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export class TerritoryOntology{
  constructor({territories=[],aliases=[],closure=[]}={}){this.territories=territories;this.aliases=aliases;this.closure=closure;}
  resolve(query){
    const normalized=normalizeTerritory(query),alias=this.aliases.find(item=>item.normalized_alias===normalized);
    return this.territories.find(item=>item.id===(alias?.territory_id||''))||this.territories.find(item=>normalizeTerritory(item.name)===normalized)||null;
  }
  descendants(id,{includeSelf=true}={}){
    const ids=new Set(this.closure.filter(item=>item.ancestor_id===id&&(includeSelf||item.depth>0)).map(item=>item.descendant_id));
    return this.territories.filter(item=>ids.has(item.id));
  }
  expand(query){const resolved=this.resolve(query);return resolved?this.descendants(resolved.id):[];}
}

export function trigalTerritorySeed(workspace_id='00000000-0000-7000-8000-000000000001'){
  const rows=[
    ['ve','country','Venezuela',null],['carabobo','state','Carabobo','ve'],['valencia','municipality','Valencia','carabobo'],
    ['valencia-norte','macrozone','Valencia Norte','valencia'],['familia-trigal','zone_family','Familia Trigal','valencia-norte'],
    ['el-trigal','zone','El Trigal','familia-trigal'],['trigal-norte','subzone','Trigal Norte','el-trigal'],
    ['trigal-centro','subzone','Trigal Centro','el-trigal'],['trigal-sur','subzone','Trigal Sur','el-trigal']
  ];
  const territories=rows.map(([id,type,name,parent_id])=>({id,workspace_id,type,name,parent_id,canonical_slug:id,country_code:'VE',active:true}));
  const byId=new Map(territories.map(row=>[row.id,row])),closure=[];
  for(const row of territories){closure.push({ancestor_id:row.id,descendant_id:row.id,depth:0});let parent=byId.get(row.parent_id),depth=1;while(parent){closure.push({ancestor_id:parent.id,descendant_id:row.id,depth:depth++});parent=byId.get(parent.parent_id);}}
  const aliases=[{territory_id:'familia-trigal',alias:'Trigal',normalized_alias:'trigal'}];
  return {territories,aliases,closure};
}
