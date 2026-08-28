import { pipeline } from "@huggingface/transformers";

function makeAudio(seconds = 6) {
  const rate = 16000;
  const n = Math.floor(rate * seconds);
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    a[i] =
      0.3 * Math.sin(2 * Math.PI * 220 * t) +
      0.2 * Math.cos(2 * Math.PI * 440 * t) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 1.3 * t));
  }
  return a;
}

const t0 = Date.now();
const transcriber = await pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny.en", {
  dtype: "q8",
  progress_callback: (p) => {
    if (p.status === "progress") process.stdout.write(`\rmodel ${Math.round(p.progress ?? 0)}%`);
  },
});
console.log(`\nmodel ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

let chunks = 0;
const out = await transcriber(makeAudio(), {
  task: "transcribe",
  return_timestamps: true,
  chunk_length_s: 3,
  stride_length_s: 0,
  callback_function: () => {
    chunks++;
  },
});

console.log("text:", out.text);
console.log("chunks:", JSON.stringify(out.chunks ?? []).slice(0, 500));
console.log("callback chunks:", chunks);
process.exit(0);