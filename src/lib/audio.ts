import { toMono16k, TARGET_RATE } from "./resampler";

export interface PCMData {
  samples: Float32Array;
  sampleRate: number;
}

const WORKLET_SRC = String.raw`class PCMCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunks = [];
    this.len = 0;
    this.port.onmessage = (e) => {
      if (e.data.type === "flush") {
        const out = new Float32Array(this.len);
        let o = 0;
        for (const c of this.chunks) {
          out.set(c, o);
          o += c.length;
        }
        this.port.postMessage({ type: "frames", data: out }, [out.buffer]);
      }
    };
  }
  process(inputs) {
    const chans = inputs[0];
    if (chans && chans.length > 0) {
      const n = chans[0].length;
      if (n > 0) {
        const nc = chans.length;
        const mono = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          let s = 0;
          for (let c = 0; c < nc; c++) s += chans[c][i];
          mono[i] = s / nc;
        }
        this.chunks.push(mono);
        this.len += n;
        if (this.chunks.length > 128) {
          const merged = new Float32Array(this.len);
          let o = 0;
          for (const c of this.chunks) { merged.set(c, o); o += c.length; }
          this.chunks = [merged];
        }
      }
    }
    return true;
  }
}
registerProcessor("pcm-capture", PCMCapture);`;

function pcmFromAudioBuffer(buf: AudioBuffer): PCMData {
  const channels: Float32Array[] = [];
  for (let c = 0; c < buf.numberOfChannels; c++) {
    channels.push(buf.getChannelData(c));
  }
  return { samples: toMono16k(channels, buf.sampleRate), sampleRate: TARGET_RATE };
}

export async function decodeAudioBufferToPcm(buf: AudioBuffer): Promise<PCMData> {
  return pcmFromAudioBuffer(buf);
}

/**
 * Decode any browser-playable media (audio or video container) into 16 kHz
 * mono Float32 PCM, entirely client-side.
 *
 * Strategy:
 *  1. AudioContext.decodeAudioData — covers wav/mp3/m4a/aac/ogg/flac and some videos.
 *  2. AudioWorklet capture of a muted <audio> element — covers any container
 *     (mp4/mov/webm/…) the browser's media stack can decode.
 */
export async function decodeBlobToPcm(blob: Blob): Promise<PCMData> {
  // Created synchronously (called from a click/drop handler) so the context
  // starts running instead of being autoplay-blocked. It is reused by the
  // element-capture fallback below.
  const ac = new AudioContext({ sampleRate: TARGET_RATE });
  try {
    const buf = await ac.decodeAudioData(await blob.arrayBuffer());
    const pcm = pcmFromAudioBuffer(buf);
    void ac.close();
    return pcm;
  } catch {
    // fall through to element capture (ac stays open and is closed there)
  }

  if (typeof AudioWorkletNode === "undefined") {
    void ac.close();
    throw new Error(
      "This browser cannot decode this file. Try an audio file or use Chrome/Edge/Firefox."
    );
  }

  return captureViaMediaElement(blob, ac);
}

function captureViaMediaElement(blob: Blob, ac: AudioContext): Promise<PCMData> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const el = document.createElement("audio");
    el.src = url;
    el.preload = "auto";
    el.volume = 0;
    el.muted = false;

    let src: MediaElementAudioSourceNode | null = null;
    let node: AudioWorkletNode | null = null;
    let started = false;
    let settled = false;

    const timeout = window.setTimeout(() => {
      fail(new Error("Decoding timed out."));
    }, 180_000);

    function done(data: PCMData) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      cleanup();
      resolve(data);
    }

    function fail(err: unknown) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    }

    function cleanup() {
      try {
        node?.port?.close();
      } catch {
        /* noop */
      }
      try {
        node?.disconnect();
      } catch {
        /* noop */
      }
      try {
        src?.disconnect();
      } catch {
        /* noop */
      }
      try {
        void ac.close();
      } catch {
        /* noop */
      }
      URL.revokeObjectURL(url);
    }

    const resume = ac.state !== "running" ? ac.resume().catch(() => undefined) : Promise.resolve();
    resume.then(() => {
      if (ac.state !== "running") {
        fail(new Error("Audio context could not start."));
        return;
      }

      const workletUrl = URL.createObjectURL(
        new Blob([WORKLET_SRC], { type: "application/javascript" })
      );
      ac.audioWorklet
        .addModule(workletUrl)
        .catch((e) => fail(e))
        .then(() => {
          if (settled) return;
          src = ac.createMediaElementSource(el);
          node = new AudioWorkletNode(ac, "pcm-capture", {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [1],
          });
          src.connect(node);
          node.connect(ac.destination);
          node.port.onmessage = (ev) => {
            if (ev.data.type === "frames" && ev.data.data) {
              done({ samples: ev.data.data as Float32Array, sampleRate: ac.sampleRate });
            }
          };
          el.onended = () => {
            if (settled) return;
            if (started) {
              node?.port.postMessage({ type: "flush" });
            } else {
              fail(new Error("Playback ended before any audio was captured."));
            }
          };
          el.onerror = () => fail(new Error("Browser could not decode this media container."));
          const begin = async () => {
            try {
              await el.play();
              started = true;
            } catch (e) {
              fail(e);
            }
          };
          if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
            void begin();
          } else {
            el.oncanplay = () => void begin();
          }
        })
        .finally(() => URL.revokeObjectURL(workletUrl));
    });
  });
}

/** Read a File/Blob to ArrayBuffer. */
export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}