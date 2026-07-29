import pytest
from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)

def test_get_events():
    response = client.get("/events")
    assert response.status_code == 200
    data = response.json()
    assert "events" in data
    assert len(data["events"]) > 0
    # Ensure race sessions only
    for event in data["events"]:
        assert event["session_type"] == "R"
        assert event["round_number"] > 0

def test_get_replay_and_leaderboard():
    response_replay = client.get("/events/1/replay")
    assert response_replay.status_code == 200
    replay_data = response_replay.json()
    assert "track_outline" in replay_data
    assert "driver_metadata" in replay_data
    assert "timestamps" in replay_data
    assert "frames" in replay_data
    assert len(replay_data["frames"]) > 0

    response_lb = client.get("/events/1/leaderboard")
    assert response_lb.status_code == 200
    lb_data = response_lb.json()
    assert "timestamps" in lb_data
    assert "frames" in lb_data
    assert len(lb_data["frames"]) > 0
    assert len(lb_data["frames"][0]["leaderboard"]) > 0
