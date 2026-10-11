// Each game ships its own copy: no cross-game imports or third-party requests.
// Decode once and loop the PCM buffer, avoiding a network/restart gap per repeat.
export function musicPreference(value, oldSound=true){
  return typeof value==='boolean'?value:oldSound!==false;
}

export class LoopMusic{
  constructor(url,{getContext,fetcher=(url,options)=>globalThis.fetch(url,options),volume=.55}={}){
    this.url=url;this.getContext=getContext;this.fetcher=fetcher;
    this.volume=Math.min(1,Math.max(0,volume));this.wanted=false;
    this.context=null;this.buffer=null;this.loading=null;this.source=null;
    this.offset=0;this.startedAt=0;this.starts=0;this.error=null;
  }
  setPlaying(value){
    this.wanted=!!value;
    if(this.wanted)this.retry();else this.pause();
  }
  retry(){
    if(!this.wanted)return;
    try{
      if(!this.context){
        this.context=this.getContext();
        this.context.addEventListener?.('statechange',()=>this.startIfReady());
      }
      // Called synchronously in the start/continue user gesture, BEFORE fetch.
      // Rejected/interrupted autoplay is harmless; the next touch can retry.
      if(this.context.state!=='running')Promise.resolve(this.context.resume()).then(()=>this.startIfReady()).catch(()=>{});
      if(!this.buffer&&!this.loading){
        this.error=null;
        this.loading=Promise.resolve().then(()=>this.fetcher(this.url,{cache:'force-cache'})).then(response=>{
          if(!response.ok)throw Error('music-http-'+response.status);
          return response.arrayBuffer();
        }).then(bytes=>this.context.decodeAudioData(bytes)).then(buffer=>{
          if(!Number.isFinite(buffer.duration)||buffer.duration<=0)throw Error('music-empty');
          this.buffer=buffer;this.startIfReady();
        }).catch(error=>{this.error=error.message||'music-load';}).finally(()=>{this.loading=null;});
      }
      this.startIfReady();
    }catch(error){this.error=error.message||'music-context';}
  }
  startIfReady(){
    if(!this.wanted||this.source||!this.buffer||this.context?.state!=='running')return;
    try{
      const context=this.context,source=context.createBufferSource(),gain=context.createGain(),now=context.currentTime;
      source.buffer=this.buffer;source.loop=true;source.loopStart=0;source.loopEnd=this.buffer.duration;
      gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(this.volume,now+.06);
      source.connect(gain);gain.connect(context.destination);
      source.onended=()=>{source.disconnect();gain.disconnect();};
      this.offset%=this.buffer.duration;source.start(now,this.offset);
      this.source={node:source,gain};this.startedAt=now;this.starts++;
    }catch(error){this.error=error.message||'music-start';}
  }
  position(){
    return this.buffer?(this.offset+(this.source?this.context.currentTime-this.startedAt:0))%this.buffer.duration:0;
  }
  pause(){
    if(!this.source)return;
    this.offset=this.position();const {node,gain}=this.source,now=this.context.currentTime;
    this.source=null;
    try{gain.gain.cancelScheduledValues(now);gain.gain.setValueAtTime(gain.gain.value,now);gain.gain.linearRampToValueAtTime(0,now+.025);node.stop(now+.025);}catch{node.disconnect();gain.disconnect();}
  }
  state(){
    // Read-only diagnostics: no gameplay mutation or seek API.
    return{enabled:this.wanted,playing:!!this.source&&this.context?.state==='running',
      loading:!!this.loading,duration:this.buffer?.duration||0,position:this.position(),
      loop:this.source?.node.loop||false,starts:this.starts,volume:this.volume,error:this.error};
  }
}
