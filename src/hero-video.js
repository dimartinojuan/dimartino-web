// Video de la portada: alojado en el propio servidor (sin YouTube), solo en compu y sin demorar la primera imagen.
(function(){
  const mount=document.getElementById('hero-yt-player');
  if(!mount||document.body.dataset.view!=='home')return;
  if(window.matchMedia('(max-width:768px), (prefers-reduced-motion:reduce)').matches||navigator.connection?.saveData)return;
  const start=()=>{
    const css=document.querySelector('link[href*="assets/site.css"]');if(!css)return;
    const wrap=document.querySelector('.hero-video-wrap'),video=document.createElement('video');
    video.muted=true;video.loop=true;video.playsInline=true;video.autoplay=true;video.preload='auto';
    video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');video.tabIndex=-1;
    video.addEventListener('playing',()=>wrap?.classList.add('is-playing'),{once:true});
    video.src=css.href.replace(/site\.css.*$/,'portada.mp4');
    mount.replaceWith(video);video.play?.().catch(()=>{});
  };
  if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});
})();
