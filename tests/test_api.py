from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "Active"

def test_prediction_endpoint():
    payload = {
        "zone_name": "Turn 4",
        "time_start": 520.5,
        "speed_start": 285.0
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "predicted_speed_delta" in data
    assert "predicted_speed_end" in data