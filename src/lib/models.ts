export interface ModelOption {
  id: string;
  label: string;
  size: string;
  multilingual: boolean;
  tag?: string;
}

export const MODELS: ModelOption[] = [
  { id: "onnx-community/whisper-tiny.en", label: "Whisper Tiny", size: "~40 MB", multilingual: false },
  { id: "onnx-community/whisper-base.en", label: "Whisper Base", size: "~75 MB", multilingual: false },
  { id: "onnx-community/whisper-small.en", label: "Whisper Small", size: "~250 MB", multilingual: false },
  { id: "onnx-community/whisper-tiny", label: "Whisper Tiny (multilingual)", size: "~40 MB", multilingual: true },
  { id: "onnx-community/whisper-base", label: "Whisper Base (multilingual)", size: "~75 MB", multilingual: true },
  { id: "onnx-community/whisper-small", label: "Whisper Small (multilingual)", size: "~250 MB", multilingual: true },
];

export const BIG_MODELS: ModelOption[] = [
  { id: "onnx-community/whisper-medium.en", label: "Whisper Medium", size: "~800 MB", multilingual: false, tag: "large, slow" },
  { id: "onnx-community/whisper-medium", label: "Whisper Medium (multilingual)", size: "~800 MB", multilingual: true, tag: "large, slow" },
  { id: "onnx-community/whisper-large-v3-turbo", label: "Whisper Large v3 Turbo", size: "~1.6 GB", multilingual: true, tag: "very large, slow" },
];

export interface DeviceOption {
  id: "webgpu" | "wasm";
  label: string;
}

export const DEVICES: DeviceOption[] = [
  { id: "webgpu", label: "WebGPU — GPU inference (Chrome/Edge, fast)" },
  { id: "wasm", label: "WASM — CPU inference (universal)" },
];

export const LANGUAGES: Array<[code: string, label: string]> = [
  ["", "Auto-detect"],
  ["en", "English"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["it", "Italian"],
  ["pt", "Portuguese"],
  ["nl", "Dutch"],
  ["ru", "Russian"],
  ["pl", "Polish"],
  ["uk", "Ukrainian"],
  ["tr", "Turkish"],
  ["ar", "Arabic"],
  ["hi", "Hindi"],
  ["zh", "Chinese"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["sv", "Swedish"],
  ["da", "Danish"],
  ["fi", "Finnish"],
  ["no", "Norwegian"],
  ["hu", "Hungarian"],
  ["cs", "Czech"],
  ["el", "Greek"],
  ["he", "Hebrew"],
  ["id", "Indonesian"],
  ["th", "Thai"],
  ["vi", "Vietnamese"],
];

export function isWebGPUSupported(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}