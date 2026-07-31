import os
import sys

# Ensure root workspace directory is in python module search path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import logging
from fastapi.testclient import TestClient
from src.api.main import app

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_ingestion")

def run_tests():
    client = TestClient(app)
    
    logger.info("Testing 1: Health Check Endpoint ('/')")
    response = client.get("/")
    assert response.status_code == 200, f"Health check failed: {response.status_code}"
    data = response.json()
    assert data["status"] == "Active"
    assert "Ingestion Service" in data["modules"]
    logger.info("✅ Health Check passed.")

    logger.info("Testing 2: Schedule Endpoint ('/api/schedule/2026')")
    response = client.get("/api/schedule/2026")
    assert response.status_code == 200, f"Schedule endpoint failed: {response.status_code}"
    data = response.json()
    assert data["year"] == 2026
    assert data["events_count"] > 0
    logger.info(f"✅ Schedule endpoint passed. Total 2026 rounds: {data['events_count']}.")

    logger.info("Testing 3: Session Summary Endpoint ('/api/session/2026/1/summary')")
    response = client.get("/api/session/2026/1/summary")
    assert response.status_code == 200, f"Session summary failed: {response.status_code}"
    data = response.json()
    assert "event_name" in data
    assert "drivers_count" in data
    assert data["drivers_count"] > 0
    # Identity check: actual round must match the requested round
    actual_round = data.get("actual_round_number", data.get("round_number"))
    assert actual_round == 1, f"Identity mismatch: requested R1 but got R{actual_round}"
    logger.info(f"✅ Session Summary passed: {data['event_name']} ({data['drivers_count']} drivers loaded). "
                f"Actual round: R{actual_round}. Fallback: {data['is_fallback_data']}")

    logger.info("Testing 4: Session Laps Endpoint ('/api/session/2026/1/laps')")
    response = client.get("/api/session/2026/1/laps?driver=NOR")
    assert response.status_code == 200, f"Session laps failed: {response.status_code}"
    data = response.json()
    assert "laps" in data
    assert len(data["laps"]) > 0
    sample_lap = data["laps"][0]
    assert "lap_number" in sample_lap
    assert "compound" in sample_lap
    # Identity check
    actual_round = data.get("actual_round_number", data.get("round_number"))
    assert actual_round == 1, f"Laps identity mismatch: requested R1 but got R{actual_round}"
    logger.info(f"✅ Session Laps passed for driver NOR. Laps returned: {len(data['laps'])}. Actual round: R{actual_round}.")

    logger.info("Testing 5: Telemetry Coordinates Endpoint ('/api/session/2026/1/telemetry')")
    response = client.get("/api/session/2026/1/telemetry?driver=NOR&lap_number=1")
    assert response.status_code == 200, f"Telemetry endpoint failed: {response.status_code}"
    data = response.json()
    assert "telemetry" in data
    assert len(data["telemetry"]) > 0
    sample_tel = data["telemetry"][0]
    assert "x" in sample_tel
    assert "y" in sample_tel
    assert "speed" in sample_tel
    assert "gear" in sample_tel
    # Identity check
    actual_round = data.get("actual_round_number", data.get("round_number"))
    assert actual_round == 1, f"Telemetry identity mismatch: requested R1 but got R{actual_round}"
    logger.info(f"✅ Telemetry coordinates passed. Data points for lap 1: {len(data['telemetry'])}. Actual round: R{actual_round}.")

    logger.info("Testing 6: Pitwall Leaderboard Endpoint ('/api/session/2026/1/pitwall')")
    response = client.get("/api/session/2026/1/pitwall")
    assert response.status_code == 200, f"Pitwall endpoint failed: {response.status_code}"
    data = response.json()
    assert "leaderboard" in data
    assert len(data["leaderboard"]) > 0
    # Identity check
    actual_round = data.get("actual_round_number", data.get("round_number"))
    assert actual_round == 1, f"Pitwall identity mismatch: requested R1 but got R{actual_round}"
    leader = data["leaderboard"][0]
    logger.info(f"✅ Pitwall Leaderboard passed. P1 driver: {leader['driver']} ({leader['team_name']}). Actual round: R{actual_round}.")


    logger.info("Testing 7: Web Paddock Standings Endpoint ('/api/paddock/standings/2026')")
    response = client.get("/api/paddock/standings/2026")
    assert response.status_code == 200, f"Paddock standings failed: {response.status_code}"
    data = response.json()
    assert "drivers" in data
    assert "constructors" in data
    logger.info(f"✅ Paddock Standings passed. Drivers count: {len(data['drivers'])}.")

    logger.info("Testing 8: Championship Predictor Endpoint ('/api/predictor/simulate')")
    response = client.post("/api/predictor/simulate", json={"year": 2026, "round_number": 1, "circuit_name": "Albert Park"})
    assert response.status_code == 200, f"Predictor failed: {response.status_code}"
    data = response.json()
    assert "drivers" in data
    assert "constructors" in data
    logger.info(f"✅ Championship Predictor passed. Top predicted driver: {data['drivers'][0]['name']} ({data['drivers'][0]['win_probability']}%).")

    logger.info("Testing 9: RAG Chatbot Endpoint ('/api/chatbot/query')")
    response = client.post("/api/chatbot/query", json={"query": "What are the 2026 engine regulations?", "year": 2026, "round_number": 1})
    assert response.status_code == 200, f"RAG Chatbot failed: {response.status_code}"
    data = response.json()
    assert "answer" in data
    assert "sources" in data
    logger.info(f"✅ RAG Chatbot passed. Sources: {data['sources']}.")

    logger.info("\n🎉 ALL 9 FULL-STACK DASHBOARD API ENDPOINTS PASSED VERIFICATION! 🎉")

if __name__ == "__main__":
    run_tests()
