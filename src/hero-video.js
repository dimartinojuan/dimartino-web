// Preserve the original desktop video without delaying the first visible frame.
(function(){
  const mount=document.getElementById('hero-yt-player');
  if(!mount||document.body.dataset.view!=='home')return;
  if(window.matchMedia('(max-width:768px), (prefers-reduced-motion:reduce)').matches||navigator.connection?.saveData)return;
  const start=()=>{
    window.onYouTubeIframeAPIReady=function(){
      new YT.Player(mount,{
        videoId:'61FhjbsgGiw',
        playerVars:{autoplay:1,mute:1,loop:1,playlist:'61FhjbsgGiw',controls:0,rel:0,playsinline:1,iv_load_policy:3,cc_load_policy:0},
        events:{
          onReady(event){event.target.mute();event.target.playVideo();},
          onStateChange(event){if(event.data===1)document.querySelector('.hero-video-wrap')?.classList.add('is-playing');}
        }
      });
    };
    const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;document.head.append(script);
  };
  if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});
})();
