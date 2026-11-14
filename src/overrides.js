/* Functional upgrades; original design and media controls are retained. */
function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function propertyPath(p){return DM_ROOT+p.path;}
function mostrarVista(id){if(!document.getElementById(id)){if(id==='vista-desarrollos')irAHome('desarrollos');return;}document.body.dataset.view=id==='vista-busqueda'?'search':id==='vista-detalle'?'detail':'home';document.querySelectorAll('.vista').forEach(v=>v.classList.toggle('activa',v.id===id));window.scrollTo(0,0);}
function irAHome(ancla){window.location.assign(DM_ROOT+(ancla?'#'+ancla:''));}
function irASeccion(id){irAHome(id);}
let catalogPromise;
async function cargarCache(){if(cacheCargado)return;if(!catalogPromise)catalogPromise=fetch(DM_ROOT+'data/properties.json').then(r=>{if(!r.ok)throw Error('catalog');return r.json();}).then(d=>{todasLasProps=d.properties;window.DM_DOLAR=Number(d.dolar?.valor)||0;cacheCargado=true;}).catch(e=>{catalogPromise=null;throw e;});return catalogPromise;}
function interpretarBusqueda(texto){return DMSearch.parse(texto,todasLasProps,'USD');}
async function navBuscar(){const text=document.getElementById('nav-search-input').value.trim();try{await cargarCache();aplicarNLP(text);}catch{mostrarToast('No pudimos cargar las propiedades. Intentá nuevamente.');}}
function aplicarNLP(texto,opFallback){const r=interpretarBusqueda(texto);Object.assign(S,{kw:r.resto,op:r.op||opFallback||'',ops:r.ops,tipos:r.tipos,ambs:r.ambs,rooms:r.rooms,barrios:r.barrios,barriosAmplios:!!r.barriosAmplios,ubic:[],tags:r.tags,excluded:r.excluded,barrioTipo:r.barrioTipo,desde:r.desde,hasta:r.hasta,moneda:r.moneda||'USD',code:r.code});document.getElementById('nav-search-input').value=texto;S.original=texto;syncInputs();renderChips();mostrarVista('vista-busqueda');history.pushState({search:true},'',DM_ROOT+'propiedades/?'+new URLSearchParams({q:texto}));cargarResultados();}
function syncInputs(){document.getElementById('busq-kw').value=S.kw;document.querySelectorAll('[name=f-op]').forEach(el=>el.checked=el.value===S.op);document.querySelectorAll('#filtro-tipos input').forEach(el=>el.checked=S.tipos.includes(el.value));document.querySelectorAll('[name=f-barrio-tipo]').forEach(el=>el.checked=el.value===S.barrioTipo);const preset=rangoDeEstado();document.getElementById('f-desde').value=preset?'':S.desde;document.getElementById('f-hasta').value=preset?'':S.hasta;document.getElementById('btn-usd').classList.toggle('activo',S.moneda==='USD');document.getElementById('btn-ars').classList.toggle('activo',S.moneda==='ARS');}
function abrirBuscador(kw='',options={}){Object.assign(S,{kw,original:kw,op:options.op||'',ops:[],tipos:options.tipos||[],desde:'',hasta:'',ambs:[],rooms:[],barrios:options.barrios||[],barriosAmplios:false,ubic:options.ubic||[],tags:[],excluded:[],barrioTipo:'',moneda:'USD',code:''});document.getElementById('nav-search-input').value=kw;syncInputs();renderChips();mostrarVista('vista-busqueda');history.pushState({search:true},'',DM_ROOT+'propiedades/');cargarResultados();}
function ejecutarBusqueda(){S.desde=document.getElementById('f-desde').value;S.hasta=document.getElementById('f-hasta').value;S.op=document.querySelector('[name=f-op]:checked')?.value||'';S.ops=[];S.tipos=[...document.querySelectorAll('#filtro-tipos input:checked')].map(el=>el.value);if(Number(S.desde)>Number(S.hasta)&&S.desde&&S.hasta){mostrarToast('El mínimo debe ser menor o igual al máximo.');return;}cargarResultados();}
function aplicarFiltrosSin(props,excluir=[]){return DMSearch.filter(props,S,excluir);}
function getPrecioProp(p){const offer=DMSearch.selectedOffer(p,{...S,desde:S.desde||'0'});return offer?Number(offer.price):null;}
function offerLabel(offer){return offer?.operation_type==='Sale'?'Venta':offer?.operation_type==='Temporary Rental'?'Alquiler temporal':offer?.operation_type==='Rent'?'Alquiler':'Consultar';}
function offerPrice(offer){return Number(offer?.price)>0?new Intl.NumberFormat('es-AR',{style:'currency',currency:offer.currency||'ARS',maximumFractionDigits:0}).format(Number(offer.price))+(offer.operation_type==='Rent'?'/mes':offer.operation_type==='Temporary Rental'?' · consultar período':''):'Consultar precio';}
// A property offered for sale and for rent shows both prices; the chosen operation goes first.
function renderOfertas(p,op){const offers=(p.operations||[]).flatMap(o=>(o.prices||[]).filter(pr=>Number(pr.price)>0).map(pr=>({...pr,operation_type:o.operation_type})));const main=(op?DMSearch.selectedOffer(p,{op}):null)||offers[0]||DMSearch.selectedOffer(p,{});const precio=document.getElementById('det-precio');if(precio)precio.textContent=offerPrice(main);const badge=document.getElementById('det-badge');if(badge){const label=offerLabel(main);badge.innerHTML=`<span class="det-tipo-badge ${/alquiler/i.test(label)?'alquiler':'venta'}">${escapeHTML(label==='Consultar'?offerLabel({operation_type:p.operations?.[0]?.operation_type}):label)}</span>`;}const others=offers.filter(o=>!main||o.operation_type!==main.operation_type);const extra=document.getElementById('det-precio-extra');if(extra){extra.innerHTML=others.map(o=>`<span><strong>${escapeHTML(offerLabel(o))}:</strong> ${escapeHTML(offerPrice(o))}</span>`).join('');extra.style.display=others.length?'':'none';}}
// Enlace corto de cada propiedad (dimartinoprop.com.ar/CODIGO) y mensaje de WhatsApp que lo usa.
function shortCode(p){return String(p.reference_code||p.id).trim().replace(/\s+/g,'-');}
function shortLink(p){const h=new URL(location.origin).host.replace(/^www\./,'');return h+DM_ROOT+shortCode(p);}
function waMessage(p){const lugar=[p.address,p.location?.name].filter(Boolean).join(', ');return 'Hola, quiero consultar por la propiedad'+(lugar?' de '+lugar:'')+':\n'+shortLink(p);}
function renderCard(p){const offer=DMSearch.selectedOffer(p,S),label=offerLabel(offer),title=(p.type?.label||tradTitulo(p))+(p.address?' | '+p.address:'');const photos=(p.photos||[]).slice(0,8);if(!photos.length)photos.push({image:DM_ROOT+'assets/property-placeholder.svg'});const m2=v=>Math.round(v).toLocaleString('es-AR');const surfaces=Number(p.roofed_surface)>0?`${m2(p.roofed_surface)} m² cubiertos`:Number(p.surface)>0?`${m2(p.surface)} m² de terreno`:Number(p.total_surface)>0?`${m2(p.total_surface)} m² totales`:'';const facts=[Number(p.suite_amount)>0?`${p.suite_amount} dorm.`:'',Number(p.bathroom_amount)>0?`${p.bathroom_amount} baño${Number(p.bathroom_amount)===1?"":"s"}`:'',surfaces].filter(Boolean).join(' · ');const path=propertyPath(p);const msg=waMessage(p);return `<article class="prop-card"><div class="prop-foto" data-idx="0"><a class="prop-foto-track" href="${path}">${photos.map((ph,i)=>`<img src="${escapeHTML(ph.image)}" alt="${escapeHTML(title+' en '+getUbic(p)+' · foto '+(i+1))}" width="640" height="440" loading="lazy" decoding="async">`).join('')}</a>${photos.length>1?`<button class="pf-prev" aria-label="Foto anterior" onclick="cardNav(this,-1)">‹</button><button class="pf-next" aria-label="Foto siguiente" onclick="cardNav(this,1)">›</button><span class="pf-count">1 / ${photos.length}</span>`:''}</div><div class="prop-body"><span class="prop-op-label">${escapeHTML(label)}</span><h3 class="prop-titulo"><a href="${path}">${escapeHTML(title)}</a></h3><div class="prop-precio-ml">${escapeHTML(offerPrice(offer))}</div><div class="prop-feats-ml">${escapeHTML(facts)}</div><div class="prop-ubicacion-ml">${escapeHTML(getUbic(p))}</div><a class="prop-wsp-card" href="https://wa.me/5492323678107?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener" aria-label="Consultar por WhatsApp"><svg width="20" height="20" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg><span>Consultar por WhatsApp</span></a></div></article>`;}
function abrirDetalle(id){const p=todasLasProps.find(p=>String(p.id)===String(id));window.location.assign(p?propertyPath(p):DM_ROOT+'dimartino_v2.html?prop='+encodeURIComponent(id));}
function renderChips(){const items=[];if(S.kw)items.push(['kw','',String.fromCharCode(34)+S.kw+String.fromCharCode(34)]);if(S.code)items.push(['code',S.code,'Código '+S.code]);if(S.ops?.length>1)items.push(['ops','','Venta o alquiler']);else if(S.op)items.push(['op','',NLP_OP_NOMBRE[S.op]]);for(const t of S.tipos)items.push(['tipo',t,NLP_TIPO_NOMBRE[t]||t]);for(const t of S.ambs)items.push(['amb',t,t==='4'?'4+ dormitorios':t+' dormitorios']);for(const t of S.rooms||[])items.push(['rooms',t,t+' ambientes']);for(const t of S.barrios)items.push(['barrio',t,t]);if(S.ubic?.length)items.push(['ubic','',ubicNombre(S.ubic,S.ubic.length-1)]);for(const t of S.tags)items.push(['tag',t,'Con '+t]);for(const t of S.excluded||[])items.push(['excluded',t,'Sin '+t]);if(S.barrioTipo)items.push(['barrioTipo','','Barrio '+S.barrioTipo]);const sym=S.moneda==='USD'?'US$':'$',preset=rangoDeEstado();if(preset)items.push(['rango','',preset.label]);else{if(Number(S.desde)>0)items.push(['desde','',`Desde ${sym} ${Number(S.desde).toLocaleString('es-AR')}`]);if(S.hasta)items.push(['hasta','',`Hasta ${sym} ${Number(S.hasta).toLocaleString('es-AR')}`]);}const bar=document.getElementById('nlp-bar');bar.replaceChildren();for(const [key,value,label]of items){const chip=document.createElement('span');chip.className='nlp-chip';chip.append(document.createTextNode(label));const b=document.createElement('button');b.type='button';b.textContent='×';b.setAttribute('aria-label','Quitar '+label);b.addEventListener('click',()=>quitarChip(key,value));chip.append(b);bar.append(chip);}bar.style.display=items.length?'flex':'none';const hint=document.getElementById('nlp-hint');hint.style.display=items.length?'block':'none';hint.textContent='';syncInputs();}
function quitarChip(key,val){const lists={tipo:'tipos',amb:'ambs',barrio:'barrios',tag:'tags',rooms:'rooms',excluded:'excluded'};if(lists[key])S[lists[key]]=S[lists[key]].filter(v=>v!==val);else if(key==='ops')S.ops=[];else if(key==='ubic')S.ubic=[];else if(key==='rango'){S.desde='';S.hasta='';}else S[key]='';if(key==='op')S.ops=[];cargarResultados();}
function limpiarFiltros(){abrirBuscador('',{});}
function setMoneda(m){S.moneda=m;S.desde='';S.hasta='';cargarResultados();}
function toggleDorm(v){S.ambs=S.ambs.includes(v)?S.ambs.filter(x=>x!==v):[...S.ambs,v];cargarResultados();}
function toggleBarrio(v){S.barriosAmplios=false;S.barrios=S.barrios.includes(v)?S.barrios.filter(x=>x!==v):[...S.barrios,v];cargarResultados();}
function setBarrioTipo(v){S.barrioTipo=v;cargarResultados();}
function textoConteo(n){return n===1?'1 propiedad encontrada':n.toLocaleString('es-AR')+' propiedades encontradas';}
function rangosActuales(props=todasLasProps){if(S.moneda==='USD')return RANGOS_USD;const rent=S.op==='2'||S.op==='3'||!(props||[]).some(p=>{const o=DMSearch.selectedOffer(p,{...S,desde:'',hasta:''});return o&&o.currency==='ARS'&&o.operation_type==='Sale';});return rent?RANGOS_ARS_ALQ:RANGOS_ARS;}
function rangoDesde(r){return r.desde>0?String(r.desde+1):'';}
function rangoActivo(r){return S.desde===rangoDesde(r)&&S.hasta===(r.hasta===null?'':String(r.hasta));}
function rangoDeEstado(){return [...RANGOS_USD,...RANGOS_ARS,...RANGOS_ARS_ALQ].find(r=>(S.desde||S.hasta)&&rangoActivo(r)&&((S.moneda==='USD')===RANGOS_USD.includes(r)));}
function setRangoPrecio(from,to){const r={desde:from,hasta:to};const same=rangoActivo(r);S.desde=same?'':rangoDesde(r);S.hasta=same||to===null?'':String(to);cargarResultados();}
function sortFiltered(){const order=document.getElementById('res-orden').value;if(order)propsFiltradas.sort((a,b)=>{const x=DMSearch.selectedOffer(a,S),y=DMSearch.selectedOffer(b,S);if(!x)return 1;if(!y)return -1;// Sales first, then rentals. Pesos are compared in dollars at the MEP rate published with the catalog
// (official if MEP was not available); without a rate, each currency is sorted on its own.
const rate=window.DM_DOLAR||0,group=o=>(o.operation_type==='Sale'?0:2)+(rate||o.currency===(S.moneda||'USD')?0:1),usd=o=>o.currency==='ARS'&&rate?Number(o.price)/rate:Number(o.price);if(group(x)!==group(y))return group(x)-group(y);return order==='asc'?usd(x)-usd(y):usd(y)-usd(x);});}
function ordenarResultados(){sortFiltered();document.getElementById('busq-grid').innerHTML=propsFiltradas.slice(0,propsMostradas||PPP).map(renderCard).join('');}
function persistFilters(){const data={op:S.op,tipos:S.tipos.join(','),desde:S.desde,hasta:S.hasta,ambs:S.ambs.join(','),rooms:(S.rooms||[]).join(','),barrios:S.barrios.join('|'),ubic:(S.ubic||[]).join('>'),amplio:S.barriosAmplios&&S.barrios.length?'1':'',tags:S.tags.join(','),excluded:(S.excluded||[]).join(','),barrioTipo:S.barrioTipo,moneda:S.moneda,kw:S.kw,code:S.code,ops:(S.ops||[]).join(',')};const params=new URLSearchParams(Object.entries(data).filter(([,v])=>v));history.replaceState({search:true},'',DM_ROOT+'propiedades/?'+params);document.title='Buscar propiedades en Luján | Di Martino Propiedades';}
async function cargarResultados(){document.querySelector('.pagination')?.setAttribute('hidden','');const token=++reqToken;estaCargando=true;try{await cargarCache();if(token!==reqToken)return;propsFiltradas=aplicarFiltros(todasLasProps);sortFiltered();ultimasProps=propsFiltradas;propsMostradas=Math.min(PPP,propsFiltradas.length);hayMas=propsMostradas<propsFiltradas.length;renderChips();actualizarOpcionesDinamicas();const grid=document.getElementById('busq-grid');grid.innerHTML=propsFiltradas.slice(0,PPP).map(renderCard).join('');grid.style.display=mapaVisible?'none':'grid';document.getElementById('res-count').textContent=textoConteo(propsFiltradas.length);const empty=document.getElementById('busq-vacio');empty.style.display=propsFiltradas.length?'none':'block';renderEmptySearch(empty);if(mapaLeaflet)actualizarMapaMarcadores(propsFiltradas);persistFilters();}catch{document.getElementById('busq-vacio').style.display='block';document.getElementById('busq-vacio').textContent='No pudimos cargar el catálogo. Recargá la página o consultanos por WhatsApp.';}finally{estaCargando=false;}}
function corregirBusqueda(text){const r=interpretarBusqueda(text);S.kw=r.resto;if(r.ops.length){S.op=r.op||'';S.ops=r.ops;}if(r.tipos.length)S.tipos=r.tipos;if(r.barrios.length){S.barrios=r.barrios;S.barriosAmplios=true;}document.getElementById('nav-search-input').value=text;cargarResultados();}
function renderEmptySearch(empty){
  empty.innerHTML='<h3>Sin resultados</h3><p>'+escapeHTML(S.kw?'No encontramos propiedades para “'+S.kw+'” con estos filtros.':'No encontramos propiedades con esta combinación de filtros.')+'</p>';
  const suggestion=S.kw&&DMSearch.suggest(S.kw,todasLasProps);
  if(suggestion){const button=document.createElement('button');button.type='button';button.className='search-recovery';button.textContent='¿Quisiste buscar “'+suggestion+'”?';button.addEventListener('click',()=>corregirBusqueda(suggestion));empty.append(button);}
  const all=document.createElement('a');all.className='search-recovery';all.href=DM_ROOT+'propiedades/';all.textContent='Ver todas las propiedades';empty.append(all);
}
function setupMarkerPreview(marker){
  const openPreview=()=>marker.openPopup();
  if(window.matchMedia('(any-hover: hover)').matches)marker.on('mouseover',openPreview);
  const pin=marker.getElement();
  pin?.addEventListener('focus',()=>{if(pin.matches(':focus-visible'))openPreview();});
}
function actualizarMapaMarcadores(props){
  if(!mapaLeaflet)return;
  mapaLeaflet.eachLayer(layer=>{if(layer instanceof L.Marker)mapaLeaflet.removeLayer(layer);});
  const valid=props.filter(p=>Number.isFinite(Number(p.geo_lat))&&Number.isFinite(Number(p.geo_long))&&Math.abs(Number(p.geo_lat))<=90&&Math.abs(Number(p.geo_long))<=180&&Number(p.geo_lat)!==0&&Number(p.geo_long)!==0);
  const icon=L.divIcon({className:'dm-map-marker',iconSize:[30,42],iconAnchor:[15,42],popupAnchor:[0,-36],html:'<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42" aria-hidden="true"><path d="M15 40C12 35 2 23 2 15a13 13 0 1 1 26 0c0 8-10 20-13 25Z" fill="#D3282F" stroke="white" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="white"/></svg>'});
  for(const p of valid){
    const title=(p.type?.label||tradTitulo(p))+(p.address?' | '+p.address:'');
    const price=offerPrice(DMSearch.selectedOffer(p,S));
    const href=DMNavigation.resultURL(propertyPath(p),location.pathname+location.search,DM_ROOT,S.op);
    const marker=L.marker([Number(p.geo_lat),Number(p.geo_long)],{icon,title,alt:title,keyboard:true}).addTo(mapaLeaflet);
    marker.bindPopup(`<a class="map-property" href="${escapeHTML(href)}"><img src="${escapeHTML(getFoto(p))}" alt="${escapeHTML(title)}" width="220" height="120" loading="lazy"><strong>${escapeHTML(title)}</strong><span class="map-property-price">${escapeHTML(price)}</span><span>${escapeHTML(getUbic(p))}</span><span class="map-property-link">Ver propiedad →</span></a>`);
    marker.getElement()?.setAttribute('aria-label',title);
    setupMarkerPreview(marker);
  }
  if(valid.length)mapaLeaflet.fitBounds(L.latLngBounds(valid.map(p=>[Number(p.geo_lat),Number(p.geo_long)])),{padding:[40,40],maxZoom:16});
}

