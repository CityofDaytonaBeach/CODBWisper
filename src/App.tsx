import { useCallback, useEffect, useRef, useState } from "react";
import SettingsPanel, { type ModelStatus } from "./components/SettingsPanel";
import DropZone from "./components/DropZone";
import TranscriptView, { type TranscriptionResult } from "./components/TranscriptView";
import { MODELS, BIG_MODELS, isWebGPUSupported, type ModelOption } from "./lib/models";
import { decodeBlobToPcm, type PCMData } from "./lib/audio";

type TranscribeStatus = "idle" | "running" | "done";

interface WorkerInMessage {
  type: "load" | "transcribe";
  [key: string]: unknown;
}

export default function App() {
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [model, setModel] = useState<ModelOption>(MODELS[0]);
  const [device, setDevice] = useState<"webgpu" | "wasm">(isWebGPUSupported() ? "webgpu" : "wasm");
  const [language, setLanguage] = useState("");
  const [modelProgress, setModelProgress] = useState<{ percent: number; file?: string } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [pcm, setPcm] = useState<PCMData | null>(null);
  const [decoding, setDecoding] = useState(false);

  const [transStatus, setTransStatus] = useState<TranscribeStatus>("idle");
  const [transProgress, setTransProgress] = useState(0);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const playbackRef = useRef<HTMLMediaElement | null>(null);
  const chunkCountRef = useRef(0);

  useEffect(() => {
    const worker = new Worker(new URL("./worker/transcription.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (ev) => {
      const msg = ev.data as Record<string, unknown>;
      switch (msg.type) {
        case "model-progress":
          setModelProgress({ percent: typeof msg.progress === "number" ? msg.progress : 0, file: typeof msg.file === "string" ? msg.file : undefined });
          break;
        case "log":
          setLogs((l) => [...l, String(msg.message)]);
          break;
        case "ready":
          setModelStatus("ready");
          setModelProgress({ percent: 100 });
          break;
        case "chunk-done":
          chunkCountRef.current += 1;
          setTransProgress(chunkCountRef.current);
          break;
        case "result":
          setResult({
            text: String(msg.text ?? ""),
            segments: Array.isArray(msg.chunks) ? (msg.chunks as never[]) : [],
            language: typeof msg.language === "string" ? msg.language : undefined,
          });
          setTransStatus("done");
          setError(null);
          break;
        case "error":
          setError(String(msg.message ?? "Unknown worker error"));
          setModelStatus("error");
          setTransStatus("idle");
          break;
      }
    };
    worker.onerror = (e) => {
      setError(`Worker error: ${e.message}`);
      setModelStatus("error");
      setTransStatus("idle");
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const handleModelChange = useCallback((m: ModelOption) => {
    setModel(m);
    if (m.multilingual === false && language && language !== "en") {
      setLanguage("");
    }
  }, [language]);

  const loadModel = useCallback(() => {
    const w = workerRef.current;
    if (!w) return;
    setModelStatus("loading");
    setModelProgress({ percent: 0 });
    setLogs([]);
    setError(null);
    const msg: WorkerInMessage = { type: "load", model: model.id, device };
    w.postMessage(msg);
  }, [model, device]);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setResult(null);
    setTransStatus("idle");
    setError(null);
    setMediaUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
    setDecoding(true);
    setPcm(null);
    try {
      const p = await decodeBlobToPcm(f);
      setPcm(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDecoding(false);
    }
  }, []);

  const transcribe = useCallback(() => {
    const w = workerRef.current;
    if (!w || !pcm || modelStatus !== "ready") return;
    setTransStatus("running");
    setResult(null);
    setError(null);
    chunkCountRef.current = 0;
    setTransProgress(0);
    w.postMessage({ type: "transcribe", pcm: pcm.samples, language, chunkLength: 30, strideLength: 5 });
  }, [pcm, language, modelStatus]);

  const seekTo = useCallback((t: number) => {
    const el = playbackRef.current;
    if (!el) return;
    try {
      el.currentTime = t;
      void el.play().catch(() => undefined);
    } catch {
      /* noop */
    }
  }, []);

  const allModels = [...MODELS, ...BIG_MODELS];
  const selectedIsLarge = allModels.some((m) => m.id === model.id);
  const videoFile = file?.type.startsWith("video/") ?? false;
  const canTranscribe = modelStatus === "ready" && !!pcm && transStatus !== "running";

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          CODB <span>Whisper</span>
        </h1>
        <p>
          Browser-only speech-to-text. No server, no VPS, no API key, no uploads — your audio never leaves this
          machine.
        </p>
      </header>

      <main className="layout">
        <div className="left">
          <SettingsPanel
            modelStatus={modelStatus}
            model={model}
            onModelChange={handleModelChange}
            device={device}
            onDeviceChange={setDevice}
            language={language}
            onLanguageChange={setLanguage}
            onLoad={loadModel}
            modelProgress={modelProgress}
            logs={logs}
            webgpuAvailable={isWebGPUSupported()}
          />

          <section className="panel">
            <h2>2 · Media</h2>
            <DropZone onFile={(f) => void handleFile(f)} />

            {file && (
              <div className="meta">
                <span className="tag">{file.name}</span>
                <span className="hint">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                <span className="hint">{videoFile ? "video" : "audio"}</span>
              </div>
            )}

            {decoding && <p className="hint">Decoding media to 16 kHz PCM…</p>}
            {pcm && <p className="ok">Media decoded locally ({pcm.samples.length.toLocaleString()} samples @16 kHz).</p>}

            {modelStatus !== "ready" && (
              <p className="warn">Load the model first (step 1) before transcribing.</p>
            )}

            <button
              className="btn primary big"
              onClick={transcribe}
              disabled={!canTranscribe}
              title={
                modelStatus !== "ready"
                  ? "Load the model first"
                  : !pcm
                    ? "Drop a media file first"
                    : "Start transcription"
              }
            >
              {transStatus === "running" ? (
                <>
                  <span className="spinner" /> Transcribing…
                </>
              ) : transStatus === "done" ? (
                "Transcribe again"
              ) : (
                "Transcribe"
              )}
            </button>

            {transStatus === "running" && (
              <div className="progress-block">
                <div className="progress-row">
                  <small>Processing chunks… ({Math.max(1, transProgress)} processed)</small>
                  <span className="spinner" />
                </div>
              </div>
            )}

            {error && <p className="err">{error}</p>}
          </section>
        </div>

        <div className="right">
          {file && mediaUrl && (
            <section className="panel">
              <h2>Playback</h2>
              {videoFile ? (
                <video ref={playbackRef as React.Ref<HTMLVideoElement>} src={mediaUrl} controls className="player-video" />
              ) : (
                <audio ref={playbackRef as React.Ref<HTMLAudioElement>} src={mediaUrl} controls className="player-audio" />
              )}
              <p className="hint">Click any timestamp in the transcript to jump the player to that moment.</p>
            </section>
          )}

          {result ? (
            <TranscriptView result={result} onSeek={seekTo} filename={file?.name ?? "transcript"} />
          ) : (
            <section className="panel empty-state">
              <h2>Transcript</h2>
              <p className="hint">
                Pick a model, drop a file, and hit <strong>Transcribe</strong>. Results with timestamps, SRT, VTT and
                JSON appear here.
              </p>
            </section>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <span>100% client-side · Whisper via transformers.js · WebGPU / WASM</span>
        <span>{selectedIsLarge ? "Big model selected — expect a long first load." : ""}</span>
      </footer>
    </div>
  );
}