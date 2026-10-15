const FILES=Object.fromEntries(['stage_start','game_over','bullet_shot','bullet_hit_1','bullet_hit_2','explosion_1','explosion_2','pause','powerup_appear','powerup_pick','statistics_1','snow_slide'].map(n=>[n,`./assets/audio/${n}.ogg`]));
export function createAudio(){
 let context,enabled=true,unlocked=false;const buffers=new Map(),last=new Map();
 async function unlock(){try{context||=new AudioContext();await context.resume();unlocked=true;}catch{}}
 async function load(){await Promise.all(Object.entries(FILES).map(async([name,url])=>{try{const response=await fetch(url);if(!response.ok)return;const raw=await response.arrayBuffer();buffers.set(name,raw);}catch{}}));}
 async function play(name){if(!enabled||!unlocked||!buffers.has(name))return;try{const now=performance.now();if(now-(last.get(name)||-1000)<45)return;last.set(name,now);let b=buffers.get(name);if(b instanceof ArrayBuffer){b=await context.decodeAudioData(b.slice(0));buffers.set(name,b);}const source=context.createBufferSource(),gain=context.createGain();source.buffer=b;gain.gain.value=.38;source.connect(gain).connect(context.destination);source.start();}catch{}}
 return{load,unlock,play,setEnabled(value){enabled=value;},setRunning(){},get ready(){return unlocked;}};
}
