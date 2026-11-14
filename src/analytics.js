// Contador propio de visitas (sin cookies ni datos personales): cada página vista avisa al servidor, que arma el resumen diario por Telegram.
// Los equipos de la oficina se marcan UNA vez abriendo dimartinoprop.com.ar/?oficina y desde entonces no cuentan (ni en Analytics). Para deshacerlo: ?oficina=no
(function(){
  try{const p=new URLSearchParams(location.search);if(p.has('oficina')){const no=p.get('oficina')==='no';if(no)localStorage.removeItem('dm-oficina');else localStorage.setItem('dm-oficina','si');
    p.delete('oficina');history.replaceState(null,'',location.pathname+(p.size?'?'+p:'')+location.hash);
    const d=document.createElement('div');d.className='oficina-aviso';d.setAttribute('role','status');d.textContent=no?'Este equipo vuelve a contar en las visitas de la web.':'Listo: este equipo ya no cuenta en las visitas de la web.';document.body.append(d);setTimeout(()=>d.remove(),7000);}
    window.DM_OFICINA=localStorage.getItem('dm-oficina')==='si';}catch{window.DM_OFICINA=false;}
  if(window.DM_OFICINA||typeof DM_CONTACT_URL==='undefined'||!DM_CONTACT_URL||!navigator.sendBeacon)return;
  try{navigator.sendBeacon(DM_CONTACT_URL,JSON.stringify({evento:'visita',url:location.pathname}));}catch{}
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

