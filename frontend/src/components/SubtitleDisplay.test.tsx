import { render, screen } from "@testing-library/react";
import SubtitleDisplay from "./SubtitleDisplay";
import type { Segment } from "../types";

const segments: Segment[] = [
  { index: 0, start: 0, end: 3, text: "第一段字幕" },
  { index: 1, start: 3, end: 6, text: "第二段字幕" },
];

test("shows active subtitle for current time", () => {
  render(<SubtitleDisplay segments={segments} currentTime={1.5} isTranscribing={false} />);
  expect(screen.getByText("第一段字幕")).toBeInTheDocument();
});

test("shows second subtitle when in range", () => {
  render(<SubtitleDisplay segments={segments} currentTime={4} isTranscribing={false} />);
  expect(screen.getByText("第二段字幕")).toBeInTheDocument();
});

test("shows transcribing indicator when past transcribed range and still transcribing", () => {
  render(<SubtitleDisplay segments={segments} currentTime={10} isTranscribing={true} />);
  expect(screen.getByText("轉錄中...")).toBeInTheDocument();
});

test("shows empty text when no match and transcription done", () => {
  render(<SubtitleDisplay segments={segments} currentTime={10} isTranscribing={false} />);
  expect(screen.getByRole("paragraph").textContent).toBe("");
});
