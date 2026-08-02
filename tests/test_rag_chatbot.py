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

# --- REGRESSION TEST SUITE FOR ALL 11 COMPLETED 2026 RACES ---

def test_completed_race_r1_australian_gp():
    response = client.post("/chat", json={"query": "What happened at the Australian GP in 2026?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert "George Russell" in data["answer"] or "Russell" in data["answer"]

def test_completed_race_r2_chinese_gp():
    response = client.post("/chat", json={"query": "Who won the Chinese Grand Prix in 2026?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert "Antonelli" in data["answer"] or "Kimi" in data["answer"]

def test_completed_race_r3_japanese_gp():
    response = client.post("/chat", json={"query": "Who won the Japanese GP at Suzuka?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert "Antonelli" in data["answer"] or "Kimi" in data["answer"]

def test_completed_race_r4_miami_gp():
    response = client.post("/chat", json={"query": "What was the result of the Miami GP in 2026?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert "Antonelli" in data["answer"] or "Miami" in data["answer"]

def test_completed_race_r5_canadian_gp():
    response = client.post("/chat", json={"query": "Who won the Canadian Grand Prix in 2026?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert "Antonelli" in data["answer"] or "Canada" in data["answer"]

def test_completed_race_r6_monaco_gp():
    response = client.post("/chat", json={"query": "What happened at the Monaco GP in 2026?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert "Antonelli" in data["answer"] or "Monaco" in data["answer"]

def test_completed_race_r7_barcelona_gp():
    response = client.post("/chat", json={"query": "Who won the Barcelona Grand Prix in 2026?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert "Hamilton" in data["answer"] or "Lewis" in data["answer"]

def test_completed_race_r8_austrian_gp():
    response = client.post("/chat", json={"query": "Who won the Austrian GP at Red Bull Ring?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert "Russell" in data["answer"] or "George" in data["answer"]

def test_completed_race_r9_british_gp():
    response = client.post("/chat", json={"query": "Who won the British GP at Silverstone?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert "Leclerc" in data["answer"] or "Charles" in data["answer"]

def test_completed_race_r10_belgian_gp():
    response = client.post("/chat", json={"query": "Who won the Belgian Grand Prix at Spa?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert "Antonelli" in data["answer"] or "Belgian" in data["answer"]

def test_completed_race_r11_hungarian_gp():
    response = client.post("/chat", json={"query": "Who won the Hungarian GP in 2026?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert "Norris" in data["answer"] or "Lando" in data["answer"]

# --- STANDINGS & PADDOCK CROSS-CHECK TESTS (SINGLE SOURCE OF TRUTH) ---

def test_championship_standings_cross_check_with_paddock():
    """Verifies chatbot standings answer matches the paddock module standings calculation byte-for-byte on points."""
    paddock_res = client.get("/api/paddock/standings/2026")
    assert paddock_res.status_code == 200
    paddock_data = paddock_res.json()
    assert len(paddock_data["drivers"]) > 0
    top_driver_info = paddock_data["drivers"][0]
    top_driver_name = top_driver_info["full_name"]
    top_driver_pts = top_driver_info["points"]
    pts_str = str(int(top_driver_pts)) if top_driver_pts == int(top_driver_pts) else str(top_driver_pts)
    
    response = client.post("/chat", json={"query": "Who is leading the drivers championship?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert top_driver_name in data["answer"] or "Antonelli" in data["answer"]
    assert pts_str in data["answer"]

def test_driver_specific_points_cross_check_with_paddock():
    """Verifies chatbot query for a specific driver returns exact byte-for-byte paddock points."""
    paddock_res = client.get("/api/paddock/standings/2026")
    assert paddock_res.status_code == 200
    paddock_data = paddock_res.json()
    antonelli_info = next(d for d in paddock_data["drivers"] if "Antonelli" in d["full_name"])
    expected_pts = str(int(antonelli_info["points"])) if antonelli_info["points"] == int(antonelli_info["points"]) else str(antonelli_info["points"])

    response = client.post("/chat", json={"query": "How many points does Kimi Antonelli have?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert expected_pts in data["answer"]

def test_constructor_standings_cross_check_with_paddock():
    """Verifies chatbot constructor standings query matches paddock constructor standings byte-for-byte."""
    paddock_res = client.get("/api/paddock/standings/2026")
    assert paddock_res.status_code == 200
    paddock_data = paddock_res.json()
    top_team_info = paddock_data["constructors"][0]
    top_team_name = top_team_info["team_name"]
    expected_pts = str(int(top_team_info["points"])) if top_team_info["points"] == int(top_team_info["points"]) else str(top_team_info["points"])

    response = client.post("/chat", json={"query": "Who is leading the constructors championship?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert top_team_name in data["answer"]
    assert expected_pts in data["answer"]

def test_lockstep_cache_invalidation_sync():
    """Verifies clearing paddock cache leaves both paddock and chatbot reading the exact same source in lockstep."""
    from src.api.paddock import clear_paddock_cache
    clear_paddock_cache(2026)

    paddock_res = client.get("/api/paddock/standings/2026")
    assert paddock_res.status_code == 200
    paddock_pts = str(int(paddock_res.json()["drivers"][0]["points"]))

    chat_res = client.post("/chat", json={"query": "How many points does Antonelli have?"})
    assert chat_res.status_code == 200
    assert paddock_pts in chat_res.json()["answer"]

# --- RETRIEVAL ACCURACY & UNHELD FUTURE RACE TESTS ---

def test_unheld_future_race_out_of_bounds_query():
    """Dutch GP (Round 12) is unheld in completed 11-round dataset."""
    response = client.post("/chat", json={"query": "Who won the 2026 Dutch GP?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is True
    assert "not taken place" in data["answer"].lower() or "data cutoff" in data["answer"].lower()

def test_nonexistent_driver_query():
    response = client.post("/chat", json={"query": "How many points did Porsche driver speedracer score?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is True

def test_rules_and_regulations_query():
    response = client.post("/chat", json={"query": "What is Active Aero X-Mode?"})
    assert response.status_code == 200
    data = response.json()
    assert "low drag" in data["answer"].lower() or "straights" in data["answer"].lower()
    assert data["unable_to_answer"] is False

# --- GENERAL F1 KNOWLEDGE TESTS ---

def test_general_what_is_drs():
    response = client.post("/chat", json={"query": "What is DRS?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert data["answer"]

def test_general_undercut_strategy():
    response = client.post("/chat", json={"query": "What is an undercut in F1?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert data["answer"]

def test_general_parc_ferme():
    response = client.post("/chat", json={"query": "What is Parc Ferme?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert data["answer"]

# --- CONVERSATIONAL / META TESTS ---

def test_conversational_hello():
    response = client.post("/chat", json={"query": "Hello"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert data["answer"]

def test_conversational_what_can_you_do():
    response = client.post("/chat", json={"query": "What can you do?"})
    assert response.status_code == 200
    data = response.json()
    assert data["unable_to_answer"] is False
    assert data["answer"]

# --- LATENCY, CACHING & STREAMING TESTS ---

def test_response_caching_latency():
    q = "Who won the Australian GP?"
    res1 = client.post("/chat", json={"query": q, "year": 2026})
    assert res1.status_code == 200
    
    res2 = client.post("/chat", json={"query": q, "year": 2026})
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2.get("cached") is True

def test_streaming_endpoint():
    response = client.post("/chat/stream", json={"query": "What is DRS?"})
    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("content-type", "")
    content = response.text
    assert "data:" in content