function enviarForm(btn,tipoForm){
  const container=btn.closest('.det-card, .formulario');const fields=[...container.querySelectorAll('input,textarea,select')].filter(el=>el.name!=='website');
  let valid=true;for(const el of fields){el.required=el.name==='from_name'||el.name==='from_phone';if(!el.checkValidity()){el.reportValidity();valid=false;break;}}if(!valid)return;
  const estado=container.querySelector('.form-estado');const val=n=>(container.querySelector(`[name="${n}"]`)?.value||'').trim();
  const url=document.querySelector('link[rel=canonical]')?.href||location.href;const prop=(typeof galProp!=='undefined'&&galProp&&document.getElementById('property-data'))?galProp.id:'';
  const extra=fields.filter(el=>!['from_name','from_phone','from_email','message'].includes(el.name)&&el.value.trim()).map(el=>(el.previousElementSibling?.textContent||el.name)+': '+el.value.trim());
  const mensaje=[val('message'),...extra].filter(Boolean).join('\n');
  const whatsapp=()=>{const lines=fields.filter(el=>el.name&&el.value.trim()).map(el=>(el.previousElementSibling?.textContent||el.name)+': '+el.value.trim());window.open('https://wa.me/5492323678107?text='+encodeURIComponent([tipoForm||'Consulta',...lines,url].join('\n')),'_blank','noopener');};
  // Without the domain's own server (preview), the inquiry continues on WhatsApp.
  if(typeof DM_CONTACT_URL==='undefined'||!DM_CONTACT_URL){whatsapp();return;}
  btn.disabled=true;const label=btn.textContent;btn.textContent='Enviando…';if(estado)estado.textContent='';
  fetch(DM_CONTACT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({oficina:!!(typeof window!=='undefined'&&window.DM_OFICINA),nombre:val('from_name'),telefono:val('from_phone'),email:val('from_email'),mensaje,tipo:tipoForm||'Consulta',propiedad:prop,url,website:container.querySelector('[name=website]')?.value||''})})
    .then(r=>r.ok?r.json():Promise.reject()).then(r=>{if(!r.ok)throw 0;fields.forEach(el=>{if(el.id!=='det-msg')el.value='';});btn.textContent='Consulta enviada';window.dmTrack&&window.dmTrack('consulta_enviada',{formulario:tipoForm||'Consulta'});if(estado)estado.textContent='Gracias. Te vamos a contactar a la brevedad.';})
    .catch(()=>{btn.disabled=false;btn.textContent=label;if(estado)estado.textContent='No pudimos enviar la consulta. Probá de nuevo o escribinos por WhatsApp.';});
}
function suggestions(){const input=document.getElementById('nav-search-input'),list=document.getElementById('search-suggestions');if(!list)return;input.addEventListener('input',async()=>{await cargarCache().catch(()=>{});const q=DMSearch.norm(input.value);const values=[...new Set(['Casa en venta','Departamento en alquiler','Terreno en Jáuregui','Casa con pileta',...todasLasProps.map(p=>p.location?.name).filter(Boolean),...todasLasProps.map(p=>p.reference_code).filter(Boolean)])];list.replaceChildren(...values.filter(v=>DMSearch.norm(v).includes(q)).slice(0,10).map(v=>{const opt=document.createElement('option');opt.value=v;return opt;}));});}
function restoreSearchFilters(params){for(const k of ['op','desde','hasta','barrioTipo','moneda','kw','code'])if(params.has(k))S[k]=params.get(k);for(const k of ['tipos','ambs','rooms','tags','excluded','ops'])if(params.has(k))S[k]=(params.get(k)||'').split(',').filter(Boolean);if(params.has('ubic'))S.ubic=(params.get('ubic')||'').split('>').filter(Boolean);if(params.has('barrios')){S.barrios=(params.get('barrios')||'').split('|').filter(Boolean);if(params.get('amplio')==='1')S.barriosAmplios=true;}}
function prepareResultNavigation(event){
  if(document.body.dataset.view!=='search')return;
  const link=event.target.closest('#busq-grid a[href]');if(!link)return;
  const url=new URL(link.href,location.origin);if(url.origin!==location.origin||!url.pathname.startsWith(DM_ROOT+'propiedades/')||!/^\d+\/$/.test(url.pathname.slice((DM_ROOT+'propiedades/').length)))return;
  link.href=DMNavigation.resultURL(url.pathname,location.pathname+location.search,DM_ROOT,S.op);
}
function setupPropertyTrail(property){
  const nav=document.querySelector('.det-breadcrumb');if(!nav)return;
  const params=new URLSearchParams(location.search),from=DMNavigation.safeReturn(params.get('from'),DM_ROOT);
  let op=params.get('op')||'';if(from){const u=new URL(from,location.origin);op=u.searchParams.get('op')||(/alquileres-lujan/.test(u.pathname)?'2':op);}
  nav.replaceChildren();for(const item of DMNavigation.trail(property,DM_ROOT,op)){const a=document.createElement('a');a.href=item.href;a.textContent=item.name;nav.append(a);const separator=document.createElement('span');separator.textContent='›';separator.setAttribute('aria-hidden','true');nav.append(separator);}
  const current=document.createElement('span');current.textContent=property.address||property.type.label;current.setAttribute('aria-current','page');nav.append(current);
  if(from){const back=document.createElement('a');back.className='search-return';back.href=from;back.textContent='← Volver a mi búsqueda';nav.before(back);}
}
function initUpgrade(){const development=document.getElementById('development-data');if(development){galProp=JSON.parse(development.textContent);galFotos=galProp.photos.map(p=>p.image);galIdx=0;}const json=document.getElementById('property-data');if(json){galProp=JSON.parse(json.textContent);galFotos=(galProp.photos||[]).map(p=>p.image);if(!galFotos.length)galFotos=[DM_ROOT+'assets/property-placeholder.svg'];galIdx=0;const op=new URLSearchParams(location.search).get('op');if(op)renderOfertas(galProp,op);document.getElementById('det-msg').value='Hola, me interesa '+(galProp.type?.id===1?'el terreno':'la propiedad')+' de '+(galProp.address||galProp.location?.name||'')+' (código '+(galProp.reference_code||galProp.id)+'). ¿Me pasan más información?';}
if(json)setupPropertyTrail(galProp);
const legacy=new URLSearchParams(location.search).get('prop');if(location.pathname.endsWith('/dimartino_v2.html')&&!legacy){location.replace(DM_ROOT);return;}if(legacy&&/^\d+$/.test(legacy)){fetch(DM_ROOT+'data/routes.json').then(r=>r.json()).then(routes=>{if(routes[legacy])location.replace(DM_ROOT+routes[legacy]);else location.replace(DM_ROOT+'404.html');});return;}
if(document.body.dataset.view==='search'){cargarCache().then(()=>{Object.assign(S,JSON.parse(document.body.dataset.initialFilters||'{}'));propsFiltradas=aplicarFiltros(todasLasProps);ultimasProps=propsFiltradas;propsMostradas=document.querySelectorAll('#busq-grid .prop-card').length;renderChips();actualizarOpcionesDinamicas();const p=new URLSearchParams(location.search);if(p.has('q')){document.getElementById('nav-search-input').value=p.get('q');aplicarNLP(p.get('q'));return;}restoreSearchFilters(p);document.getElementById('nav-search-input').value=S.kw||'';if(p.size)cargarResultados();});}
document.addEventListener('pointerdown',prepareResultNavigation,true);document.addEventListener('click',prepareResultNavigation,true);
suggestions();const menu=document.getElementById('menu-toggle');menu?.addEventListener('click',()=>{const expanded=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!expanded));document.querySelector('.nav-links').classList.toggle('mobile-open',!expanded);});initMobileFilters();initHomeFeatured();
document.querySelectorAll('.galeria-main,.lightbox').forEach(el=>{let x=0;el.addEventListener('touchstart',e=>x=e.changedTouches[0].screenX,{passive:true});el.addEventListener('touchend',e=>{const dx=e.changedTouches[0].screenX-x;if(Math.abs(dx)>55){if(el.classList.contains('lightbox'))lbNav(dx<0?1:-1);else galNav(dx<0?1:-1);}},{passive:true});});
document.addEventListener('keydown',e=>{const lb=document.getElementById('lightbox');if(e.key==='Tab'&&lb.classList.contains('open')){const controls=[...lb.querySelectorAll('button,a,[tabindex]')].filter(n=>n.getAttribute('tabindex')!=='-1'&&n.getClientRects().length);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){last?.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first?.focus();e.preventDefault();}}});
window.addEventListener('popstate',()=>location.reload());
setupScrollInfinito();}

