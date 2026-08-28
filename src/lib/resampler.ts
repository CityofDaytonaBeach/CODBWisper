export const TARGET_RATE = 16000;

export function toMono16k(channels: Float32Array[], inputRate: number): Float32Array {
  if (channels.length === 0 || channels[0].length === 0) {
    return new Float32Array(0);
  }

  const len = channels[0].length;
  const mono = new Float32Array(len);
  if (channels.length === 1) {
    mono.set(channels[0]);
  } else {
    for (let i = 0; i < len; i++) {
      let s = 0;
      for (let c = 0; c < channels.length; c++) {
        const ch = channels[c];
        s += ch.length > i ? ch[i] : 0;
      }
      mono[i] = s / channels.length;
    }
  }

  if (inputRate === TARGET_RATE) {
    return mono;
  }

  const ratio = TARGET_RATE / inputRate;
  const outLen = Math.max(1, Math.round(mono.length * ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i / ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, mono.length - 1);
    const frac = pos - i0;
    out[i] = mono[i0] * (1 - frac) + mono[i1] * frac;
  }
  return out;
}