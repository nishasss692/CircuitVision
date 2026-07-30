import pytest
from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)

def test_statistical_race_result_query():
    response = client.post("/chat", json={"query": "Who won the Australian GP?"})
    assert response.status_code == 200
    data = response.json()
    assert "George Russell" in data["answer"] or "Russell" in data["answer"]
    assert data["unable_to_answer"] is False
    assert len(data["sources"]) > 0

# --- REGRESSION TEST SUITE FOR ALL COMPLETED 2026 RACES ---

def test_completed_race_r1_australian_gp():
    response = client.post("/chat", json={"query": "What happened at the Australian GP in 2026?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert "George Russell" in data["answer"] or "Mercedes" in data["answer"]

def test_completed_race_r2_chinese_gp():
    response = client.post("/chat", json={"query": "Who won the Chinese Grand Prix in 2026?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert "Verstappen" in data["answer"]
    assert "Chinese" in data["answer"] or "Shanghai" in data["answer"] or "Round 2" in data["answer"]

def test_completed_race_r3_japanese_gp():
    response = client.post("/chat", json={"query": "Who won the Japanese GP at Suzuka?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert "Verstappen" in data["answer"]
    assert "Japanese" in data["answer"] or "Suzuka" in data["answer"] or "Round 3" in data["answer"]

def test_completed_race_r4_bahrain_gp():
    response = client.post("/chat", json={"query": "What was the result of the Bahrain GP?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert "Leclerc" in data["answer"]

def test_completed_race_r5_saudi_gp():
    response = client.post("/chat", json={"query": "Who won the Saudi Arabian Grand Prix?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert "Verstappen" in data["answer"]

# --- RETRIEVAL ACCURACY & MISMATCH SANITY CHECK REGRESSION TESTS ---

def test_belgian_gp_unheld_race_no_mismatched_retrieval():
    """
    Core bug fix verification: Asking about the Belgian GP (or Spa) must NOT return chunks
    from Japanese GP or Australian GP. It must recognize Belgian GP is not in completed data.
    """
    response = client.post("/chat", json={"query": "what happened at the Belgian GP"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is True
    assert "Japanese" not in data["answer"]
    assert "Australian" not in data["answer"]
    assert "Belgian Grand Prix" in data["answer"] or "not taken place" in data["answer"].lower()

def test_spa_alias_unheld_race_query():
    response = client.post("/chat", json={"query": "Who won the race at Spa-Francorchamps?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is True
    assert "Japanese" not in data["answer"]

# --- STANDINGS, REGULATIONS & LINEUP TESTS ---

def test_championship_standings_query():
    response = client.post("/chat", json={"query": "Who is leading the drivers championship?"})
    assert response.status_code == 200
    data = response.json()
    assert "Verstappen" in data["answer"]
    assert data["unable_to_answer"] is False

def test_rules_and_regulations_query():
    response = client.post("/chat", json={"query": "What is Active Aero X-Mode?"})
    assert response.status_code == 200
    data = response.json()
    assert "low drag" in data["answer"].lower() or "straights" in data["answer"].lower()
    assert data["unable_to_answer"] is False

def test_unheld_future_race_out_of_bounds_query():
    response = client.post("/chat", json={"query": "Who won the 2026 Hungarian GP?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is True
    assert "not taken place" in data["answer"].lower() or "not have" in data["answer"].lower()

def test_nonexistent_driver_query():
    response = client.post("/chat", json={"query": "How many points did Porsche driver speedracer score?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is True

