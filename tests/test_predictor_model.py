import os
import joblib
import pytest
from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)

def test_model_artifact_exists():
    model_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src", "ml", "models", "championship_predictor.joblib"))
    assert os.path.exists(model_path), f"Model artifact should exist at {model_path}"
    
    artifact = joblib.load(model_path)
    assert "win_model" in artifact
    assert "top10_model" in artifact
    assert "feature_cols" in artifact
    assert "algorithm" in artifact
    assert "metrics" in artifact
    assert "brier_win" in artifact["metrics"]
    assert "brier_top10" in artifact["metrics"]

def test_next_race_endpoint():
    response = client.get("/predictions/next-race?as_of_round=5")
    assert response.status_code == 200
    data = response.json()
    assert "data_cutoff" in data
    assert "As of 2026 Round 5" in data["data_cutoff"]
    assert "next_race" in data
    assert "predictions" in data
    assert len(data["predictions"]) > 0
    
    # Check probability structure
    p0 = data["predictions"][0]
    assert "abbr" in p0
    assert "win_probability" in p0
    assert "points_probability" in p0
    assert 0 <= p0["win_probability"] <= 100
    assert 0 <= p0["points_probability"] <= 100

def test_drivers_championship_endpoint():
    response = client.get("/predictions/drivers-championship?as_of_round=5")
    assert response.status_code == 200
    data = response.json()
    assert "data_cutoff" in data
    assert "drivers" in data
    assert "championship_trend" in data
    assert len(data["championship_trend"]) == 5

def test_constructors_championship_endpoint():
    response = client.get("/predictions/constructors-championship?as_of_round=5")
    assert response.status_code == 200
    data = response.json()
    assert "data_cutoff" in data
    assert "constructors" in data
    assert "championship_trend" in data
    assert len(data["constructors"]) > 0
