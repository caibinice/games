import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {LoopMusic as GooseMusic,musicPreference as goosePreference} from '../games/goose/public/music.mjs';
import {LoopMusic as PinMusic,musicPreference as pinPreference} from '../games/pindou/public/music.mjs';

const settle=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
function fixture(Player){
  const nodes=[],gains=[];
  const context={state:'suspended',currentTime:0,destination:{},
    resume:vi.fn(async()=>{context.state='running';}),
    decodeAudioData:vi.fn(async()=>({duration:40})),addEventListener:vi.fn(),
    createBufferSource:()=>{const n={connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn()};nodes.push(n);return n;},
    createGain:()=>{const g={connect:vi.fn(),disconnect:vi.fn(),gain:{value:.8,setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),cancelScheduledValues:vi.fn()}};gains.push(g);return g;},
  };
  const fetcher=vi.fn(async()=>({ok:true,status:200,arrayBuffer:async()=>new ArrayBuffer(2)}));
  const getContext=vi.fn(()=>context),player=new Player('/music.mp3',{getContext,fetcher});
  return{player,context,fetcher,getContext,nodes,gains};
}
for(const [name,Player,pref] of [['goose',GooseMusic,goosePreference],['pindou',PinMusic,pinPreference]])describe(name+' background music',()=>{
  it('does not create audio or fetch assets on a silent landing page',async()=>{
    const f=fixture(Player);f.player.setPlaying(false);f.player.retry();await settle();expect(f.getContext).not.toHaveBeenCalled();expect(f.fetcher).not.toHaveBeenCalled();
  });
  it('calls the native window fetch with its proper receiver',async()=>{
    const f=fixture(Player),native=globalThis.fetch;
    globalThis.fetch=function(){expect(this).toBe(globalThis);return f.fetcher(...arguments);};
    try{const p=new Player('/music.mp3',{getContext:f.getContext});p.setPlaying(true);await settle();expect(p.state().playing).toBe(true);}finally{globalThis.fetch=native;}
  });
  it('unlocks synchronously before loading, then loops one decoded buffer',async()=>{
    const f=fixture(Player);f.player.setPlaying(true);expect(f.context.resume).toHaveBeenCalledOnce();expect(f.fetcher).not.toHaveBeenCalled();await settle();
    expect(f.fetcher).toHaveBeenCalledOnce();expect(f.nodes).toHaveLength(1);expect(f.nodes[0].loop).toBe(true);expect(f.nodes[0].loopEnd).toBe(40);expect(f.player.state().playing).toBe(true);
    expect(f.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(.8,.06);
  });
  it('does not stack music when repeated taps and resume callbacks arrive',async()=>{
    const f=fixture(Player);for(let i=0;i<15;i++)f.player.setPlaying(true);await settle();for(let i=0;i<15;i++)f.player.retry();await settle();expect(f.nodes).toHaveLength(1);expect(f.fetcher).toHaveBeenCalledOnce();
  });
  it('keeps music stopped if settings/background interrupts loading',async()=>{
    const f=fixture(Player);let resolve;f.fetcher.mockReturnValue(new Promise(r=>{resolve=r;}));f.player.setPlaying(true);await settle();f.player.setPlaying(false);resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(2)});await settle();expect(f.nodes).toHaveLength(0);expect(f.player.state().duration).toBe(40);
  });
  it('handles a rapid on/off/on while fetching without duplicating a source',async()=>{
    const f=fixture(Player);f.player.setPlaying(true);f.player.setPlaying(false);f.player.setPlaying(true);await settle();expect(f.nodes).toHaveLength(1);expect(f.fetcher).toHaveBeenCalledOnce();
  });
  it('pauses and resumes the musical position, including a complete loop',async()=>{
    const f=fixture(Player);f.player.setPlaying(true);await settle();f.context.currentTime=43;f.player.setPlaying(false);expect(f.player.state().position).toBe(3);expect(f.nodes[0].stop).toHaveBeenCalledWith(43.025);
    f.context.currentTime=60;expect(f.player.state().position).toBe(3);f.player.setPlaying(true);expect(f.nodes[1].start).toHaveBeenCalledWith(60,3);expect(f.fetcher).toHaveBeenCalledOnce();expect(f.context.decodeAudioData).toHaveBeenCalledOnce();
  });
  it('ignores blocked autoplay and retries on a later gesture',async()=>{
    const f=fixture(Player);f.context.resume.mockRejectedValueOnce(Error('blocked'));f.player.setPlaying(true);await settle();expect(f.nodes).toHaveLength(0);expect(f.player.state().playing).toBe(false);f.player.retry();await settle();expect(f.nodes).toHaveLength(1);expect(f.fetcher).toHaveBeenCalledOnce();
  });
  it('does not restart after a pending resume resolves during pause',async()=>{
    const f=fixture(Player);let done;f.context.resume.mockReturnValue(new Promise(r=>{done=r;}));f.player.setPlaying(true);await settle();f.player.setPlaying(false);f.context.state='running';done();await settle();expect(f.nodes).toHaveLength(0);
  });
  it('can retry a network/HTTP failure without breaking the game',async()=>{
    const f=fixture(Player);f.fetcher.mockResolvedValueOnce({ok:false,status:404});f.player.setPlaying(true);await settle();expect(f.player.state().error).toBe('music-http-404');expect(f.nodes).toHaveLength(0);f.player.retry();await settle();expect(f.player.state().error).toBe(null);expect(f.nodes).toHaveLength(1);
  });
  it('can retry a decode failure and rejects an empty decoded track',async()=>{
    const f=fixture(Player);f.context.decodeAudioData.mockRejectedValueOnce(Error('decode'));f.player.setPlaying(true);await settle();expect(f.player.state().error).toBe('decode');f.context.decodeAudioData.mockResolvedValueOnce({duration:0});f.player.retry();await settle();expect(f.player.state().error).toBe('music-empty');f.player.retry();await settle();expect(f.nodes).toHaveLength(1);
  });
  it('an old faded node disconnects without stopping the replacement',async()=>{
    const f=fixture(Player);f.player.setPlaying(true);await settle();f.player.setPlaying(false);f.player.setPlaying(true);f.nodes[0].onended();expect(f.nodes[0].disconnect).toHaveBeenCalledOnce();expect(f.gains[0].disconnect).toHaveBeenCalledOnce();expect(f.player.state().playing).toBe(true);expect(f.nodes[1].stop).not.toHaveBeenCalled();
  });
  it('a device without Web Audio still runs the game without throwing',()=>{
    const p=new Player('/music.mp3',{getContext:()=>{throw Error('unsupported');}});expect(()=>p.setPlaying(true)).not.toThrow();expect(p.state().playing).toBe(false);
  });
  it('preserves old muted preferences while allowing independent explicit music',()=>{
    expect(pref(undefined,true)).toBe(true);expect(pref(undefined,false)).toBe(false);expect(pref(true,false)).toBe(true);expect(pref(false,true)).toBe(false);expect(pref('broken',false)).toBe(false);
  });
});
it('ships two distinct compact MP3 tracks inside independent public directories',()=>{
  const g=readFileSync(new URL('../games/goose/public/assets/audio/music-loop.mp3',import.meta.url)),p=readFileSync(new URL('../games/pindou/public/assets/audio/music-loop.mp3',import.meta.url));
  for(const b of [g,p]){
    expect(b.subarray(0,3).toString()).toBe('ID3');expect(b.length).toBeGreaterThan(700000);expect(b.length).toBeLessThan(900000);
    // Skip the synchsafe ID3 size, then inspect the MPEG frame's channel mode.
    const start=10+((b[6]&127)<<21)+((b[7]&127)<<14)+((b[8]&127)<<7)+(b[9]&127);
    expect(b[start]).toBe(255);expect(b[start+1]&224).toBe(224);expect(b[start+3]>>6).not.toBe(3);
  }
  expect(g.equals(p)).toBe(false);
});
it('shows each source title, author, license and modifications in game settings',()=>{
  for(const [game,title,isrc] of [['goose','Life of Riley','USUAN1400054'],['pindou','Carefree','USUAN1400037']]){
    const app=readFileSync(new URL(`../games/${game}/public/app.mjs`,import.meta.url),'utf8');
    expect(app).toContain(title+' — Kevin MacLeod');expect(app).toContain('isrc='+isrc);
    expect(app).toContain('https://creativecommons.org/licenses/by/4.0/');expect(app).toContain('节选、循环与音量调整');
    expect(app).not.toContain('录屏背景音乐');
  }
});
it('cache-busts both replacement tracks and their entry modules together',()=>{
  for(const game of ['goose','pindou']){
    const app=readFileSync(new URL(`../games/${game}/public/app.mjs`,import.meta.url),'utf8'),html=readFileSync(new URL(`../games/${game}/public/index.html`,import.meta.url),'utf8');
    const version=app.match(/music-loop\.mp3\?v=([\w-]+)/)[1];
    expect(html).toContain('app.mjs?v='+version);expect(version).not.toBe('20261011-4');
  }
});
