// Preserve the original desktop video without delaying the first visible frame.
(function(){
  const mount=document.getElementById('hero-yt-player');
  if(!mount||document.body.dataset.view!=='home')return;
  if(window.matchMedia('(max-width:768px), (prefers-reduced-motion:reduce)').matches||navigator.connection?.saveData)return;
  const start=()=>{
    window.onYouTubeIframeAPIReady=function(){
      new YT.Player(mount,{
        videoId:'61FhjbsgGiw',
        // No playlist: a playlist makes YouTube draw its previous/pause/next buttons over the video. The loop is done here.
        playerVars:{autoplay:1,mute:1,controls:0,rel:0,playsinline:1,iv_load_policy:3,cc_load_policy:0,disablekb:1,fs:0,modestbranding:1},
        events:{
          onReady(event){event.target.mute();event.target.playVideo();},
          onStateChange(event){const wrap=document.querySelector('.hero-video-wrap');// YouTube flashes its pause button when playback starts; the video is shown a moment later, once it is gone.
if(event.data===1){clearTimeout(window.__heroShow);window.__heroShow=setTimeout(()=>wrap?.classList.add('is-playing'),2500);}else if(event.data===0){event.target.seekTo(0);event.target.playVideo();}else if(event.data===2||event.data===3){clearTimeout(window.__heroShow);wrap?.classList.remove('is-playing');}}
        }
      });
    };
    const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;document.head.append(script);
  };
  if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});
})();
