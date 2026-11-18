// YouTube playback may be disabled by the channel; keep a reliable external option.
function abrirLightboxVideo(){
  const video=(galProp?.videos||[]).find(v=>/youtube\.com|youtu\.be/.test(v.player_url));
  if(!video)return;
  const parsed=new URL(video.player_url);
  const id=parsed.searchParams.get('v')||parsed.pathname.split('/').filter(Boolean).at(-1);
  if(!/^[a-zA-Z0-9_-]{11}$/.test(id)){window.open(video.player_url,'_blank','noopener');return;}
  const href='https://www.youtube.com/watch?v='+id;
  document.getElementById('lb-yt-thumb').src='https://i.ytimg.com/vi/'+id+'/hqdefault.jpg';
  const card=document.getElementById('lb-yt-card');card.onclick=()=>window.open(href,'_blank','noopener');card.setAttribute('role','link');card.setAttribute('tabindex','0');card.setAttribute('aria-label','Ver video de la propiedad en YouTube');card.onkeydown=e=>{if(e.key==='Enter')card.click();};
  document.getElementById('lb-img-wrap').style.display='none';document.getElementById('lb-iframe-wrap').style.display='none';document.getElementById('lb-yt-wrap').style.display='flex';for(const id of ['lb-prev','lb-next','lb-counter'])document.getElementById(id).style.display='none';document.getElementById('lightbox').classList.add('open');document.body.style.overflow='hidden';document.querySelector('.lightbox-cerrar').focus();
}

// El video se carga al hacer clic; el recorrido 360° se abre solo (ver abajo).
function abrirMedia(button){if(!button?.isConnected)return;const frame=document.createElement('iframe');frame.src=button.dataset.src;frame.setAttribute('allow',button.dataset.allow||'fullscreen');frame.setAttribute('allowfullscreen','');frame.title=(button.getAttribute('aria-label')||'Contenido multimedia').replace(/^Abrir el /,'').replace(/^r/,'R');frame.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0';button.replaceWith(frame);}
document.addEventListener('click',e=>{const button=e.target.closest?.('.media-facade');if(button)abrirMedia(button);});

// El recorrido 360° se abre solo, sin clic, cuando el visitante se acerca a esa parte de la ficha.
if(typeof window!=='undefined'&&!window.DM_BUILD){const tours=document.querySelectorAll('#det-tour-card .media-facade');if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){io.unobserve(e.target);abrirMedia(e.target);}},{rootMargin:'500px 0px'});tours.forEach(t=>io.observe(t));}else tours.forEach(abrirMedia);}

// The floating Instagram button steps aside while the footer is on screen.
if(typeof window!=='undefined'&&!window.DM_BUILD&&'IntersectionObserver' in window){const ig=document.querySelector('.ig-float'),foot=document.querySelector('footer');if(ig&&foot)new IntersectionObserver(([e])=>ig.classList.toggle('is-hidden',e.isIntersecting)).observe(foot);}

// Loteos: al tocar un lote del plano o de la lista se muestran sus medidas, precio y el enlace de consulta.
if(typeof window!=='undefined'&&!window.DM_BUILD&&document.querySelector('.loteo')){
  const ficha=document.getElementById('loteo-ficha');
  const elegir=n=>{const fila=document.querySelector('.loteo-tabla tr[data-lote="'+n+'"]');if(!fila)return;const d=fila.dataset,vendido=d.estado==='vendido';
    document.querySelectorAll('.loteo [data-lote].is-sel,.loteo-tabla tr.is-sel').forEach(e=>e.classList.remove('is-sel'));
    document.querySelector('.loteo-plano [data-lote="'+n+'"]')?.classList.add('is-sel');fila.classList.add('is-sel');
    ficha.textContent='';
    const p=(cls,txt)=>{const e=document.createElement('p');e.className=cls;e.textContent=txt;ficha.append(e);return e;};
    p('loteo-ficha-k',vendido?'Vendido':'Disponible');p('loteo-ficha-t','Lote '+n);if(d.nota)p('loteo-ficha-nota',d.nota);
    {const f=Number(d.fn),g=Number(d.dn);if(f>0&&g>0){const k=120/Math.max(f,g),w=Math.round(f*k),h=Math.round(g*k),x=(200-w)/2,y=12;const box=document.createElement('div');box.className='loteo-mini';box.innerHTML='<svg viewBox="0 0 200 '+(h+44)+'" role="img" aria-label="Croquis del lote con sus medidas"><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="2"/><text x="100" y="'+(y+h+16)+'" text-anchor="middle">Frente '+String(f).replace('.',',')+' m</text><text transform="translate('+(x-8)+' '+(y+h/2)+') rotate(-90)" text-anchor="middle">Fondo '+String(g).replace('.',',')+' m</text><line x1="'+x+'" y1="'+(y+h+26)+'" x2="'+(x+w)+'" y2="'+(y+h+26)+'"/><text class="mini-calle" x="100" y="'+(y+h+38)+'" text-anchor="middle">Calle</text></svg>';ficha.append(box);}}
    const dl=document.createElement('dl');for(const [k,v] of [['Superficie',d.sup],['Frente',d.frente],['Fondo',d.fondo]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;dl.append(dt,dd);}ficha.append(dl);
    if(!vendido){p('loteo-ficha-precio',d.precio);const a=document.createElement('a');a.className='loteo-ficha-btn';a.href=d.wa;a.target='_blank';a.rel='noopener';a.textContent='Consultar por este lote';ficha.append(a);}
    ficha.classList.toggle('is-vendido',vendido);
    const fin=document.querySelector('.loteo-fin'),precio=Number(d.pn);if(fin&&precio>0){const m=fin.dataset.moneda+' ',fmt=v=>m+String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');document.getElementById('fin-para').textContent='el lote '+n+' ('+fmt(precio)+')';fin.querySelectorAll('.fin-plan').forEach(pl=>{const total=Math.round(precio*(1+Number(pl.dataset.ajuste)/100)),c=Number(pl.dataset.cuotas),ent=c?Math.round(total*Number(pl.dataset.entrega)/100):0;pl.querySelector('.fin-total').textContent=fmt(total);if(c){pl.querySelector('.fin-entrega').textContent=fmt(ent);pl.querySelector('.fin-cuota').textContent=fmt((total-ent)/c);}});}};
  document.addEventListener('click',e=>{if(e.target.closest?.('.loteo-tabla a'))return;const el=e.target.closest?.('.loteo-plano [data-lote],.loteo-tabla tr[data-lote]');if(el)elegir(el.dataset.lote);});
  document.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const el=e.target.closest?.('.loteo-plano [data-lote]');if(el){e.preventDefault();elegir(el.dataset.lote);}});
}
