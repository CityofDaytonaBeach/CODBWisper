export interface Segment {
  start: number;
  end: number;
  text: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

export function formatClock(seconds: number, msSep = ","): string {
  const s = Math.max(0, Math.floor(seconds));
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}${msSep}${pad3(ms)}`;
}

export function formatHMS(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(sec)}` : `${pad2(m)}:${pad2(sec)}`;
}

export function toSRT(segments: Segment[]): string {
  return segments
    .map((seg, i) => {
      return `${i + 1}\n${formatClock(seg.start)} --> ${formatClock(seg.end)}\n${seg.text.trim()}\n`;
    })
    .join("\n");
}

export function toVTT(segments: Segment[]): string {
  const body = segments
    .map((seg) => {
      return `${formatClock(seg.start, ".")} --> ${formatClock(seg.end, ".")}\n${seg.text.trim()}\n`;
    })
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

export function toPlainText(segments: Segment[]): string {
  return segments.map((s) => s.text.trim()).join("\n");
}

export function toJSON(segments: Segment[]): string {
  return JSON.stringify(segments, null, 2);
}

export function downloadText(filename: string, content: string, mime = "text/plain"): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}