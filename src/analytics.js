// Estadísticas propias (invisibles para el visitante, sin cookies ni datos personales y sin efecto en el SEO): cada página avisa
// a contacto.php qué propiedad se vio, de dónde vino la visita y, al salir, cuánto tiempo estuvo y qué miró (fotos, recorrido 360,
// video, planos, mapa, descripción, compartir, teléfono). Con eso el servidor arma el resumen diario por Telegram.
// Los equipos de la oficina se marcan UNA vez abriendo dimartinoprop.com.ar/?oficina y desde entonces no cuentan (ni en Analytics). Para deshacerlo: ?oficina=no
(function(){
  try{const p=new URLSearchParams(location.search);if(p.has('oficina')){const no=p.get('oficina')==='no';if(no)localStorage.removeItem('dm-oficina');else localStorage.setItem('dm-oficina','si');
    p.delete('oficina');history.replaceState(null,'',location.pathname+(p.size?'?'+p:'')+location.hash);
    const d=document.createElement('div');d.className='oficina-aviso';d.setAttribute('role','status');d.textContent=no?'Este equipo vuelve a contar en las visitas de la web.':'Listo: este equipo ya no cuenta en las visitas de la web.';document.body.append(d);setTimeout(()=>d.remove(),7000);}
    window.DM_OFICINA=localStorage.getItem('dm-oficina')==='si';}catch{window.DM_OFICINA=false;}
  if(window.DM_OFICINA||typeof DM_CONTACT_URL==='undefined'||!DM_CONTACT_URL||!navigator.sendBeacon)return;
  const enviar=d=>{try{navigator.sendBeacon(DM_CONTACT_URL,JSON.stringify(d));}catch{}};
  let prop='';try{const el=document.getElementById('property-data');if(el)prop=String(JSON.parse(el.textContent).id||'');}catch{}
  let origen='directo';try{const sp=new URLSearchParams(location.search);const r=document.referrer?new URL(document.referrer).hostname.replace(/^www\.|^m\.|^l\.|^lm\./,''):'';
    origen=sp.get('utm_source')||(sp.has('fbclid')?'facebook':sp.has('gclid')?'google ads':'')||(r&&!/dimartinoprop\.com\.ar$/.test(r)?r:(r?'interna':'directo'));}catch{}
  enviar({evento:'visita',url:location.pathname,prop,origen:origen.slice(0,40)});
  // Lo que hace en la página se junta y se manda una sola vez al salir.
  const inicio=Date.now();let oculto=0,desde=0,enviado=false;const hizo={fotos:new Set(),ampliadas:0,tour:0,video:0,planos:0,mapa:0,descripcion:0,compartir:0,telefono:0,email:0};
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){desde=Date.now();salir();}else if(desde){oculto+=Date.now()-desde;desde=0;enviado=false;}});
  addEventListener('pagehide',salir);
  function salir(){if(enviado)return;enviado=true;const seg=Math.round((Date.now()-inicio-oculto)/1000);
    enviar({evento:'salida',prop,seg:Math.min(seg,3600),fotos:hizo.fotos.size,ampliadas:hizo.ampliadas,tour:hizo.tour,video:hizo.video,planos:hizo.planos,mapa:hizo.mapa,descripcion:hizo.descripcion,compartir:hizo.compartir,telefono:hizo.telefono,email:hizo.email});}
  const envolver=(nombre,fn)=>{const orig=window[nombre];if(typeof orig!=='function')return;window[nombre]=function(...a){try{fn(...a);}catch{}return orig.apply(this,a);};};
  hizo.fotos.add(0);
  envolver('actualizarGal',()=>setTimeout(()=>{try{hizo.fotos.add(galIdx);}catch{}},0));
  envolver('actualizarLightbox',()=>setTimeout(()=>{try{hizo.fotos.add(lbIdx);}catch{}},0));
  envolver('abrirLightbox',()=>hizo.ampliadas++);
  envolver('abrirLightboxTour',()=>hizo.tour++);envolver('abrirLightboxVideo',()=>hizo.video++);
  envolver('toggleMapa',()=>hizo.mapa++);envolver('toggleDesc',()=>hizo.descripcion++);envolver('compartir',()=>hizo.compartir++);
  document.addEventListener('click',e=>{const t=e.target.closest?.('a[href],.media-facade,[data-src]');if(!t)return;const h=(t.getAttribute('href')||t.dataset.src||'').toLowerCase();
    if(/plano/i.test(t.title||''))hizo.planos++;else if(/kuula|matterport|360|tour/.test(h))hizo.tour++;else if(/youtube|youtu\.be|vimeo/.test(h))hizo.video++;else if(/plano|blueprint/.test(h))hizo.planos++;
    else if(h.startsWith('tel:'))hizo.telefono++;else if(h.startsWith('mailto:'))hizo.email++;
    if(t.closest('#share-menu'))enviar({evento:'compartir',prop,medio:(t.textContent||'').trim().toLowerCase().slice(0,30)});},true);
})();

