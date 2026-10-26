import fs from 'node:fs/promises';
import path from 'node:path';
const clean=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const https=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
export function normalizeDevelopment(d){
  const photos=(d.photos||[]).map(p=>({image:https(p.image||p.original),description:clean(p.description),cover:!!(p.is_front_cover||p.cover)})).filter(p=>p.image).sort((a,b)=>Number(b.cover)-Number(a.cover));
  return {id:Number(d.id),name:clean(d.name||d.publication_title),address:clean(d.fake_address||d.address),location:{name:clean(d.location?.name)},type:{code:clean(d.type?.code),label:({BA:'Barrio abierto',BU:'Edificio'})[d.type?.code]||'Desarrollo'},description:clean(d.description),photos,path:'desarrollos/'+Number(d.id)+'/'};
}
export async function loadDevelopments(root,key){
  const file=path.join(root,'data/developments.json');
  if(!key)return JSON.parse(await fs.readFile(file,'utf8'));
  const rows=[];let offset=0,total=Infinity;
  while(offset<total){
    const endpoint=new URL('https://tokkobroker.com/api/v1/development/');endpoint.search=new URLSearchParams({key,format:'json',limit:'100',offset:String(offset)});
    let response;
    for(let attempt=0;attempt<3;attempt++){try{response=await fetch(endpoint,{signal:AbortSignal.timeout(30000)});if(response.ok)break;}catch{}if(attempt===2)throw Error('No se pudieron actualizar los desarrollos; se conserva la publicación anterior.');}
    const page=await response.json(),items=page.objects||page.results;
    if(!Array.isArray(items))throw Error('Respuesta inválida de desarrollos.');
    total=Number(page.meta?.total_count??page.count??items.length);if(!items.length&&offset<total)throw Error('Desarrollos incompletos.');
    rows.push(...items);offset+=items.length;if(offset>10000)throw Error('Límite de desarrollos excedido.');
  }
  const snapshot={generatedAt:new Date().toISOString(),developments:rows.filter(d=>d.display_on_web===true).map(normalizeDevelopment).filter(d=>d.id&&d.name)};
  await fs.writeFile(file,JSON.stringify(snapshot));return snapshot;
}
