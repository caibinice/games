const FILES={shot:'laya-hitsnd1.wav',pickup:'laya-get_prop.wav',explosion:'laya-enemy_four_five_boom.wav',bridge:'laya-stone_boom.wav',boss:'laya-boss01_boom.wav',win:'laya-gameover.wav',dead:'canvas-dead.mp3',lose:'canvas-game-over.mp3'};
export const MUSIC=['jungle','base','waterfall','base','snowfield','energy','jungle','alien'];
export function createAudio(){
 let context,enabled=true,unlocked=false,running=false,music,track='jungle';const buffers=new Map(),last=new Map();
 async function unlock(){try{context||=new AudioContext();await context.resume();unlocked=true;}catch{}}
 async function load(){await Promise.all(Object.entries(FILES).map(async([name,file])=>{const r=await fetch(`./assets/audio/${file}`);if(!r.ok)throw Error('Sound asset missing');buffers.set(name,await r.arrayBuffer());}));select(track);}
 function select(next){if(music&&next===track)return;music?.pause();track=next;music=new Audio(`./assets/audio/nes-${track}.ogg`);music.preload='auto';music.loop=true;music.volume=.3;sync();}
 async function play(name){if(!enabled||!unlocked||!buffers.has(name))return;try{const now=performance.now();if(now-(last.get(name)||-1000)<70)return;last.set(name,now);let b=buffers.get(name);if(b instanceof ArrayBuffer){b=await context.decodeAudioData(b.slice(0));buffers.set(name,b);}const s=context.createBufferSource(),gain=context.createGain();s.buffer=b;gain.gain.value=name==='shot'?.28:.5;s.connect(gain).connect(context.destination);s.start();}catch{}}
 function sync(){if(!music)return;if(enabled&&unlocked&&running)music.play().catch(()=>{});else music.pause();}
 return{load,unlock,play,setEnabled(v){enabled=v;sync();},setRunning(v){running=v;sync();},setScene(level,phase){const next=phase==='boss'&&[2,4].includes(level)?'boss':MUSIC[level-1];if(next&&next!==track)select(next);},get ready(){return unlocked;}};
}
