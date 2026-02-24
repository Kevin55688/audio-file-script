import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AudioUploader from "./AudioUploader";

const mockOnUploaded = vi.fn();

beforeEach(() => {
  mockOnUploaded.mockClear();
});

test("renders upload area with label", () => {
  render(<AudioUploader onUploaded={mockOnUploaded} />);
  expect(screen.getByText(/上傳音檔/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/選擇音檔/i)).toBeInTheDocument();
});

test("calls onUploaded with task_id and audio_url after successful upload", async () => {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ task_id: "abc-123", audio_url: "/api/audio/abc-123" }),
  } as Response);

  render(<AudioUploader onUploaded={mockOnUploaded} />);

  const file = new File(["content"], "test.mp3", { type: "audio/mpeg" });
  await userEvent.upload(screen.getByLabelText(/選擇音檔/i), file);

  expect(global.fetch).toHaveBeenCalledWith(
    "/api/upload",
    expect.objectContaining({ method: "POST" })
  );
  expect(mockOnUploaded).toHaveBeenCalledWith("abc-123", "/api/audio/abc-123");
});

test("shows error message when upload fails", async () => {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: false,
    json: async () => ({ detail: "格式不支援" }),
  } as Response);

  render(<AudioUploader onUploaded={mockOnUploaded} />);

  const file = new File(["content"], "test.txt", { type: "text/plain" });
  await userEvent.upload(screen.getByLabelText(/選擇音檔/i), file);

  expect(await screen.findByText(/上傳失敗/i)).toBeInTheDocument();
});
