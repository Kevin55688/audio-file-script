import { useState, useEffect } from "react";
import type { Segment } from "../types";

interface TranscriptionState {
  segments: Segment[];
  isTranscribing: boolean;
  error: string | null;
}

export function useTranscription(taskId: string | null): TranscriptionState {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setIsTranscribing(false);
      return;
    }

    setSegments([]);
    setIsTranscribing(true);
    setError(null);

    const source = new EventSource(`/api/transcribe/${taskId}`);

    source.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.status === "done") {
        setIsTranscribing(false);
        source.close();
      } else if (data.status === "error") {
        setError(data.message);
        setIsTranscribing(false);
        source.close();
      } else {
        setSegments((prev) => [...prev, data as Segment]);
      }
    };

    source.onerror = () => {
      setError("連線中斷，請重新整理");
      setIsTranscribing(false);
      source.close();
    };

    return () => {
      source.close();
    };
  }, [taskId]);

  return { segments, isTranscribing, error };
}
