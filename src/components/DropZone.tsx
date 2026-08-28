import { useCallback, useRef, useState } from "react";

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export default function DropZone(props: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) props.onFile(f);
    },
    [props]
  );

  return (
    <section
      className={`dropzone ${dragging ? "dragging" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        className="file-input"
        accept="audio/*,video/*,.m4a,.mp4,.mov,.mkv,.webm,.ogg,.wav,.mp3,.flac,.aac"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) props.onFile(f);
          e.target.value = "";
        }}
      />
      {props.disabled ? (
        <p className="drop-title">Drop your audio or video…</p>
      ) : (
        <p className="drop-title">Drop your audio / video file here</p>
      )}
      <p className="hint">
        MP3 · WAV · M4A · OGG · FLAC · MP4 · MOV · WEBM · MKV — anything your browser can play. Decoded locally,
        nothing is uploaded.
      </p>
    </section>
  );
}