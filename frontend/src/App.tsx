import { useState } from "react";
import AudioUploader from "./components/AudioUploader";
import AudioPlayer from "./components/AudioPlayer";
import { useTranscription } from "./hooks/useTranscription";

export default function App() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { segments, isTranscribing, error } = useTranscription(taskId);

  const handleUploaded = (id: string, url: string) => {
    setTaskId(id);
    setAudioUrl(url);
  };

  return (
    <div
      style={{ backgroundColor: "#0E0D0B", minHeight: "100vh" }}
      className="px-6 py-12"
    >
      {/* 噪點肌理疊層 */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div className="relative max-w-2xl mx-auto" style={{ zIndex: 1 }}>
        {/* 頁首 */}
        <header className="mb-10">
          <div
            aria-hidden="true"
            className="mb-4"
            style={{ height: "1px", backgroundColor: "rgba(232,168,68,0.3)" }}
          />
          <h1
            style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              color: "#F0EBE0",
              fontSize: "1.75rem",
              letterSpacing: "-0.01em",
            }}
          >
            音檔字幕播放器
          </h1>
          <p
            style={{
              fontFamily: "'Outfit', system-ui, sans-serif",
              color: "#857E68",
              fontSize: "0.875rem",
              marginTop: "0.375rem",
            }}
          >
            上傳音檔，自動生成同步字幕
          </p>
        </header>

        {/* 上傳區 */}
        <AudioUploader onUploaded={handleUploaded} />

        {/* 轉錄錯誤 */}
        {error && (
          <p
            className="mb-4 text-sm"
            style={{
              fontFamily: "'Outfit', system-ui, sans-serif",
              color: "#C44444",
            }}
          >
            轉錄錯誤：{error}
          </p>
        )}

        {/* 播放器（上傳成功後顯示） */}
        {audioUrl && (
          <div className="mt-6">
            <AudioPlayer
              audioUrl={audioUrl}
              segments={segments}
              isTranscribing={isTranscribing}
            />
          </div>
        )}
      </div>
    </div>
  );
}
