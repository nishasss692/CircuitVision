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


# --- GENERAL F1 KNOWLEDGE TESTS (no retrieval needed, should always answer) ---

def test_general_what_is_drs():
    """General terminology question - should answer from knowledge base, not refuse."""
    response = client.post("/chat", json={"query": "What is DRS?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert data["answer"]
    ans_lower = data["answer"].lower()
    assert "drag" in ans_lower or "overtaking" in ans_lower or "rear wing" in ans_lower

def test_general_undercut_strategy():
    """Pit strategy terminology question - should answer directly."""
    response = client.post("/chat", json={"query": "What is an undercut in F1?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert data["answer"]
    ans_lower = data["answer"].lower()
    assert "pit" in ans_lower or "tyre" in ans_lower or "tire" in ans_lower or "fresh" in ans_lower

def test_general_parc_ferme():
    """Regulations terminology question - should return parc ferme explanation."""
    response = client.post("/chat", json={"query": "What is Parc Ferme?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert data["answer"]
    ans_lower = data["answer"].lower()
    assert "parc" in ans_lower or "restricted" in ans_lower or "qualifying" in ans_lower or "ferme" in ans_lower

def test_general_active_aero_x_mode():
    """2026-specific regulation question - should explain X-Mode."""
    response = client.post("/chat", json={"query": "Explain X-mode active aerodynamics"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert data["answer"]
    ans_lower = data["answer"].lower()
    assert "drag" in ans_lower or "straight" in ans_lower or "speed" in ans_lower

def test_general_overcut_strategy():
    """Overcut terminology - should return an explanation."""
    response = client.post("/chat", json={"query": "How does the overcut strategy work?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert data["answer"]

def test_general_tyre_compounds():
    """Tyre compound terminology - should return Pirelli explanation."""
    response = client.post("/chat", json={"query": "What are the F1 tyre compounds?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert data["answer"]
    ans_lower = data["answer"].lower()
    assert "pirelli" in ans_lower or "compound" in ans_lower or "soft" in ans_lower or "hard" in ans_lower


# --- CONVERSATIONAL / META TESTS (bypass RAG entirely, should always answer) ---

def test_conversational_hello():
    """Simple greeting - should return a friendly response, not 'unable to answer'."""
    response = client.post("/chat", json={"query": "Hello"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert data["answer"]
    assert len(data["answer"]) > 10

def test_conversational_hi():
    """Single-word greeting."""
    response = client.post("/chat", json={"query": "hi"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert data["answer"]

def test_conversational_what_can_you_do():
    """Capability query - should list capabilities, not refuse."""
    response = client.post("/chat", json={"query": "What can you do?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert data["answer"]
    ans_lower = data["answer"].lower()
    # Should mention at least some capabilities
    assert any(kw in ans_lower for kw in ["race", "standings", "f1", "championship", "terminology"])

def test_conversational_what_can_you_help():
    """Help query - should respond with capabilities."""
    response = client.post("/chat", json={"query": "What can you help me with?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert data["answer"]
