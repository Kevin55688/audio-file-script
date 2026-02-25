import io
import json
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

MOCK_SEGMENTS = [
    {"index": 0, "start": 0.0, "end": 3.0, "text": "Hello"},
    {"index": 1, "start": 3.0, "end": 6.0, "text": "World"},
]


def _upload_fake_file():
    resp = client.post(
        "/api/upload",
        files={"file": ("test.mp3", io.BytesIO(b"fake"), "audio/mpeg")},
    )
    return resp.json()["task_id"]


@patch("routers.transcribe.transcribe_audio")
def test_sse_streams_segments(mock_transcribe):
    mock_transcribe.return_value = iter(MOCK_SEGMENTS)
    task_id = _upload_fake_file()

    with client.stream("GET", f"/api/transcribe/{task_id}") as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        response.read()
        raw = response.text

    data_lines = [l for l in raw.strip().split("\n") if l.startswith("data:")]
    events = [json.loads(l[5:].strip()) for l in data_lines]

    assert events[0] == MOCK_SEGMENTS[0]
    assert events[1] == MOCK_SEGMENTS[1]
    assert events[-1] == {"status": "done"}


@patch("routers.transcribe.transcribe_audio")
def test_sse_returns_404_for_unknown_task(mock_transcribe):
    response = client.get("/api/transcribe/nonexistent-id")
    assert response.status_code == 404
