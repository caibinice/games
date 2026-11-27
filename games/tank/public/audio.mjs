const FILES=Object.fromEntries(['stage_start','game_over','bullet_shot','bullet_hit_1','bullet_hit_2','explosion_1','explosion_2','pause','powerup_appear','powerup_pick','statistics_1','snow_slide'].map(n=>[n,`./assets/audio/${n}.ogg`]));
export function createAudio(){
 let context,enabled=true,unlocked=false;const buffers=new Map(),last=new Map();
 async function unlock(){try{context||=new AudioContext();await context.resume();unlocked=true;}catch{}}
 async function load(){await Promise.all(Object.entries(FILES).map(async([name,url])=>{try{const response=await fetch(url);if(!response.ok)return;const raw=await response.arrayBuffer();buffers.set(name,raw);}catch{}}));}
 function body(name){
  const big=name==='explosion_1'||name==='explosion_2',hit=name==='bullet_hit_1'||name==='bullet_hit_2';
  if(!big&&!hit)return;
  const at=context.currentTime,len=big?.13:.044,o=context.createOscillator(),g=context.createGain();
  o.type=big?'sine':'triangle';o.frequency.setValueAtTime(big?128:490,at);o.frequency.exponentialRampToValueAtTime(big?49:190,at+len);
  g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(big?.12:.061,at+.004);g.gain.exponentialRampToValueAtTime(.0001,at+len);
  o.connect(g).connect(context.destination);o.start(at);o.stop(at+len+.01);
 }
 async function play(name){if(!enabled||!unlocked||!buffers.has(name))return;try{const now=performance.now();if(now-(last.get(name)||-1000)<45)return;last.set(name,now);body(name);let b=buffers.get(name);if(b instanceof ArrayBuffer){const decoded=context.decodeAudioData(b.slice(0));buffers.set(name,decoded);b=decoded;}b=await b;if(!enabled||!b)return;const source=context.createBufferSource(),gain=context.createGain();source.buffer=b;gain.gain.value=.38;source.connect(gain).connect(context.destination);source.start();}catch{}}
 return{load,unlock,play,dispose(){enabled=false;buffers.clear();last.clear();void context?.close();},setEnabled(value){enabled=value;},setRunning(){},get ready(){return unlocked;}};
}