// Compartir: en celulares abre el menú nativo del teléfono; en la compu, un menú con WhatsApp, Facebook, email y copiar enlace.
function compartir(){
  const url=document.querySelector('link[rel=canonical]')?.href||location.href.split('?')[0];
  const title=(document.getElementById('det-titulo')?.textContent||document.title).trim();
  const touch=window.matchMedia&&window.matchMedia('(pointer:coarse)').matches;
  if(touch&&navigator.share){window.dmTrack&&window.dmTrack('compartir',{medio:'menú del celular'});navigator.share({title,text:title,url}).catch(()=>{});return;}
  const old=document.getElementById('share-menu');if(old){old.remove();return;}
  const enc=encodeURIComponent,text=title+' '+url;
  const items=[['WhatsApp','https://wa.me/?text='+enc(text)],['Facebook','https://www.facebook.com/sharer/sharer.php?u='+enc(url)],['Email','mailto:?subject='+enc(title)+'&body='+enc(text)]];
  const menu=document.createElement('div');menu.id='share-menu';menu.className='share-menu';menu.setAttribute('role','menu');
  menu.innerHTML=items.map(([n,h])=>`<a role="menuitem" href="${h}" target="_blank" rel="noopener">${n}</a>`).join('')+'<button type="button" role="menuitem" data-copy>Copiar enlace</button>';
  menu.querySelector('[data-copy]').onclick=()=>{window.dmTrack&&window.dmTrack('compartir',{medio:'copiar enlace'});(navigator.clipboard?.writeText(url)||Promise.reject()).then(()=>mostrarToast('Enlace copiado')).catch(()=>mostrarToast('Copiá la dirección desde la barra del navegador'));menu.remove();};
  menu.addEventListener('click',e=>{if(e.target.closest('a'))menu.remove();});
  document.querySelector('.galeria-compartir').append(menu);
  setTimeout(()=>document.addEventListener('click',function close(e){if(!e.target.closest('.galeria-compartir')){menu.remove();document.removeEventListener('click',close);}}),0);
}

