// Medición con Google Analytics 4. Solo corre en el dominio propio y solo si el visitante acepta
// (el aviso sale una única vez; la respuesta queda guardada en el navegador).
// Eventos: clic_whatsapp, clic_telefono, compartir y consulta_enviada, cada uno con el código de la propiedad.
const DM_GA_ID='G-XE7PJR5KCY';
const DM_GA_KEY='dm-medicion';
let dmGaOn=false;
function dmGaLoad(){
  if(dmGaOn)return;dmGaOn=true;
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
