import { useState } from "react";
import { flushSync } from "react-dom";

interface Props {
  onUploaded: (taskId: string, audioUrl: string) => void;
}

const BAR_HEIGHTS = [20, 45, 70, 55, 85, 40, 65, 50, 75, 35, 60, 30];

function WaveBars({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="flex items-end justify-center gap-[3px] mb-6"
      style={{ height: "2.5rem" }}
    >
      {BAR_HEIGHTS.map((maxH, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full"
          style={{
            height: active ? `${maxH}%` : "12%",
            background: active
              ? `rgba(232, 168, 68, ${0.35 + (maxH / 100) * 0.65})`
              : "rgba(232, 168, 68, 0.22)",
            transformOrigin: "bottom",
            animation: active ? `wave 0.85s ease-in-out ${i * 0.07}s infinite` : "none",
            transition: "height 0.35s ease, background 0.35s ease",
          }}
        />
      ))}
    </div>
  );
}

export default function AudioUploader({ onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      flushSync(() => setError(`上傳失敗：${data.detail ?? "未知錯誤"}`));
      return;
    }

    onUploaded(data.task_id, data.audio_url);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const input = document.getElementById("audio-input") as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(file);
    if (input) {
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className="rounded-xl border text-center p-10 transition-all duration-200"
      style={{
        backgroundColor: "#1A1814",
        borderColor: dragging ? "#E8A844" : "#2A2720",
        boxShadow: dragging ? "0 0 32px rgba(232,168,68,0.1)" : "none",
      }}
    >
      <WaveBars active={uploading || dragging} />

      <p
        className="mb-1 font-medium"
        style={{ fontFamily: "'Outfit', system-ui, sans-serif", color: "#F0EBE0" }}
      >
        上傳音檔
      </p>
      <p
        className="mb-6 text-sm"
        style={{ fontFamily: "'Outfit', system-ui, sans-serif", color: "#857E68" }}
      >
        拖曳檔案至此，或選擇 MP3 / WAV
      </p>

      <label
        htmlFor="audio-input"
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 select-none"
        style={{
          fontFamily: "'Outfit', system-ui, sans-serif",
          backgroundColor: "#E8A844",
          color: "#0E0D0B",
          cursor: uploading ? "not-allowed" : "pointer",
          opacity: uploading ? 0.6 : 1,
        }}
      >
        選擇音檔
      </label>
      <input
        id="audio-input"
        type="file"
        onChange={handleChange}
        disabled={uploading}
        className="hidden"
      />

      {uploading && (
        <p
          className="mt-4 text-sm"
          style={{ fontFamily: "'Outfit', system-ui, sans-serif", color: "#857E68" }}
        >
          上傳中...
        </p>
      )}
      {error && (
        <p
          className="mt-4 text-sm"
          style={{ fontFamily: "'Outfit', system-ui, sans-serif", color: "#C44444" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
