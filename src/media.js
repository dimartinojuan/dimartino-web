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
