import pytest
import os
import joblib
from fastapi.testclient import TestClient
from src.api.main import app
from src.ml.dataset_builder import build_anti_leakage_dataset

client = TestClient(app)

def test_anti_leakage_dataset_structure():
    df = build_anti_leakage_dataset(seasons=[2023])
    assert not df.empty
    assert "grid_position" in df.columns
    assert "driver_rolling_pos_mean" in df.columns
    assert "driver_rolling_pts_mean" in df.columns
    assert "reliability_dnf_rate" in df.columns
    assert "finish_position" in df.columns
    assert "is_win" in df.columns
    assert "is_top10" in df.columns
    # Ensure targets are not in predictor feature set
    for row in df.iterrows():
        assert row[1]["finish_position"] >= 1

def test_model_artifact_exists_and_calibrated():
    model_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src", "ml", "models", "championship_predictor.joblib"))
    assert os.path.exists(model_path), f"Model artifact file must exist at {model_path}"

    
    artifact = joblib.load(model_path)
    assert "win_model" in artifact
    assert "top10_model" in artifact
    assert "feature_cols" in artifact
    assert "metrics" in artifact
    
    metrics = artifact["metrics"]
    assert metrics["brier_win"] < 0.10, "Win Brier score should be well calibrated (< 0.10)"
    assert metrics["brier_top10"] < 0.20, "Top-10 Brier score should be well calibrated (< 0.20)"

def test_predictions_next_race_endpoint():
    response = client.get("/predictions/next-race?as_of_round=5")
    assert response.status_code == 200
    data = response.json()
    assert "data_cutoff" in data
    assert "As of 2026 Round 5" in data["data_cutoff"]
    assert "predictions" in data
    assert len(data["predictions"]) > 0
    
    first_driver = data["predictions"][0]
    assert "abbr" in first_driver
    assert "win_probability" in first_driver
    assert "top10_probability" in first_driver

def test_predictions_drivers_championship_endpoint():
    response = client.get("/predictions/drivers-championship?as_of_round=5")
    assert response.status_code == 200
    data = response.json()
    assert "data_cutoff" in data
    assert "drivers" in data
    assert "championship_trend" in data
    assert len(data["championship_trend"]) == 5

def test_predictions_constructors_championship_endpoint():
    response = client.get("/predictions/constructors-championship?as_of_round=5")
    assert response.status_code == 200
    data = response.json()
    assert "data_cutoff" in data
    assert "constructors" in data
    assert len(data["constructors"]) > 0
    assert "championship_probability" in data["constructors"][0]
