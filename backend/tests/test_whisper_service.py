from unittest.mock import MagicMock, patch
from services.whisper_service import transcribe_audio


def _make_segment(id, start, end, text):
    seg = MagicMock()
    seg.id = id
    seg.start = start
    seg.end = end
    seg.text = f"  {text}  "
    return seg


@patch("services.whisper_service.model")
def test_transcribe_yields_segments(mock_model):
    mock_segments = [
        _make_segment(0, 0.0, 3.5, "Hello world"),
        _make_segment(1, 3.5, 7.0, "Second segment"),
    ]
    mock_model.transcribe.return_value = (iter(mock_segments), MagicMock())

    results = list(transcribe_audio("fake_path.mp3"))

    assert len(results) == 2
    assert results[0] == {"index": 0, "start": 0.0, "end": 3.5, "text": "Hello world"}
    assert results[1] == {"index": 1, "start": 3.5, "end": 7.0, "text": "Second segment"}


@patch("services.whisper_service.model")
def test_transcribe_strips_whitespace(mock_model):
    mock_segments = [_make_segment(0, 0.0, 2.0, "有空格")]
    mock_model.transcribe.return_value = (iter(mock_segments), MagicMock())

    results = list(transcribe_audio("fake.mp3"))

    assert results[0]["text"] == "有空格"


@patch("services.whisper_service.model")
def test_transcribe_rounds_timestamps(mock_model):
    seg = _make_segment(0, 1.23456, 4.56789, "精度測試")
    mock_model.transcribe.return_value = (iter([seg]), MagicMock())

    results = list(transcribe_audio("fake.mp3"))

    assert results[0]["start"] == 1.23
    assert results[0]["end"] == 4.57
