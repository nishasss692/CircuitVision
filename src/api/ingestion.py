import os
import logging
import fastf1
import pandas as pd
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from src.pipeline.normalizer import (
    normalize_session_summary,
    normalize_laps,
    normalize_telemetry,
    normalize_weather,
    normalize_dataframe
)
from src.pipeline.session_loader import load_session, SessionIdentityError

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("f1_ingestion")

# Enable FastF1 disk cache in 'f1_cache' directory
CACHE_DIR = os.path.join(os.getcwd(), "f1_cache")
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

router = APIRouter(prefix="/api", tags=["Ingestion Service"])


def load_session_with_fallback(year: int, round_no: int, session_type: str = "R"):
    """
    Loads a FastF1 session using the canonical shared loader which validates
    session identity (round number + year) after every load.  Falls back to
    the prior year's same round if the primary load fails.

    Returns (session, is_fallback) — identical interface to the old helper so
    all callers can remain unchanged.
    """
    session, is_fallback, _ = load_session(
        year=year,
        round_number=round_no,
        session_type=session_type,
        laps=True,
        telemetry=True,
        weather=True,
    )
    return session, is_fallback

@router.get("/schedule/{year}")
def get_schedule(year: int = 2026):
    """Fetches full Formula 1 season schedule for a given year."""
    try:
        schedule = fastf1.get_event_schedule(year)
        if schedule.empty:
            raise HTTPException(status_code=444, detail="No schedule found")
        
        schedule_clean = schedule[['RoundNumber', 'EventName', 'OfficialEventName', 'Location', 'Country', 'EventDate', 'F1ApiSupport']]
        return {
            "year": year,
            "events_count": len(schedule_clean),
            "events": normalize_dataframe(schedule_clean)
        }
    except Exception as e:
        logger.error(f"Error loading schedule for {year}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch schedule: {str(e)}")

from src.pipeline.index_rag import reindex_rag_corpus
from src.ml.rag_engine import rag_engine
from src.api.paddock import clear_paddock_cache

@router.get("/session/{year}/{round_no}/summary")
def get_session_summary(year: int, round_no: int, session_type: str = "R"):
    """Returns normalized high-level summary, drivers, weather, and results for a race session."""
    try:
        session, is_fallback = load_session_with_fallback(year, round_no, session_type)
    except SessionIdentityError as e:
        raise HTTPException(status_code=409, detail=str(e))

    # Trigger paddock cache clear and RAG index refresh to prevent out-of-date vector store staleness
    try:
        clear_paddock_cache(year)
        reindex_rag_corpus()
        rag_engine.reload_index()
    except Exception as e:
        logger.warning(f"RAG vector store auto-reindex failed during ingestion: {e}")

    summary = normalize_session_summary(session)
    summary["is_fallback_data"] = is_fallback
    summary["actual_round_number"] = int(session.event.get("RoundNumber", round_no))
    summary["actual_event_name"] = str(session.event.get("EventName", ""))
    summary["weather"] = normalize_weather(session)[:10]  # sample weather snapshots
    return summary


@router.get("/session/{year}/{round_no}/laps")
def get_session_laps(year: int, round_no: int, session_type: str = "R", driver: Optional[str] = None):
    """Returns normalized lap timing data, stint info, tyre compounds, and sector times."""
    try:
        session, is_fallback = load_session_with_fallback(year, round_no, session_type)
    except SessionIdentityError as e:
        raise HTTPException(status_code=409, detail=str(e))
    laps = normalize_laps(session)

    if driver:
        laps = [lap for lap in laps if str(lap.get("driver")).upper() == str(driver).upper()]

    return {
        "year": year,
        "round_number": round_no,
        "actual_round_number": int(session.event.get("RoundNumber", round_no)),
        "actual_event_name": str(session.event.get("EventName", "")),
        "session": session.name,
        "is_fallback_data": is_fallback,
        "total_laps_returned": len(laps),
        "laps": laps
    }

