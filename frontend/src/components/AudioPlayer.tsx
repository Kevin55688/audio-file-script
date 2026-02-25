import { useRef, useState } from "react";
import type { Segment } from "../types";
import SubtitleDisplay from "./SubtitleDisplay";

interface Props {
  audioUrl: string;
  segments: Segment[];
  isTranscribing: boolean;
}

export default function AudioPlayer({ audioUrl, segments, isTranscribing }: Props) {
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleTimeUpdate = () => {
    setCurrentTime(audioRef.current?.currentTime ?? 0);
  };

  return (
    <div
      aria-label="audio player"
      role="region"
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: "#1A1814" }}
    >
      {/* 琥珀金頂邊線 */}
      <div
        aria-hidden="true"
        style={{ height: "1px", backgroundColor: "rgba(232,168,68,0.25)" }}
      />
      {/* 播放器區 */}
      <div className="px-4 pt-4 pb-2">
        <audio
          ref={audioRef}
          src={audioUrl}
          controls
          onTimeUpdate={handleTimeUpdate}
          className="w-full"
        />
      </div>
      {/* 字幕區 */}
      <SubtitleDisplay
        segments={segments}
        currentTime={currentTime}
        isTranscribing={isTranscribing}
      />
    </div>
  );
}
