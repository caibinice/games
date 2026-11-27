const FILES={shot:'laya-hitsnd1.wav',pickup:'laya-get_prop.wav',explosion:'laya-enemy_four_five_boom.wav',bridge:'laya-stone_boom.wav',boss:'laya-boss01_boom.wav',win:'laya-gameover.wav',dead:'canvas-dead.mp3',lose:'canvas-game-over.mp3'};
export const MUSIC=['jungle','base','waterfall','base','snowfield','energy','jungle','alien'];
export function createAudio(){
 let context,enabled=true,unlocked=false,running=false,music,track='jungle';const buffers=new Map(),last=new Map();
 async function unlock(){try{context||=new AudioContext();await context.resume();unlocked=true;}catch{}}
 async function load(){await Promise.all(Object.entries(FILES).map(async([name,file])=>{const r=await fetch(`./assets/audio/${file}`);if(!r.ok)throw Error('Sound asset missing');buffers.set(name,await r.arrayBuffer());}));select(track);}
 function select(next){if(music&&next===track)return;music?.pause();track=next;music=new Audio(`./assets/audio/nes-${track}.ogg`);music.preload='auto';music.loop=true;music.volume=.3;sync();}
 function thump(name){
  const t=context.currentTime,o=context.createOscillator(),g=context.createGain();
  const light=name==='impact',heavy=name==='boss'||name==='bridge';
  const duration=light?.053:heavy?.20:.124;
  o.type=light?'triangle':'sine';o.frequency.setValueAtTime(light?460:heavy?112:178,t);
  o.frequency.exponentialRampToValueAtTime(light?180:heavy?44:73,t+duration);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(light?.083:heavy?.15:.11,t+.005);
  g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  o.connect(g).connect(context.destination);o.start(t);o.stop(t+duration+.01);
 }
 async function play(name){
  if(!enabled||!unlocked||(!buffers.has(name)&&name!=='impact'))return;
  try{
   const now=performance.now();if(now-(last.get(name)??-1000)<(name==='shot'?70:90))return;last.set(name,now);
   if(['impact','explosion','boss','bridge','dead'].includes(name))thump(name);
   if(name==='impact')return;
   let b=buffers.get(name);if(b instanceof ArrayBuffer){const decoded=context.decodeAudioData(b.slice(0));buffers.set(name,decoded);b=decoded;}b=await b;
   if(!enabled||!b)return;
   const src=context.createBufferSource(),gain=context.createGain();src.buffer=b;gain.gain.value=name==='shot'?.31:.46;src.connect(gain).connect(context.destination);src.start();
  }catch{}
 }
 function sync(){if(!music)return;if(enabled&&unlocked&&running)music.play().catch(()=>{});else music.pause();}
 return{load,unlock,play,dispose(){enabled=false;music?.pause();music?.removeAttribute('src');music?.load();buffers.clear();last.clear();void context?.close();},setEnabled(v){enabled=v;sync();},setRunning(v){running=v;sync();},setScene(level,phase){const next=phase==='boss'&&[2,4].includes(level)?'boss':MUSIC[level-1];if(next&&next!==track)select(next);},get ready(){return unlocked;}};
}