@router.get("/session/{year}/{round_no}/telemetry")
def get_session_telemetry(
    year: int,
    round_no: int,
    session_type: str = "R",
    driver: Optional[str] = Query(None, description="Driver code (e.g. NOR, HAM, RUS, VER)"),
    lap_number: Optional[int] = Query(None, description="Specific lap number")
):
    """Returns car 2D/3D telemetry coordinates and sensor data (X, Y, Z, Speed, Throttle, Brake, Gear)."""
    try:
        session, is_fallback = load_session_with_fallback(year, round_no, session_type)
    except SessionIdentityError as e:
        raise HTTPException(status_code=409, detail=str(e))

    # If no driver specified, default to fastest lap driver to avoid payload explosion
    if not driver and hasattr(session, 'laps') and not session.laps.empty:
        fastest_lap = session.laps.pick_fastest()
        driver = fastest_lap['Driver']
        if not lap_number:
            lap_number = int(fastest_lap['LapNumber'])

    telemetry = normalize_telemetry(session, driver=driver, lap_number=lap_number)

    return {
        "year": year,
        "round_number": round_no,
        "actual_round_number": int(session.event.get("RoundNumber", round_no)),
        "actual_event_name": str(session.event.get("EventName", "")),
        "driver": driver,
        "lap_number": lap_number,
        "is_fallback_data": is_fallback,
        "data_points": len(telemetry),
        "telemetry": telemetry
    }

@router.get("/session/{year}/{round_no}/pitwall")
def get_pitwall_leaderboard(year: int, round_no: int, session_type: str = "R"):
    """Returns live-ish pitwall leaderboard: gaps to leader, tyre compound & age, pit stop history, track status."""
    try:
        session, is_fallback = load_session_with_fallback(year, round_no, session_type)
    except SessionIdentityError as e:
        raise HTTPException(status_code=409, detail=str(e))

    leaderboard = []
    if hasattr(session, 'results') and session.results is not None and not session.results.empty:
        for idx, row in session.results.iterrows():
            d_code = str(row.get("Abbreviation", ""))
            d_laps = session.laps.pick_driver(d_code) if hasattr(session, 'laps') else None

            current_compound = None
            tyre_life = None
            stint = None
            last_lap_time = None

            if d_laps is not None and not d_laps.empty:
                last_lap = d_laps.iloc[-1]
                current_compound = str(last_lap.get("Compound")) if pd.notna(last_lap.get("Compound")) else None
                tyre_life = int(last_lap.get("TyreLife")) if pd.notna(last_lap.get("TyreLife")) else None
                stint = int(last_lap.get("Stint")) if pd.notna(last_lap.get("Stint")) else None
                last_lap_time = float(last_lap.get("LapTime").total_seconds()) if pd.notna(last_lap.get("LapTime")) else None

            leaderboard.append({
                "position": int(row.get("Position")) if pd.notna(row.get("Position")) else None,
                "driver_number": str(row.get("DriverNumber")),
                "driver": d_code,
                "broadcast_name": str(row.get("BroadcastName")),
                "team_name": str(row.get("TeamName")),
                "team_color": str(row.get("TeamColor")),
                "status": str(row.get("Status")),
                "current_compound": current_compound,
                "tyre_life": tyre_life,
                "stint": stint,
                "last_lap_time": last_lap_time
            })

    track_status = []
    if hasattr(session, 'track_status') and session.track_status is not None:
        track_status = normalize_dataframe(session.track_status)

    return {
        "year": year,
        "round_number": round_no,
        "actual_round_number": int(session.event.get("RoundNumber", round_no)),
        "actual_event_name": str(session.event.get("EventName", "")),
        "event_name": session.event.get("EventName"),
        "is_fallback_data": is_fallback,
        "leaderboard": leaderboard,
        "track_status": track_status
    }