// Medición con Google Analytics 4. Solo corre en el dominio propio y solo si el visitante acepta
// (el aviso sale una única vez; la respuesta queda guardada en el navegador).
// Eventos: clic_whatsapp, clic_telefono, compartir y consulta_enviada, cada uno con el código de la propiedad.
const DM_GA_ID='G-XE7PJR5KCY';
const DM_GA_KEY='dm-medicion';
let dmGaOn=false;
function dmGaLoad(){
  if(dmGaOn)return;try{if(localStorage.getItem('dm-oficina')==='si')return;}catch{}dmGaOn=true;
  window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};
  window.gtag('js',new Date());window.gtag('config',DM_GA_ID,{anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false});
  const s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+DM_GA_ID;document.head.append(s);
}
function dmGaChoice(){try{return localStorage.getItem(DM_GA_KEY)||'';}catch{return '';}}
// Datos de la propiedad que se está viendo (ficha) o de la que habla un enlace (tarjeta o mensaje de WhatsApp).
function dmProp(link){
  let codigo='',titulo='';
  try{const el=document.getElementById('property-data');if(el){const p=JSON.parse(el.textContent);codigo=String(p.reference_code||p.id||'');titulo=(document.getElementById('det-titulo')?.textContent||'').trim().slice(0,100);}}catch{}
  if(!codigo&&link){try{const t=decodeURIComponent(link.href);const m=t.match(/dimartinoprop\.com\.ar\/([A-Za-z0-9-]{3,20})(?![\w/-])/);if(m)codigo=m[1].toUpperCase();}catch{}}
  return {propiedad:codigo||'(general)',propiedad_titulo:titulo||'(sin ficha)'};
}
function dmTrack(evento,datos,link){if(!dmGaOn||!window.gtag)return;try{window.gtag('event',evento,{...dmProp(link),pagina:location.pathname,...datos});}catch{}}
if(typeof window!=='undefined')window.dmTrack=dmTrack;
function dmGaBanner(){
  const bar=document.createElement('div');bar.className='cookie-aviso';bar.setAttribute('role','region');bar.setAttribute('aria-label','Aviso de cookies');
  bar.innerHTML='<p>Usamos cookies para saber cuántas visitas tiene la web y mejorarla. No guardamos tu nombre ni tu teléfono.</p><div><button type="button" data-ok>Aceptar</button><button type="button" data-no>No, gracias</button></div>';
  const close=v=>{try{localStorage.setItem(DM_GA_KEY,v);}catch{}bar.remove();if(v==='si')dmGaLoad();};
  bar.querySelector('[data-ok]').onclick=()=>close('si');bar.querySelector('[data-no]').onclick=()=>close('no');
  document.body.append(bar);
}
if(typeof document!=='undefined'&&typeof location!=='undefined'&&/(^|\.)dimartinoprop\.com\.ar$/.test(location.hostname||'')){
  const c=dmGaChoice();if(c==='si')dmGaLoad();else if(c!=='no'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',dmGaBanner);else dmGaBanner();}
  document.addEventListener('click',e=>{
    const a=e.target.closest&&e.target.closest('a[href]');if(!a)return;const h=a.getAttribute('href')||'';
    if(a.closest('#share-menu')){dmTrack('compartir',{medio:a.textContent.trim().toLowerCase()});return;}
    if(/wa\.me\/\d/.test(h))dmTrack('clic_whatsapp',{},a);
    else if(h.startsWith('tel:'))dmTrack('clic_telefono',{},a);
    else if(h.startsWith('mailto:'))dmTrack('clic_email',{},a);
  },true);
}

