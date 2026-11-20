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

// Mi lista: el visitante guarda propiedades con el botón "+" (sin registrarse; queda en su navegador) y consulta por todas juntas.
if(typeof window!=='undefined'&&!window.DM_BUILD){(function(){
  const KEY='dm-lista';
  const leer=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(x=>x&&x.id):[];}catch{return [];}};
  let lista=leer();
  const guardar=()=>{try{localStorage.setItem(KEY,JSON.stringify(lista));}catch{}pintar();};
  const tiene=id=>lista.some(x=>x.id===id);
  const alternar=item=>{if(tiene(item.id))lista=lista.filter(x=>x.id!==item.id);else{lista.push(item);oculta=false;try{sessionStorage.removeItem('dm-lista-oculta');}catch{}}guardar();};
  const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;};
  const telefono=()=>(document.querySelector('a[href*="wa.me/"]')?.href.match(/wa\.me\/(\d+)/)||[])[1]||'5492323678107';
  const datosTarjeta=card=>{const a=card.querySelector('.prop-titulo a');const id=(a?.getAttribute('href')||'').match(/propiedades\/(\d+)/)?.[1];if(!id)return null;let corto='';try{corto=decodeURIComponent(card.querySelector('.prop-wsp-card')?.href||'').match(/dimartinoprop\.com\.ar\/[\w-]+/)?.[0]||'';}catch{}
    return {id,t:a.textContent.trim(),u:(card.querySelector('.prop-ubicacion-ml')?.textContent||'').trim(),p:(card.querySelector('.prop-precio-ml')?.textContent||'').trim(),l:corto||location.host.replace(/^www\./,'')+'/propiedades/'+id+'/',h:a.getAttribute('href')};};
  const marcar=(b,on)=>{b.classList.toggle('is-on',on);b.textContent=on?'✓':'+';b.setAttribute('aria-label',on?'Quitar de mi lista':'Guardar en mi lista');b.title=on?'Quitar de mi lista':'Guardar en mi lista';};
  const botones=()=>{for(const card of document.querySelectorAll('.prop-card')){if(card.querySelector('.lista-mas'))continue;const d=datosTarjeta(card),foto=card.querySelector('.prop-foto');if(!d||!foto)continue;const b=el('button','lista-mas');b.type='button';b.dataset.id=d.id;marcar(b,tiene(d.id));const wa=card.querySelector('.prop-wsp-card');if(wa){b.classList.add('en-pie');wa.before(b);}else foto.append(b);}};
  // Barra y panel
  const barra=el('div','lista-barra'),panel=el('div','lista-panel');barra.hidden=true;panel.hidden=true;
  const cuenta=el('span','lista-cuenta'),ver=el('button','lista-ver','Ver lista'),wa=el('a','lista-wa','Consultar por todas');ver.type='button';wa.target='_blank';wa.rel='noopener';
  // Cruz para esconder la barra sin vaciar la lista; vuelve a aparecer al guardar otra propiedad.
  const cerrar=el('button','lista-cerrar','×');cerrar.type='button';cerrar.setAttribute('aria-label','Ocultar mi lista');cerrar.title='Ocultar (tu lista queda guardada)';
  let oculta=false;try{oculta=sessionStorage.getItem('dm-lista-oculta')==='1';}catch{}
  cerrar.onclick=()=>{oculta=true;try{sessionStorage.setItem('dm-lista-oculta','1');}catch{}panel.hidden=true;ver.textContent='Ver lista';document.body.classList.remove('lista-abierta');pintar();};
  barra.append(cerrar,cuenta,ver,wa);
  const pintar=()=>{const n=lista.length;barra.hidden=!n||oculta;document.body.classList.toggle('con-lista',!!n&&!oculta);if(!n){panel.hidden=true;ver.textContent='Ver lista';document.body.classList.remove('lista-abierta');}
    cuenta.textContent='';cuenta.append(String(n),el('span','lista-cuenta-larga',n===1?' propiedad':' propiedades'),n===1?' guardada':' guardadas');
    wa.href='https://wa.me/'+telefono()+'?text='+encodeURIComponent('Hola, quiero consultar por estas propiedades:\n'+lista.map((x,i)=>(i+1)+') '+x.t+(x.u?', '+x.u:'')+': '+x.l).join('\n'));
    document.querySelectorAll('.lista-mas').forEach(b=>marcar(b,tiene(b.dataset.id)));
    const f=document.querySelector('.lista-ficha');if(f){const on=tiene(f.dataset.id);f.classList.toggle('is-on',on);f.textContent=on?'✓ Guardada':'+ Guardar';f.title=on?'Quitar de mi lista':'Guardar en mi lista';}
    panel.textContent='';const cab=el('div','lista-panel-cab');cab.append(el('strong','', 'Mi lista'));const vaciar=el('button','lista-vaciar','Vaciar');vaciar.type='button';vaciar.onclick=()=>{lista=[];guardar();};cab.append(vaciar);panel.append(cab);
    for(const x of lista){const fila=el('div','lista-item');const a=el('a','',x.t);a.href=x.h;const sub=el('span','',[x.u,x.p].filter(Boolean).join(' | '));const q=el('button','lista-quitar','Quitar');q.type='button';q.onclick=()=>{lista=lista.filter(y=>y.id!==x.id);guardar();};const txt=el('div','lista-item-txt');txt.append(a,sub);fila.append(txt,q);panel.append(fila);}
    // Acciones de la lista: compartir (celular), copiar y mandar por mail.
    const acc=el('div','lista-acciones');
    const accion=(txt,fn,medio)=>{const b=el('button','lista-accion',txt);b.type='button';b.onclick=async()=>{try{await fn(b);}catch{}try{window.dmTrack&&window.dmTrack('lista_'+medio,{cantidad:lista.length});}catch{}};acc.append(b);return b;};
    if(navigator.share)accion('Compartir',()=>navigator.share({title:'Mi lista de propiedades | Di Martino',text:textoLista()}),'compartir');
    accion('Copiar',async b=>{const t=textoLista();if(navigator.clipboard)await navigator.clipboard.writeText(t);else{const a=el('textarea');a.value=t;document.body.append(a);a.select();document.execCommand('copy');a.remove();}b.textContent='¡Copiada!';setTimeout(()=>b.textContent='Copiar',2000);},'copiar');
    const porServidor=typeof DM_CONTACT_URL!=='undefined'&&DM_CONTACT_URL;
    const form=el('form','lista-mail');form.hidden=true;
    accion('Enviar por mail',()=>{if(!porServidor){location.href='mailto:?subject='+encodeURIComponent('Mi lista de propiedades | Di Martino')+'&body='+encodeURIComponent(textoLista());return;}form.hidden=!form.hidden;if(!form.hidden)form.querySelector('input').focus();},'mail_abrir');
    panel.append(acc);
    if(porServidor){
      const inp=el('input');inp.type='email';inp.required=true;inp.placeholder='Tu mail';inp.autocomplete='email';inp.setAttribute('aria-label','Tu mail');try{inp.value=localStorage.getItem('dm-mail')||'';}catch{}
      const env=el('button','lista-mail-btn','Enviar');env.type='submit';
      const fila=el('div','lista-mail-fila');fila.append(inp,env);
      const msj=el('p','lista-mail-msj','Te mandamos la lista con fotos y enlaces. Di Martino también la recibe para poder ayudarte.');
      form.append(fila,msj);
      form.onsubmit=async e=>{e.preventDefault();const mail=inp.value.trim();if(!mail)return;env.disabled=true;env.textContent='Enviando…';
        let ok=false;try{const r=await fetch(DM_CONTACT_URL,{method:'POST',body:JSON.stringify({evento:'lista_mail',email:mail,ids:lista.map(x=>x.id),oficina:!!window.DM_OFICINA})});ok=(await r.json()).ok;}catch{}
        env.disabled=false;env.textContent='Enviar';
        if(ok){try{localStorage.setItem('dm-mail',mail);}catch{}msj.textContent='¡Listo! Te la mandamos a '+mail+'. Si no la ves, revisá la carpeta de spam.';msj.classList.add('is-ok');try{window.dmTrack&&window.dmTrack('lista_mail',{cantidad:lista.length});}catch{}}
        else{msj.textContent='No se pudo enviar. Revisá el mail o probá en un rato.';msj.classList.remove('is-ok');}};
      panel.append(form);
    }
    const nota=el('p','lista-nota','Tu lista queda guardada en este dispositivo.');panel.append(nota);};
  const textoLista=()=>'Mi lista de propiedades | Di Martino Propiedades\n\n'+lista.map((x,i)=>(i+1)+') '+x.t+(x.u?', '+x.u:'')+(x.p?' | '+x.p:'')+'\n'+(/^https?:/.test(x.l)?x.l:'https://'+x.l)).join('\n\n')+'\n\nConsultas: wa.me/'+telefono();
  ver.onclick=()=>{panel.hidden=!panel.hidden;ver.textContent=panel.hidden?'Ver lista':'Cerrar';document.body.classList.toggle('lista-abierta',!panel.hidden);};
  document.addEventListener('click',e=>{const b=e.target.closest?.('.lista-mas');if(b){e.preventDefault();e.stopPropagation();const d=datosTarjeta(b.closest('.prop-card'));if(d)alternar(d);}});
  const iniciar=()=>{document.body.append(panel,barra);botones();
    // Ficha de propiedad
    const m=location.pathname.match(/\/propiedades\/(\d+)\/?$/),fila=document.querySelector('.det-precio-row');
    if(m&&fila&&document.getElementById('det-titulo')){const cod=(document.getElementById('det-ref')?.textContent||'').match(/[\w-]+$/)?.[0];const b=el('button','lista-ficha');b.type='button';b.dataset.id=m[1];b.onclick=()=>alternar({id:m[1],t:document.getElementById('det-titulo').textContent.trim(),u:'',p:(document.getElementById('det-precio')?.textContent||'').trim(),l:location.host.replace(/^www\./,'')+'/'+(cod||'propiedades/'+m[1]+'/'),h:location.pathname});fila.append(b);}
    pintar();
    let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(botones,150);}).observe(document.body,{childList:true,subtree:true});
    window.addEventListener('storage',e=>{if(e.key===KEY){lista=leer();pintar();}});
    // Botón para volver arriba
    const arriba=el('button','ir-arriba','↑');arriba.type='button';arriba.setAttribute('aria-label','Ir arriba');arriba.title='Ir arriba';arriba.hidden=true;arriba.onclick=()=>window.scrollTo({top:0,behavior:'smooth'});document.body.append(arriba);
    const alScroll=()=>{arriba.hidden=window.scrollY<700;};window.addEventListener('scroll',alScroll,{passive:true});alScroll();
    // Listados: debajo de los filtros, botón "Ver filtros" e invitación a propietarios, que acompañan al bajar
    const filtros=document.getElementById('property-filters');
    if(filtros&&!filtros.querySelector('.filtros-pie')){const pie=el('div','filtros-pie');const vf=el('button','filtros-volver','Ver filtros');vf.type='button';vf.hidden=true;vf.onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
      // Cuadro de Instagram (la invitación a vender ya está al pie del listado).
      const ig='https://www.instagram.com/dimartinopropiedades/',raiz=(typeof DM_ROOT!=='undefined'?DM_ROOT:'/');
      const caja=el('a','filtros-ig');caja.href=ig;caja.target='_blank';caja.rel='noopener';caja.setAttribute('aria-label','Seguinos en Instagram: @dimartinopropiedades');
      const cab=el('div','filtros-ig-cab');const av=el('span','filtros-ig-av');const iso=el('img');iso.src=raiz+'assets/iso-color.svg';iso.alt='';av.append(iso);
      const nom=el('div','filtros-ig-nom');nom.append(el('strong','','dimartinopropiedades'),el('span','','Instagram'));cab.append(av,nom);
      const fotos=el('div','filtros-ig-fotos');
      [...document.querySelectorAll('.prop-card')].map(c=>{const i=c.querySelector('.prop-foto img');return i&&(i.currentSrc||i.src||i.dataset.src);}).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).slice(0,3).forEach(src=>{const f=el('img');f.src=src;f.alt='';f.loading='lazy';fotos.append(f);});
      caja.append(el('p','filtros-ig-t','No te pierdas las últimas novedades'),cab);if(fotos.children.length)caja.append(fotos);const seg=el('span','filtros-ig-btn');seg.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>Seguir';caja.append(seg);
      caja.addEventListener('click',()=>{try{window.dmTrack&&window.dmTrack('clic_instagram',{lugar:'lateral'});}catch{}});
      pie.append(vf,caja);filtros.append(pie);
      const ver=()=>{vf.hidden=pie.getBoundingClientRect().top>90;};window.addEventListener('scroll',ver,{passive:true});ver();}
  };
  const seguro=()=>{try{iniciar();}catch(e){console.error(e);}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',seguro);else seguro();
})();}
