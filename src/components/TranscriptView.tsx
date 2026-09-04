import { useMemo, useState } from "react";
import type { Segment } from "../lib/formatters";
import { formatHMS, toSRT, toVTT, toPlainText, toJSON, downloadText } from "../lib/formatters";

export interface TranscriptionResult {
  text: string;
  segments: Segment[];
  language?: string;
}

interface Props {
  result: TranscriptionResult;
  onSeek: (t: number) => void;
  filename: string;
}

type Tab = "segments" | "text" | "srt" | "vtt" | "json";

interface Touched {
  item: string;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "segments", label: "Timeline" },
  { id: "text", label: "Text" },
  { id: "srt", label: "SRT" },
  { id: "vtt", label: "VTT" },
  { id: "json", label: "JSON" },
];

function highlight(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function TranscriptView(props: Props) {
  const { result, onSeek, filename } = props;
  const [tab, setTab] = useState<Tab>("segments");
  const [query, setQuery] = useState("");
  const [touched, setTouched] = useState<Touched | null>(null);

  const base = filename.replace(/\.[^.]+$/, "") || "transcript";

  const srt = useMemo(() => toSRT(result.segments), [result.segments]);
  const vtt = useMemo(() => toVTT(result.segments), [result.segments]);
  const text = useMemo(() => toPlainText(result.segments), [result.segments]);
  const json = useMemo(() => toJSON(result.segments), [result.segments]);

  const filtered = useMemo(() => {
    if (!query.trim()) return result.segments;
    const q = query.trim().toLowerCase();
    return result.segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [result.segments, query]);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setTouched({ item: label });
      window.setTimeout(() => setTouched(null), 1500);
    } catch {
      setTouched({ item: `${label} (copy blocked — use download)` });
      window.setTimeout(() => setTouched(null), 3000);
    }
  };

  return (
    <section className="panel transcript">
      <div className="trans-head">
        <h2>Transcript</h2>
        <div className="toolbar">
          <input
            className="search"
            placeholder="Search transcript…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search transcript"
          />
          <button
            className="btn"
            onClick={() => copy(tab === "srt" ? srt : tab === "vtt" ? vtt : tab === "json" ? json : text, tab)}
            disabled={result.segments.length === 0}
            aria-label={`Copy ${tab} to clipboard`}
          >
            {touched?.item === tab ? "Copied ✓" : "Copy"}
          </button>
          <button
            className="btn"
            onClick={() => downloadText(`${base}.${tab === "json" ? "json" : tab === "text" ? "txt" : tab}`, tab === "srt" ? srt : tab === "vtt" ? vtt : tab === "json" ? json : text, tab === "json" ? "application/json" : tab === "vtt" ? "text/vtt" : "text/plain")}
            disabled={result.segments.length === 0}
            aria-label={`Download ${tab} file`}
          >
            Download
          </button>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
          >
            {t.label}
            {t.id === "segments" && query && filtered.length !== result.segments.length ? (
              <span className="count">{filtered.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "segments" && (
        <ul className="segments" role="tabpanel" id="panel-segments">
          {filtered.length === 0 && <li className="empty">No matching segments.</li>}
          {filtered.map((seg, i) => (
            <li key={i}>
              <button
                className="seg-time"
                onClick={() => onSeek(seg.start)}
                title="Jump to this moment"
                aria-label={`Jump to ${formatHMS(seg.start)}`}
              >
                {formatHMS(seg.start)}
              </button>
              <span className="seg-text">{highlight(seg.text, query.trim())}</span>
            </li>
          ))}
        </ul>
      )}

      {tab === "text" && <pre className="code">{text}</pre>}
      {tab === "srt" && <pre className="code">{srt}</pre>}
      {tab === "vtt" && <pre className="code">{vtt}</pre>}
      {tab === "json" && <pre className="code">{json}</pre>}

      <p className="hint">
        {result.segments.length} segments · {result.language ? `detected language: ${result.language}` : ""}
      </p>
    </section>
  );
}