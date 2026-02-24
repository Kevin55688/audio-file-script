import type { Segment } from "../types";

interface Props {
  segments: Segment[];
  currentTime: number;
  isTranscribing: boolean;
}

export default function SubtitleDisplay({ segments, currentTime, isTranscribing }: Props) {
  const active = segments.find((s) => currentTime >= s.start && currentTime <= s.end);
  const text = active ? active.text : isTranscribing ? "轉錄中..." : "";

  return (
    <div
      className="relative rounded-xl overflow-hidden border border-groove"
      style={{ minHeight: "7rem", backgroundColor: "#0E0D0B" }}
    >
      {/* Scanline overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.015) 3px, rgba(255,255,255,0.015) 4px)",
          zIndex: 1,
        }}
      />
      {/* Top amber edge */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px"
        style={{ backgroundColor: "rgba(232,168,68,0.25)", zIndex: 2 }}
      />
      {/* Subtitle text */}
      <div className="relative flex items-center justify-center px-8 py-8 min-h-28" style={{ zIndex: 3 }}>
        <p
          className="text-center leading-relaxed"
          style={{
            fontFamily: "'Space Mono', 'Courier New', monospace",
            fontSize: "1.125rem",
            color: active ? "#F0EBE0" : isTranscribing ? "#B37E2A" : "transparent",
            transition: "color 0.3s ease",
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}
