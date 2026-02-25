import io
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_upload_mp3_success():
    fake_mp3 = io.BytesIO(b"fake mp3 content")
    response = client.post(
        "/api/upload",
        files={"file": ("test.mp3", fake_mp3, "audio/mpeg")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "task_id" in data
    assert "audio_url" in data
    assert data["audio_url"].startswith("/api/audio/")


def test_upload_wav_success():
    fake_wav = io.BytesIO(b"fake wav content")
    response = client.post(
        "/api/upload",
        files={"file": ("test.wav", fake_wav, "audio/wav")},
    )
    assert response.status_code == 200


def test_upload_invalid_format():
    fake_txt = io.BytesIO(b"not audio")
    response = client.post(
        "/api/upload",
        files={"file": ("test.txt", fake_txt, "text/plain")},
    )
    assert response.status_code == 422


def test_serve_audio_not_found():
    response = client.get("/api/audio/nonexistent-task-id")
    assert response.status_code == 404
