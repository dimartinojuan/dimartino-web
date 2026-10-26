(function(root) {
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9$\s.,]/g, ' ').replace(/\s+/g, ' ').trim();
  const types = {casa:'3',casas:'3',chalet:'3',chalets:'3',casita:'3',departamento:'2',departamentos:'2',depto:'2',dpto:'2',dto:'2',apartamento:'2',apto:'2',quinta:'4',quintas:'4',chacra:'4',terreno:'1',terrenos:'1',lote:'1',lotes:'1',loteo:'1',local:'7',locales:'7',oficina:'5',oficinas:'5',consultorio:'30',cochera:'10',cocheras:'10',garage:'10',garaje:'10',galpon:'24',galpones:'24',deposito:'14',campo:'9',campos:'9',haras:'29',establecimiento:'18',ph:'13',monoambiente:'31',mono:'31',studio:'31',hotel:'11',hoteles:'11'};
  Object.assign(types,{chalecito:'3',dept:'2',dpt:'2',apt:'2',negocio:'7',comercio:'7'});
  const ops = {venta:'1',vender:'1',comprar:'1',compra:'1',compro:'1',alquiler:'2',alquilar:'2',alquilo:'2',alquileres:'2',alq:'2',renta:'2',arrendar:'2',alquier:'2',alqiluer:'2',temporal:'3',temporario:'3',temporada:'3',vacacional:'3',turismo:'3'};
  const features = {pileta:['pileta','piscina','pool','swimming pool'],cochera:['cochera','garage','garaje','parking'],parrilla:['parrilla','barbecue','grill','asador'],quincho:['quincho'],jardin:['jardin','garden'],patio:['patio'],seguridad:['seguridad','security','vigilancia'],ascensor:['ascensor','elevator'],calefaccion:['calefaccion','heating']};
  function distance(a,b) { const d=Array.from({length:a.length+1},(_,i)=>[i]);for(let j=0;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]!==b[j-1]));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);}return d[a.length][b.length]; }
  function fuzzy(word, dict) {if(dict[word])return dict[word];if(word.length<4)return null;const hits=Object.entries(dict).filter(([k])=>Math.abs(k.length-word.length)<=1&&distance(word,k)<=1);const values=[...new Set(hits.map(([,v])=>v))];return values.length===1?values[0]:null;}
  function parse(text, properties=[], defaultCurrency='USD') {
    let q=norm(text), original=q;
    const r={op:null,ops:[],tipos:[],ambs:[],rooms:[],barrios:[],tags:[],excluded:[],barrioTipo:'',desde:'',hasta:'',moneda:null,resto:'',code:''};
    const nums={un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10};
    const exact=properties.find(p=>norm(p.reference_code)===q||String(p.id)===q);
    if(exact){r.code=String(exact.id);return r;}
    q=q.replace(/\b(hasta|desde)\s*(?:usd|ars|us\$|u\$s|\$)?\s*(\d[\d.,]*)\s*(millones|millon|mil|k|m\b)?(?:\s*(usd|ars|dolares|pesos))?/g,(_,dir,num,suf,currency)=>{let v=Number(num.replace(/[.,](?=\d{3}(?:\D|$))/g,'').replace(',','.'));if(suf==='k'||suf==='mil')v*=1000;if(['millones','millon','m'].includes(suf))v*=1e6;if(Number.isFinite(v))r[dir]=String(Math.round(v));if(currency)r.moneda=/ars|pesos/.test(currency)?'ARS':'USD';return ' ';});
    q=q.replace(/\b(\d[\d.,]*)\s*(k|mil|millones|millon)\b/g,(_,num,suf)=>{let v=Number(num.replace(/[.,](?=\d{3}(?:\D|$))/g,'').replace(',','.'))*(suf.startsWith('millon')?1e6:1000);if(!r.hasta&&!r.desde)r.hasta=String(Math.round(v));return ' ';});
    if(/\busd\b|\bdolar(?:es)?\b|us\$|u\$s/.test(original))r.moneda='USD';else if(/\bars\b|\bpesos?\b/.test(original)||original.includes('$'))r.moneda='ARS';
    q=q.replace(/\b(?:usd|ars|dolares|dolar|pesos|peso)\b|us\$|u\$s|\$/g,' ');
    q=q.replace(/\b(\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(dormitorios?|dorms?|habitaciones?|cuartos?|piezas?|ambientes?|amb)\b/g,(_,n,unit)=>{const v=nums[n]||Number(n);const key=/^amb/.test(unit)?'rooms':'ambs';r[key]=[String(v>=4&&key==='ambs'?4:v)];return ' ';});
    // Consume contextual amenities before standalone property types.
    q=q.replace(/\b(con|sin)\s+(?:la\s+|el\s+)?(pileta|piscina|pool|cochera|garage|garaje|parrilla|asador|quincho|jardin|patio|seguridad|vigilancia|ascensor|calefaccion)\b/g,(_,polarity,word)=>{const key=Object.keys(features).find(k=>features[k].includes(word));(polarity==='sin'?r.excluded:r.tags).push(key||word);return ' ';});
    q=q.replace(/\b(barrio cerrado|barrio privado|country|countries|b cerrado|barrio abierto)\b/g,m=>{r.barrioTipo=m==='barrio abierto'?'abierto':'cerrado';return ' ';});
    let tokens=q.split(/\s+/).filter(Boolean);
    const blocked=new Set(['en','de','la','el','los','las','un','una','con','por','para','del','al','y','o','a','quiero','busco','necesito']);
    tokens=tokens.filter(t=>{if(blocked.has(t))return false;const op=ops[t]||(!types[t]?fuzzy(t,ops):null);if(op){if(!r.ops.includes(op))r.ops.push(op);return false;}return true;});
    if(r.ops.length===1)r.op=r.ops[0];
    tokens=tokens.filter(t=>{const type=fuzzy(t,types);if(type){if(!r.tipos.includes(type))r.tipos.push(type);return false;}return true;});
    q=tokens.join(' ');
    const locations=[...new Set(properties.map(p=>p.location?.name).filter(Boolean))];
    for(const loc of locations.sort((a,b)=>b.length-a.length)){
      const variants=[norm(loc),...(/jauregui/.test(norm(loc))?['jauregui','jose maria jauregui']:[])];
      for(const candidate of variants){const re=new RegExp('(^|\\s)'+candidate.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=\\s|$)','g');if(re.test(q)){r.barrios.push(loc);q=q.replace(re,' ');break;}}
    }
    if(!r.barrios.length&&q){const matches=locations.filter(loc=>distance(q,norm(loc))<=1&&q.length>=5);if(matches.length===1){r.barrios=matches;q='';}}
    r.resto=q.replace(/\s+/g,' ').trim();return r;
  }
  function searchable(p){return norm([p.title,p.description,p.short_description,p.address,p.reference_code,p.id,p.type?.name,p.type?.label,p.location?.name,p.location?.full_location,p.location?.parent_location?.name,...(p.tags||[]).map(t=>t.name),...(p.custom_tags||[]).map(t=>t.name)].filter(Boolean).join(' '));}
  function selectedOffer(p,state={}) {const wanted=state.ops?.length?state.ops:(state.op?[state.op]:[]);const names={'1':'Sale','2':'Rent','3':'Temporary Rental'};const operations=(p.operations||[]).filter(o=>!wanted.length||wanted.some(id=>o.operation_type===names[id]||(id==='2'&&o.operation_type==='Temporary Rental')));let offers=operations.flatMap(o=>(o.prices||[]).map(pr=>({...pr,operation_type:o.operation_type})));if(state.moneda){const matched=offers.filter(o=>o.currency===state.moneda);if(matched.length)return matched[0];if(state.desde||state.hasta)return null;}return offers[0]||null;}
  function filter(properties,state,exclude=[]) {return properties.filter(p=>{
    if(state.code&&String(p.id)!==state.code)return false;
    const wanted=state.ops?.length?state.ops:(state.op?[state.op]:[]);
    if(!exclude.includes('op')&&wanted.length&&!selectedOffer(p,{op:state.op,ops:state.ops}))return false;
    if(!exclude.includes('tipos')&&state.tipos?.length&&!state.tipos.includes(String(p.type?.id)))return false;
    if(!exclude.includes('precio')&&(state.desde||state.hasta)){const offer=selectedOffer(p,state);if(!offer||!Number(offer.price)||Number(offer.price)<Number(state.desde||0)||(state.hasta&&Number(offer.price)>Number(state.hasta)))return false;}
    if(!exclude.includes('ambs')&&state.ambs?.length&&!state.ambs.some(v=>v==='4'?Number(p.suite_amount)>=4:Number(p.suite_amount)===Number(v)))return false;
    if(state.rooms?.length&&!state.rooms.some(v=>Number(p.room_amount)===Number(v)))return false;
    if(!exclude.includes('barrios')&&state.barrios?.length&&!state.barrios.some(v=>norm(v)===norm(p.location?.name)))return false;
    const hay=searchable(p);
    if(!exclude.includes('barrioTipo')&&state.barrioTipo){const closed=/countries|country|b\.cerrado|cerrado|privado/.test(norm(p.location?.full_location));if((state.barrioTipo==='cerrado')!==closed)return false;}
    const hasFeature=tag=>{if(tag==='cochera'&&(Number(p.garage_amount)>0||Number(p.parking_lot_amount)>0))return true;return (features[tag]||[tag]).some(t=>hay.includes(norm(t)));};
    if(!exclude.includes('tags')&&state.tags?.some(t=>!hasFeature(t)))return false;
    if(state.excluded?.some(hasFeature))return false;
    if(!exclude.includes('kw')&&state.kw&&!norm(state.kw).split(/\s+/).every(w=>hay.includes(w)))return false;
    return true;
  });}
  root.DMSearch={norm,parse,filter,selectedOffer,distance,searchable};
})(globalThis);
