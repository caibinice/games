// Self-contained per-game controller: native fullscreen, with a window-sized
// theatre layout when the browser does not expose the native API.
export function setupFullscreen({button,icon,onChange=()=>{},notice=()=>{}}){
  if(!button)return{toggle:()=>{},active:()=>false};
  const root=document.documentElement;let owned=false,busy=false;
  const active=()=>document.body.classList.contains('immersive');
  function update(value){
    document.body.classList.toggle('immersive',value);
    button.innerHTML=icon(value?'restore':'fullscreen')+`<span>${value?'退出全屏':'全屏游玩'}</span>`;
    button.setAttribute('aria-label',value?'退出全屏':'全屏游玩');button.setAttribute('aria-pressed',String(value));
    button.title=value?'F / Esc 退出全屏':'F 全屏游玩';onChange(value);
  }
  async function toggle(){
    if(busy)return;busy=true;
    try{
      if(active()){
        update(false);if(document.fullscreenElement===root)await document.exitFullscreen();
      }else{
        update(true);
        try{if(root.requestFullscreen)await root.requestFullscreen();}catch{/* Keep the theatre layout. */}
        owned=document.fullscreenElement===root;onChange(true);
        notice(owned?'已全屏放大 · F / Esc 退出':'已进入沉浸模式 · F / Esc 退出');
      }
    }finally{busy=false;}
  }
  button.addEventListener('click',event=>{event.preventDefault();void toggle();});
  document.addEventListener('fullscreenchange',()=>{
    if(document.fullscreenElement===root){owned=true;update(true);}
    else if(owned){owned=false;update(false);}
  });
  document.addEventListener('keydown',event=>{
    if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||document.querySelector('dialog[open]')||
       /INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;
    if(event.code==='KeyF'||event.code==='Escape'&&active()){
      event.preventDefault();event.stopImmediatePropagation();void toggle();
    }
  },true);
  update(false);return{toggle,active};
}
