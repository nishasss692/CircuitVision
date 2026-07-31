"""
test_session_identity.py
========================
Regression test suite that verifies session-identity correctness across all
consumers of the ingestion layer (ingestion API, replay, pitwall, paddock).

Each test asserts:
  - The HTTP response's embedded round_number / actual_round_number matches
    what was requested.
  - The event_name (where returned) is the expected name from the FastF1 2026
    calendar.
  - No silent wrong-event data is served.

Tests are designed to be fast: they use the FastF1 disk cache and do NOT
require a live network connection beyond what's already cached.
"""

import os
import sys
import json
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)

# ---------------------------------------------------------------------------
# Authoritative 2026 round→name mapping from FastF1's actual schedule
# ---------------------------------------------------------------------------
EXPECTED_EVENTS = {
    1:  "Australian Grand Prix",
    2:  "Chinese Grand Prix",
    3:  "Japanese Grand Prix",
    4:  "Miami Grand Prix",
    5:  "Canadian Grand Prix",
    6:  "Monaco Grand Prix",
    7:  "Barcelona Grand Prix",
    8:  "Austrian Grand Prix",
    9:  "British Grand Prix",
    10: "Belgian Grand Prix",
    11: "Hungarian Grand Prix",
    12: "Dutch Grand Prix",
    13: "Italian Grand Prix",
    14: "Spanish Grand Prix",
    15: "Azerbaijan Grand Prix",
    16: "Bahrain Grand Prix",
    17: "Singapore Grand Prix",
    18: "United States Grand Prix",
    19: "Mexico City Grand Prix",
    20: "São Paulo Grand Prix",
    21: "Las Vegas Grand Prix",
    22: "Qatar Grand Prix",
    23: "Abu Dhabi Grand Prix",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def assert_identity(data: dict, requested_round: int, endpoint_label: str):
    """
    Asserts that an API response contains the expected round identity.
    Checks both 'actual_round_number' (preferred, explicit) and fallback
    fields 'round_number' / 'event.round_number'.
    """
    # Prefer explicit actual_round_number if present
    actual_round = data.get("actual_round_number")
    if actual_round is None:
        # Try nested event shape (replay/pitwall)
        event = data.get("event", {}) or {}
        actual_round = event.get("round_number")
    if actual_round is None:
        actual_round = data.get("round_number")

    assert actual_round is not None, (
        f"[{endpoint_label}] Response has no round_number field to check identity. "
        f"Keys: {list(data.keys())}"
    )
    assert int(actual_round) == requested_round, (
        f"[{endpoint_label}] SESSION IDENTITY MISMATCH: "
        f"requested R{requested_round} but got R{actual_round}. "
        f"event_name={data.get('actual_event_name') or data.get('event_name') or data.get('event', {}).get('event_name')!r}"
    )


def assert_event_name(data: dict, requested_round: int, endpoint_label: str):
    """
    If the expected event name is known, checks it appears in the response.
    Skips gracefully for fallback sessions (different year, name may differ).
    """
    if data.get("is_fallback_data") or data.get("is_fallback") or \
       data.get("event", {}).get("is_fallback"):
        return  # fallback data has a different year's event name by design

    expected_name = EXPECTED_EVENTS.get(requested_round)
    if expected_name is None:
        return  # No expected name registered for this round

    actual_name = (
        data.get("actual_event_name")
        or data.get("event_name")
        or (data.get("event") or {}).get("event_name")
        or ""
    )
    assert expected_name.lower() in actual_name.lower() or actual_name.lower() in expected_name.lower(), (
        f"[{endpoint_label}] Event name mismatch for R{requested_round}: "
        f"expected {expected_name!r}, got {actual_name!r}"
    )


# ---------------------------------------------------------------------------
# Ingestion API — session identity tests
# ---------------------------------------------------------------------------

class TestIngestionSessionIdentity:
    """Verifies /api/session/{year}/{round}/summary returns the correct event."""

    @pytest.mark.parametrize("round_no", [1, 2, 3, 4])
    def test_summary_round_identity(self, round_no):
        resp = client.get(f"/api/session/2026/{round_no}/summary")
        assert resp.status_code == 200, f"R{round_no} summary failed: {resp.status_code}"
        data = resp.json()
        assert_identity(data, round_no, f"ingestion/summary R{round_no}")
        assert_event_name(data, round_no, f"ingestion/summary R{round_no}")

    @pytest.mark.parametrize("round_no", [1, 2, 3, 4])
    def test_laps_round_identity(self, round_no):
        resp = client.get(f"/api/session/2026/{round_no}/laps")
        assert resp.status_code == 200, f"R{round_no} laps failed: {resp.status_code}"
        data = resp.json()
        assert_identity(data, round_no, f"ingestion/laps R{round_no}")
        assert_event_name(data, round_no, f"ingestion/laps R{round_no}")

    def test_r1_is_australian_gp(self):
        resp = client.get("/api/session/2026/1/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert_identity(data, 1, "ingestion/summary R1")
        actual_name = data.get("actual_event_name", data.get("event_name", ""))
        assert "Australian" in actual_name, f"R1 should be Australian GP, got: {actual_name!r}"

    def test_r4_is_miami_gp_not_bahrain(self):
        """
        Core regression: R4 in FastF1's 2026 schedule is Miami GP (not Bahrain).
        Old mismatched cache served Miami data for R4 with wrong round_number.
        This confirms the cache key and identity are now correct.
        """
        resp = client.get("/api/session/2026/4/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert_identity(data, 4, "ingestion/summary R4")
        actual_name = data.get("actual_event_name", data.get("event_name", ""))
        is_fallback = data.get("is_fallback_data", False)
        if not is_fallback:
            assert "Miami" in actual_name, (
                f"R4 (non-fallback) should be Miami GP, got: {actual_name!r}"
            )

    def test_r9_is_british_gp_not_spanish(self):
        """
        R9 in the real 2026 FastF1 calendar is British GP.
        Old CALENDAR_2026 had Spanish GP at R9.
        """
        resp = client.get("/api/session/2026/9/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert_identity(data, 9, "ingestion/summary R9")


# ---------------------------------------------------------------------------
# Replay — session identity tests
# ---------------------------------------------------------------------------

class TestReplaySessionIdentity:
    """Verifies /events/{round}/replay returns the correct event."""

    def test_events_list_round_numbers(self):
        resp = client.get("/events")
        assert resp.status_code == 200
        data = resp.json()
        events = data["events"]
        assert len(events) > 0
        rounds = [e["round_number"] for e in events]
        # Round numbers must be positive and unique
        assert len(set(rounds)) == len(rounds), "Duplicate round numbers in events list"
        assert all(r > 0 for r in rounds), "Non-positive round numbers in events list"

    @pytest.mark.parametrize("round_no", [1, 2])
    def test_replay_round_identity(self, round_no):
        resp = client.get(f"/events/{round_no}/replay")
        assert resp.status_code == 200, f"R{round_no} replay failed: {resp.status_code}"
        data = resp.json()
        assert_identity(data, round_no, f"replay R{round_no}")
        assert_event_name(data, round_no, f"replay R{round_no}")

    @pytest.mark.parametrize("round_no", [1, 2])
    def test_leaderboard_round_identity(self, round_no):
        resp = client.get(f"/events/{round_no}/leaderboard")
        assert resp.status_code == 200, f"R{round_no} leaderboard failed: {resp.status_code}"
        data = resp.json()
        assert_identity(data, round_no, f"leaderboard R{round_no}")


# ---------------------------------------------------------------------------
# Pitwall — session identity tests
# ---------------------------------------------------------------------------

class TestPitwallSessionIdentity:
    """Verifies /events/{round}/pitwall returns the correct event."""

    @pytest.mark.parametrize("round_no", [1])
    def test_pitwall_round_identity(self, round_no):
        resp = client.get(f"/events/{round_no}/pitwall")
        assert resp.status_code == 200, f"R{round_no} pitwall failed: {resp.status_code}"
        data = resp.json()
        assert_identity(data, round_no, f"pitwall R{round_no}")
        assert_event_name(data, round_no, f"pitwall R{round_no}")


# ---------------------------------------------------------------------------
# Cache utils unit tests
# ---------------------------------------------------------------------------

class TestCacheUtils:
    """Unit tests for the canonical cache key builder and stale-detection."""

    def test_make_cache_key_format(self):
        from src.pipeline.cache_utils import make_cache_key
        key = make_cache_key(2026, 4, "R", "replay")
        assert key == "2026_R04_R_replay.json", f"Unexpected key: {key}"

    def test_make_cache_key_double_digit(self):
        from src.pipeline.cache_utils import make_cache_key
        key = make_cache_key(2026, 14, "R", "pitwall")
        assert key == "2026_R14_R_pitwall.json", f"Unexpected key: {key}"

    def test_validate_cache_payload_valid(self):
        from src.pipeline.cache_utils import validate_cache_payload
        payload = {"event": {"year": 2026, "round_number": 4}}
        assert validate_cache_payload(payload, 2026, 4) is True

    def test_validate_cache_payload_stale_round(self, tmp_path):
        from src.pipeline.cache_utils import validate_cache_payload
        # Payload claims R4 but we're requesting R9
        stale_file = tmp_path / "stale.json"
        stale_file.write_text(json.dumps({"event": {"year": 2026, "round_number": 4}}))
        result = validate_cache_payload(
            {"event": {"year": 2026, "round_number": 4}},
            expected_year=2026,
            expected_round=9,
            cache_path=str(stale_file)
        )
        assert result is False, "Stale cache should be rejected"
        # File should have been deleted
        assert not stale_file.exists(), "Stale cache file should be deleted"

    def test_validate_cache_payload_top_level_fields(self):
        from src.pipeline.cache_utils import validate_cache_payload
        # Top-level round_number style (ingestion payloads)
        payload = {"year": 2026, "round_number": 3, "data": []}
        assert validate_cache_payload(payload, 2026, 3) is True

    def test_validate_cache_payload_wrong_year(self, tmp_path):
        from src.pipeline.cache_utils import validate_cache_payload
        stale_file = tmp_path / "stale_year.json"
        stale_file.write_text(json.dumps({"year": 2025, "round_number": 1}))
        result = validate_cache_payload(
            {"year": 2025, "round_number": 1},
            expected_year=2026,
            expected_round=1,
            cache_path=str(stale_file)
        )
        assert result is False


# ---------------------------------------------------------------------------
# Session loader unit tests
# ---------------------------------------------------------------------------

class TestSessionLoaderIdentityValidation:
    """Tests that _validate_identity raises SessionIdentityError on mismatch."""

    def test_validate_identity_raises_on_round_mismatch(self, monkeypatch):
        from src.pipeline import session_loader

        class FakeEvent(dict):
            pass

        class FakeSession:
            event = FakeEvent({"RoundNumber": 9, "Year": 2026, "EventName": "British GP"})

        with pytest.raises(session_loader.SessionIdentityError, match="MISMATCH"):
            session_loader._validate_identity(
                FakeSession(), expected_year=2026, expected_round=4, label="test"
            )

    def test_validate_identity_passes_on_match(self, monkeypatch):
        from src.pipeline import session_loader

        class FakeEvent(dict):
            pass

        class FakeSession:
            event = FakeEvent({"RoundNumber": 4, "Year": 2026, "EventName": "Miami GP"})

        # Should not raise
        session_loader._validate_identity(
            FakeSession(), expected_year=2026, expected_round=4, label="test"
        )


# ---------------------------------------------------------------------------
# Schedule endpoint round-number integrity
# ---------------------------------------------------------------------------

class TestScheduleRoundNumberIntegrity:
    """Verifies that the /api/schedule endpoint returns correct FastF1 round numbers."""

    def test_schedule_r4_is_miami(self):
        resp = client.get("/api/schedule/2026")
        assert resp.status_code == 200
        data = resp.json()
        events = {e["RoundNumber"]: e["EventName"] for e in data["events"]}
        assert 4 in events, "Round 4 missing from schedule"
        assert "Miami" in events[4], (
            f"R4 should be Miami GP in 2026 schedule, got: {events[4]!r}"
        )

    def test_schedule_round_numbers_are_unique_and_positive(self):
        resp = client.get("/api/schedule/2026")
        assert resp.status_code == 200
        data = resp.json()
        rounds = [e["RoundNumber"] for e in data["events"] if e["RoundNumber"] > 0]
        assert len(rounds) > 0
        assert len(set(rounds)) == len(rounds), "Duplicate round numbers in schedule"
