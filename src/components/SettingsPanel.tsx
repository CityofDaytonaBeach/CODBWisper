import type { ModelOption } from "../lib/models";
import { MODELS, BIG_MODELS, DEVICES, LANGUAGES } from "../lib/models";

export type ModelStatus = "idle" | "loading" | "ready" | "error";

interface Props {
  modelStatus: ModelStatus;
  model: ModelOption;
  onModelChange: (m: ModelOption) => void;
  device: "webgpu" | "wasm";
  onDeviceChange: (d: "webgpu" | "wasm") => void;
  language: string;
  onLanguageChange: (l: string) => void;
  onLoad: () => void;
  modelProgress: { percent: number; file?: string | undefined } | null;
  logs: string[];
  webgpuAvailable: boolean;
}

function allModels(): Array<ModelOption | "divider"> {
  return [...MODELS, "divider", ...BIG_MODELS];
}

export default function SettingsPanel(props: Props) {
  const { modelStatus, model, device, language, modelProgress, logs, webgpuAvailable } = props;
  const busy = modelStatus === "loading";

  return (
    <section className="panel">
      <h2>1 · Model</h2>
      <label className="field">
        <span>Whisper model</span>
        <select
          value={model.id}
          disabled={busy}
          onChange={(e) => {
            const id = e.target.value;
            const found = allModels().find((m) => m !== "divider" && m.id === id) as ModelOption | undefined;
            if (found) props.onModelChange(found);
          }}
        >
          <optgroup label="Standard (fast, smaller download)">
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} · {m.size}
              </option>
            ))}
          </optgroup>
          <optgroup label="Large (slow, big download)">
            {BIG_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} · {m.size}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <label className="field">
        <span>Device</span>
        <select
          value={device}
          disabled={busy}
          onChange={(e) => props.onDeviceChange(e.target.value as "webgpu" | "wasm")}
        >
          {DEVICES.map((d) => (
            <option key={d.id} value={d.id} disabled={d.id === "webgpu" && !webgpuAvailable}>
              {d.label}
            </option>
          ))}
        </select>
        {!webgpuAvailable && <small className="hint">WebGPU isn't available in this browser, so WASM will be used.</small>}
      </label>

      <label className="field">
        <span>Language</span>
        <select value={language} disabled={busy} onChange={(e) => props.onLanguageChange(e.target.value)}>
          {LANGUAGES.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <small className="hint">"Auto-detect" works best with multilingual models.</small>
      </label>

      <button className="btn primary" onClick={props.onLoad} disabled={busy}>
        {busy ? "Loading model…" : modelStatus === "ready" ? "Reload model" : "Load model"}
      </button>

      {busy && modelProgress && (
        <div className="progress-block">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, modelProgress.percent ?? 0))}%` }} />
          </div>
          <div className="progress-row">
            <small>Downloading model ({Math.round(modelProgress.percent ?? 0)}%)</small>
            {modelProgress.file && <small className="hint">{modelProgress.file}</small>}
          </div>
        </div>
      )}

      {modelStatus === "ready" && <p className="ok">Model ready.</p>}
      {modelStatus === "error" && <p className="err">Model failed to load. See logs.</p>}

      {logs.length > 0 && (
        <details className="logs">
          <summary>Logs</summary>
          <pre>{logs.join("\n")}</pre>
        </details>
      )}

      <p className="hint note">
        Models are cached in your browser after the first download, so later runs work fully offline. For a
        zero-download setup, drop the model files under <code>public/models/</code> and they'll be loaded from
        your own copy.
      </p>
    </section>
  );
}