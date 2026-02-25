import { render, screen, fireEvent } from "@testing-library/react";
import AudioPlayer from "./AudioPlayer";
import type { Segment } from "../types";

const segments: Segment[] = [
  { index: 0, start: 0, end: 3, text: "Hello" },
];

test("renders audio element and subtitle area", () => {
  render(<AudioPlayer audioUrl="/api/audio/test" segments={segments} isTranscribing={false} />);
  expect(document.querySelector("audio")).toBeInTheDocument();
  expect(screen.getByRole("region", { name: /audio player/i })).toBeInTheDocument();
});

test("displays correct subtitle on timeupdate", () => {
  render(<AudioPlayer audioUrl="/api/audio/test" segments={segments} isTranscribing={false} />);

  const audio = document.querySelector("audio")!;
  Object.defineProperty(audio, "currentTime", { value: 1.5, configurable: true });
  fireEvent.timeUpdate(audio);

  expect(screen.getByText("Hello")).toBeInTheDocument();
});
