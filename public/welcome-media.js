const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const copyrightYear=document.querySelector('#copyright-year');
if(copyrightYear)copyrightYear.textContent=String(new Date().getFullYear());
const videos=[...document.querySelectorAll('.motion-video')];
const pausedByVisitor=new WeakSet();
const visible=new WeakSet();
const automatic=()=>!reduce.matches&&!navigator.connection?.saveData;
function sync(video){if(!automatic()||document.hidden||!visible.has(video)){if(!video.paused)video.pause();return;}if(!pausedByVisitor.has(video))video.play().catch(()=>{});}
for(const video of videos){
 // Explicit player interaction takes precedence over automatic playback.
 video.addEventListener('pointerdown',()=>pausedByVisitor.add(video));
 video.addEventListener('keydown',()=>pausedByVisitor.add(video));
}
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting)visible.add(e.target);else visible.delete(e.target);sync(e.target);}},{threshold:.35});videos.forEach(v=>observer.observe(v));}
reduce.addEventListener('change',()=>videos.forEach(sync));
document.addEventListener('visibilitychange',()=>videos.forEach(sync));
