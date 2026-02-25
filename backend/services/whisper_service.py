from typing import Generator
from faster_whisper import WhisperModel

# 首次執行時自動下載模型（約 500MB），後續快取在本機
model = WhisperModel("small", device="cpu", compute_type="int8")


def transcribe_audio(file_path: str) -> Generator[dict, None, None]:
    segments, _ = model.transcribe(file_path)
    for segment in segments:
        yield {
            "index": segment.id,
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
            "text": segment.text.strip(),
        }