// Ubicación paso a paso, como en los portales: sin nada elegido se ven los partidos; al elegir uno, sus localidades;
// al elegir una localidad, sus barrios. Cada número cuenta lo que hay con los demás filtros puestos.
function lugarLindo(v){return String(v||'').replace(/\s*\((?:lujan|luján)\)\s*$/i,'').replace(/^Jauregui Jose Maria$/i,'Jáuregui').replace(/\bLujan\b/g,'Luján').replace(/\bJauregui\b/g,'Jáuregui').replace(/\bHosteria\b/g,'Hostería').replace(/\bConcepcion\b/g,'Concepción').replace(/\bAsuncion\b/gi,'Asunción').replace(/^La asunción$/,'La Asunción').replace(/\bExaltacion\b/g,'Exaltación').replace(/ De /g,' de ').replace(/ Del /g,' del ').replace(/ La /g,' la ').trim();}
function ubicNombre(path,i){const v=path[i];if(i===1&&/countries|b\.?\s*cerrado/i.test(v))return 'Barrios cerrados';if(i===1&&DMSearch.norm(v)===DMSearch.norm(path[0]))return 'Ciudad de '+lugarLindo(v);return lugarLindo(v);}
function setUbic(path){S.ubic=path;S.barrios=[];S.barriosAmplios=false;cargarResultados();}
function renderUbicacion(){
  const box=document.getElementById('filtro-ubic');if(!box)return;
  const path=S.ubic||[],pool=aplicarFiltrosSin(todasLasProps,['ubic']);
  const counts=new Map();for(const p of pool){const lv=DMSearch.levels(p);if(!path.every((v,i)=>DMSearch.norm(lv[i])===DMSearch.norm(v)))continue;const next=lv[path.length];if(next)counts.set(next,(counts.get(next)||0)+1);}
  const isCity=v=>path.length===1&&DMSearch.norm(v)===DMSearch.norm(path[0]),isClosed=v=>path.length===1&&/countries|b\.?\s*cerrado/i.test(v);
  const options=[...counts].sort((a,b)=>(isCity(b[0])-isCity(a[0]))||(isClosed(a[0])-isClosed(b[0]))||b[1]-a[1]||a[0].localeCompare(b[0]));
  box.replaceChildren();
  if(path.length){const trail=document.createElement('div');trail.className='ubic-ruta';
    path.forEach((_,i)=>{const chip=document.createElement('button');chip.type='button';chip.className='ubic-sel';chip.innerHTML=escapeHTML(ubicNombre(path,i))+'<span aria-hidden="true">×</span>';chip.setAttribute('aria-label','Quitar '+ubicNombre(path,i));chip.addEventListener('click',()=>setUbic(path.slice(0,i)));trail.append(chip);});
    box.append(trail);}
  if(options.length){const ul=document.createElement('ul');ul.className='ubic-lista';
    const many=options.length>8;
    options.forEach(([v,n],i)=>{const li=document.createElement('li');if(many&&i>=7)li.hidden=true;const b=document.createElement('button');b.type='button';b.innerHTML=escapeHTML(ubicNombre([...path,v],path.length))+' <span class="ubic-n">('+n+')</span>';b.addEventListener('click',()=>setUbic([...path,v]));li.append(b);ul.append(li);});
    box.append(ul);
    if(many){const more=document.createElement('button');more.type='button';more.className='ubic-mas';more.textContent='Ver todos ('+options.length+')';more.addEventListener('click',()=>{ul.querySelectorAll('li[hidden]').forEach(li=>li.hidden=false);more.remove();});box.append(more);}}
  document.getElementById('filtro-ubic-grupo').style.display=(path.length||options.length)?'':'none';
}

