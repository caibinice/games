const noiseByContext = new WeakMap();
export function playWaterBurst(ctx) {
  let buffer = noiseByContext.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.25), ctx.sampleRate);
    const out = buffer.getChannelData(0);
    for (let i = 0; i < out.length; i++) out[i] = Math.random() * 2 - 1;
    noiseByContext.set(ctx, buffer);
  }
  const at = ctx.currentTime,
    bass = ctx.createOscillator(),
    punch = ctx.createGain();
  bass.frequency.setValueAtTime(165, at);
  bass.frequency.exponentialRampToValueAtTime(56, at + 0.14);
  punch.gain.setValueAtTime(0.0001, at);
  punch.gain.exponentialRampToValueAtTime(0.18, at + 0.008);
  punch.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
  bass.connect(punch).connect(ctx.destination);
  bass.start(at);
  bass.stop(at + 0.17);
  const spray = ctx.createBufferSource(),
    band = ctx.createBiquadFilter(),
    gain = ctx.createGain();
  spray.buffer = buffer;
  band.type = 'bandpass';
  band.Q.value = 0.65;
  band.frequency.setValueAtTime(1700, at);
  band.frequency.exponentialRampToValueAtTime(530, at + 0.2);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.17, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
  spray.connect(band).connect(gain).connect(ctx.destination);
  spray.start(at);
}
