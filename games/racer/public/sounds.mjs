// Original short arcade cues, generated once and played from decoded Web Audio buffers.
export const CUES = {
  pickup: { duration: 0.17, gain: 0.38 },
  nitro: { duration: 0.2, gain: 0.3 },
  jet: { duration: 0.24, gain: 0.34 },
};
export function cueSamples(type, rate = 22050) {
  const cue = CUES[type];
  if (!cue) return null;
  const out = new Float32Array(Math.ceil(rate * cue.duration));
  let phase = 0,
    seed = 14283,
    previousNoise = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / rate,
      u = t / cue.duration;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 0x80000000 - 1;
    const highNoise = (noise - previousNoise) * 0.5;
    previousNoise = noise;
    const envelope = Math.min(1, t / 0.004) * Math.pow(1 - u, 2.5);
    if (type === 'pickup') {
      const note = t < 0.065 ? 1174.66 : 1567.98;
      phase += (Math.PI * 2 * note) / rate;
      out[i] = (Math.sin(phase) + 0.18 * Math.sin(phase * 2)) * envelope * cue.gain;
    } else {
      phase += (Math.PI * 2 * (type === 'jet' ? 650 + 2400 * u : 360 + 950 * u)) / rate;
      out[i] = (Math.sin(phase) * 0.55 + highNoise * 0.65) * envelope * cue.gain;
    }
  }
  out[out.length - 1] = 0;
  return out;
}
