/// <reference lib="webworker" />

import { env, pipeline } from "@huggingface/transformers";
import type { AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

env.useBrowserCache = true;
env.allowLocalModels = false;

let asr: AutomaticSpeechRecognitionPipeline | null = null;

interface ASROutput {
  text: string;
  chunks?: Array<{ timestamp?: [number, number]; text: string }>;
  language?: string;
}

function post(msg: unknown, transfer?: Transferable[]): void {
  (self as unknown as Worker).postMessage(msg, transfer ?? []);
}

self.onmessage = async (ev: MessageEvent) => {
  const msg = ev.data;
  if (msg.type === "load") {
    const attempts: Array<"webgpu" | "wasm"> = msg.device === "webgpu" ? ["webgpu", "wasm"] : ["wasm"];
    for (const d of attempts) {
      try {
        const pipe = pipeline as unknown as (
          task: string,
          model: string,
          opts?: Record<string, unknown>,
        ) => Promise<AutomaticSpeechRecognitionPipeline>;
        asr = await pipe("automatic-speech-recognition", msg.model, {
          device: d,
          dtype: d === "webgpu" ? "fp32" : undefined,
          progress_callback: (p: { status?: string; file?: string; progress?: number }) =>
            post({ type: "model-progress", status: p.status, file: p.file, progress: p.progress }),
        });
        post({ type: "ready", device: d, model: msg.model });
        return;
      } catch (err) {
        post({ type: "log", message: `Loading on "${d}" failed: ${String(err)}` });
      }
    }
    post({ type: "error", message: "Model failed to load on every available device." });
  } else if (msg.type === "transcribe" && asr) {
    try {
      const options: Record<string, unknown> = {
        task: "transcribe",
        return_timestamps: true,
        chunk_length_s: msg.chunkLength ?? 30,
        stride_length_s: msg.strideLength ?? 5,
        callback_function: () => post({ type: "chunk-done" }),
      };
      if (msg.language && msg.language !== "") {
        options.language = msg.language;
      }

      const raw = await asr(msg.pcm as Float32Array, options);
      const output: ASROutput = Array.isArray(raw) ? (raw[0] as ASROutput) : (raw as ASROutput);
      const text: string = typeof output.text === "string" ? output.text : "";
      const rawChunks = output.chunks ?? [];

      const chunks = rawChunks
        .map((c) => ({ start: +(c.timestamp?.[0] ?? 0), end: +(c.timestamp?.[1] ?? 0), text: c.text.trim() }))
        .filter((c) => c.text.length > 0);

      post({ type: "result", text, chunks, language: output.language });
    } catch (err) {
      post({ type: "error", message: `Transcription failed: ${String(err)}` });
    }
  }
};