// Saltar a una sección de la portada (Desarrollos, Tasaciones, Contacto...). Las fotos de arriba terminan de cargar
// después del salto y empujan la sección hacia abajo, así que se vuelve a ubicar unas veces, salvo que el visitante ya esté moviendo la página.
function irAAncla(id){const el=document.getElementById(id);if(!el)return false;let stop=false;const cancel=()=>{stop=true;};addEventListener('wheel',cancel,{once:true,passive:true});addEventListener('touchstart',cancel,{once:true,passive:true});addEventListener('keydown',cancel,{once:true});const go=()=>{if(!stop)el.scrollIntoView({block:'start'});};go();for(const t of [250,700,1400,2500])setTimeout(go,t);if(document.readyState!=='complete')addEventListener('load',go,{once:true});return true;}
if(typeof document!=='undefined'&&typeof location!=='undefined'&&typeof location.hash==='string'&&!(typeof window!=='undefined'&&window.DM_BUILD)){
document.addEventListener('click',e=>{const a=e.target.closest('a[href*="#"]');if(!a||e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey)return;const u=new URL(a.href,location.href);if(u.origin!==location.origin||u.pathname!==location.pathname||!u.hash)return;if(irAAncla(decodeURIComponent(u.hash.slice(1)))){e.preventDefault();history.replaceState(history.state,'',u.hash);document.querySelector('.nav-links')?.classList.remove('mobile-open');}});
if(location.hash.length>1)irAAncla(decodeURIComponent(location.hash.slice(1)));
}
// Cada clic en un botón de WhatsApp avisa al servidor (que avisa por Telegram). No frena ni demora la apertura de WhatsApp.
if(typeof document!=="undefined")document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href*="wa.me/"]');if(!a||typeof DM_CONTACT_URL==='undefined'||!DM_CONTACT_URL||!navigator.sendBeacon)return;let texto='';try{texto=new URL(a.href).searchParams.get('text')||'';}catch{}// En una ficha, "Desde" va con el enlace corto (ej. dimartinoprop.com.ar/1038); si el mensaje ya lo trae, no se repite.
let desde=location.href;try{const el=document.getElementById('property-data');if(el){const corto=shortLink(JSON.parse(el.textContent));desde=texto.includes(corto)?'':'https://'+corto;}}catch{}
try{navigator.sendBeacon(DM_CONTACT_URL,JSON.stringify({evento:'whatsapp',texto:texto||'Botón de WhatsApp general',url:desde,oficina:!!window.DM_OFICINA}));}catch{}},true);
// Filtros en celular: el botón dice si abre u oculta, y al abrir aparece abajo una barra fija "Ver N propiedades" para aplicar y volver al listado.
function initMobileFilters(){const toggle=document.getElementById('filters-toggle'),sidebar=document.querySelector('.filtros-sidebar'),count=document.getElementById('res-count');if(!toggle||!sidebar)return;
  const bar=document.createElement('div');bar.className='filters-apply';bar.hidden=true;bar.innerHTML='<button type="button"></button>';document.body.append(bar);const apply=bar.firstChild;
  const sync=()=>{const open=sidebar.classList.contains('filters-open');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Ocultar filtros ▲':'Filtros ▼';bar.hidden=!open;const n=parseInt((count?.textContent||'').replace(/\D/g,''),10)||0;apply.textContent=n?'Ver '+n.toLocaleString('es-AR')+(n===1?' propiedad':' propiedades'):'Sin resultados: cambiá los filtros';};
  toggle.addEventListener('click',()=>{sidebar.classList.toggle('filters-open');sync();});
  apply.addEventListener('click',()=>{sidebar.classList.remove('filters-open');sync();toggle.scrollIntoView({block:'start'});window.scrollBy(0,-120);});
  if(count&&typeof MutationObserver!=='undefined')new MutationObserver(sync).observe(count,{childList:true,characterData:true,subtree:true});sync();}
// Portada: las destacadas se mezclan en cada visita (se muestran 6).
function initHomeFeatured(){const grid=document.getElementById('home-grid');if(!grid||grid.children.length<2)return;const cards=[...grid.children];for(let i=cards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}grid.append(...cards);}
