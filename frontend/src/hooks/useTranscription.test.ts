import { renderHook, act } from "@testing-library/react";
import { useTranscription } from "./useTranscription";

class MockEventSource {
  static instances: MockEventSource[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  url: string;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  emit(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

beforeEach(() => {
  MockEventSource.instances = [];
  (global as any).EventSource = MockEventSource;
});

test("starts with empty segments and not transcribing when taskId is null", () => {
  const { result } = renderHook(() => useTranscription(null));
  expect(result.current.segments).toEqual([]);
  expect(result.current.isTranscribing).toBe(false);
});

test("sets isTranscribing to true when taskId is provided", () => {
  const { result } = renderHook(() => useTranscription("task-123"));
  expect(result.current.isTranscribing).toBe(true);
});

test("accumulates segments from SSE events", () => {
  const { result } = renderHook(() => useTranscription("task-123"));

  act(() => {
    MockEventSource.instances[0].emit({ index: 0, start: 0, end: 3, text: "Hello" });
  });
  act(() => {
    MockEventSource.instances[0].emit({ index: 1, start: 3, end: 6, text: "World" });
  });

  expect(result.current.segments).toHaveLength(2);
  expect(result.current.segments[0].text).toBe("Hello");
});

test("sets isTranscribing to false on done event", () => {
  const { result } = renderHook(() => useTranscription("task-123"));

  act(() => {
    MockEventSource.instances[0].emit({ status: "done" });
  });

  expect(result.current.isTranscribing).toBe(false);
});

test("closes EventSource when taskId becomes null", () => {
  const { rerender } = renderHook(({ id }) => useTranscription(id), {
    initialProps: { id: "task-123" as string | null },
  });

  const source = MockEventSource.instances[0];
  rerender({ id: null });

  expect(source.closed).toBe(true);
});
