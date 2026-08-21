import os
import json
import logging
import fastf1
import pandas as pd
import numpy as np
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from src.pipeline.session_loader import load_session, SessionIdentityError
from src.pipeline.cache_utils import make_cache_path, validate_cache_payload, ensure_cache_dir, init_fastf1_cache

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("f1_pitwall")

# Enable FastF1 disk cache (serverless safe)
init_fastf1_cache()

PITWALL_CACHE_DIR = ensure_cache_dir(os.path.join("data", "pitwall_cache"))

router = APIRouter(tags=["Pitwall Module"])


TRACK_STATUS_MAP = {
    '1': {"code": "1", "text": "GREEN", "description": "Track Clear", "color": "emerald"},
    '2': {"code": "2", "text": "YELLOW", "description": "Yellow Flag", "color": "amber"},
    '4': {"code": "4", "text": "SAFETY CAR", "description": "Safety Car Deployed", "color": "amber"},
    '5': {"code": "5", "text": "RED", "description": "Red Flag - Session Stopped", "color": "red"},
    '6': {"code": "6", "text": "VSC", "description": "Virtual Safety Car", "color": "amber"},
    '7': {"code": "7", "text": "VSC ENDING", "description": "Virtual Safety Car Ending", "color": "amber"}
}

def load_session_pitwall(year: int = 2026, round_no: int = 1):
    """Loads FastF1 race session using the canonical shared loader with identity validation."""
    try:
        session, is_fallback, fallback_yr = load_session(
            year=year,
            round_number=round_no,
            session_type='R',
            laps=True,
            telemetry=False,
            weather=False,
        )
        actual_year = fallback_yr if is_fallback else year
        return session, actual_year, is_fallback
    except SessionIdentityError:
        raise
    except Exception as e:
        raise RuntimeError(f"Failed to load pitwall session {year} R{round_no}: {e}") from e


def process_pitwall_data(year: int, round_no: int):
    cache_file = make_cache_path(PITWALL_CACHE_DIR, year, round_no, "R", "pitwall")
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r") as f:
                payload = json.load(f)
            # Stale-cache detection: verify stored identity matches the request
            if validate_cache_payload(payload, year, round_no, cache_file):
                return payload
            # validate_cache_payload already deleted the stale file; fall through to recompute
        except Exception as cache_err:
            logger.warning(f"Cache read error for pitwall {year} R{round_no}: {cache_err}. Recomputing.")


    session, loaded_year, is_fallback = load_session_pitwall(year, round_no)
    event_info = session.event if hasattr(session, 'event') else {}
    
    event_meta = {
        "year": year,
        "round_number": round_no,
        "event_name": str(event_info.get("EventName", f"Grand Prix Round {round_no}")),
        "official_name": str(event_info.get("OfficialEventName", f"Formula 1 Grand Prix Round {round_no}")),
        "country": str(event_info.get("Country", "Global")),
        "location": str(event_info.get("Location", "")),
        "circuit": str(event_info.get("EventName", "Grand Prix Circuit")),
        "is_fallback": is_fallback
    }

    # 1. Driver Metadata from session.results (never hardcode!)
    driver_metadata = {}
    if hasattr(session, 'results') and session.results is not None and not session.results.empty:
        for _, row in session.results.iterrows():
            d_num = str(row['DriverNumber']) if pd.notna(row.get('DriverNumber')) else ""
            d_abbr = str(row['Abbreviation']) if pd.notna(row.get('Abbreviation')) else f"D{d_num}"
            team_name = str(row['TeamName']) if pd.notna(row.get('TeamName')) else "Unknown"
            raw_color = str(row['TeamColor']) if pd.notna(row.get('TeamColor')) else ""
            team_color = raw_color if raw_color and raw_color != "nan" and raw_color.strip() else "888888"
            grid_pos = int(row['GridPosition']) if pd.notna(row.get('GridPosition')) and row.get('GridPosition') != '' else None
            final_pos = int(row['Position']) if pd.notna(row.get('Position')) and row.get('Position') != '' else None
            full_name = str(row['FullName']) if pd.notna(row.get('FullName')) else d_abbr
            broadcast_name = str(row['BroadcastName']) if pd.notna(row.get('BroadcastName')) else full_name
            status = str(row['Status']) if pd.notna(row.get('Status')) else "UNKNOWN"
            points = float(row['Points']) if pd.notna(row.get('Points')) else 0.0

            driver_metadata[d_abbr] = {
                "driver_number": d_num,
                "abbreviation": d_abbr,
                "broadcast_name": broadcast_name,
                "full_name": full_name,
                "team_name": team_name,
                "team_color": team_color,
                "grid_position": grid_pos,
                "final_position": final_pos,
                "status": status,
                "points": points
            }

    # 2. Track Status History from session.track_status
    track_status_history = []
    if hasattr(session, 'track_status') and session.track_status is not None and not session.track_status.empty:
        for _, row in session.track_status.iterrows():
            t_sec = float(row['Time'].total_seconds()) if hasattr(row['Time'], 'total_seconds') else 0.0
            st_code = str(row.get('Status', '1'))
            msg = str(row.get('Message', ''))
            st_info = TRACK_STATUS_MAP.get(st_code, {"code": st_code, "text": "UNKNOWN", "description": msg, "color": "gray"})
            track_status_history.append({
                "session_time_sec": round(t_sec, 2),
                "status_code": st_code,
                "status_text": st_info["text"],
                "description": st_info["description"],
                "message": msg,
                "color": st_info["color"]
            })

    # Default to Green if track status was empty
    if not track_status_history:
        track_status_history.append({
            "session_time_sec": 0.0,
            "status_code": "1",
            "status_text": "GREEN",
            "description": "Track Clear",
            "message": "AllClear",
            "color": "emerald"
        })

    # 3. Pit Stop History & Tyre Compound Per Lap
    pit_stops = []
    driver_laps_data = {}
    min_session_t = float('inf')
    max_session_t = float('-inf')

    if hasattr(session, 'laps') and session.laps is not None and not session.laps.empty:
        laps_df = session.laps.copy()
        
        # Calculate time bounds
        if 'Time' in laps_df and not laps_df['Time'].dropna().empty:
            max_session_t = laps_df['Time'].dt.total_seconds().max()
        if 'LapStartTime' in laps_df and not laps_df['LapStartTime'].dropna().empty:
            min_session_t = laps_df['LapStartTime'].dt.total_seconds().min()

        for abbr in driver_metadata.keys():
            d_laps = laps_df[laps_df['Driver'] == abbr].sort_values('LapNumber')
            if d_laps.empty:
                continue

            laps_list = []
            prev_compound = None
            last_pit_lap = None
            last_pit_duration = None

            for idx, lap in d_laps.iterrows():
                lap_num = int(lap['LapNumber']) if pd.notna(lap.get('LapNumber')) else None
                comp = str(lap['Compound']).upper() if pd.notna(lap.get('Compound')) and str(lap.get('Compound')).strip() and str(lap.get('Compound')) != 'nan' else None
                tyre_life = int(lap['TyreLife']) if pd.notna(lap.get('TyreLife')) else None
                lap_time = float(lap['LapTime'].total_seconds()) if pd.notna(lap.get('LapTime')) and hasattr(lap['LapTime'], 'total_seconds') else None
                start_t = float(lap['LapStartTime'].total_seconds()) if pd.notna(lap.get('LapStartTime')) and hasattr(lap['LapStartTime'], 'total_seconds') else None
                end_t = float(lap['Time'].total_seconds()) if pd.notna(lap.get('Time')) and hasattr(lap['Time'], 'total_seconds') else None
                
                pit_in_t = float(lap['PitInTime'].total_seconds()) if pd.notna(lap.get('PitInTime')) and hasattr(lap['PitInTime'], 'total_seconds') else None
                pit_out_t = float(lap['PitOutTime'].total_seconds()) if pd.notna(lap.get('PitOutTime')) and hasattr(lap['PitOutTime'], 'total_seconds') else None

                # Check if pit stop occurred
                if pit_in_t is not None or pit_out_t is not None:
                    duration = None
                    if pit_in_t is not None and pit_out_t is not None:
                        duration = round(abs(pit_out_t - pit_in_t), 2)

                    last_pit_lap = lap_num
                    last_pit_duration = duration

                    d_info = driver_metadata.get(abbr, {})
                    pit_stops.append({
                        "lap": lap_num,
                        "driver": abbr,
                        "driver_number": d_info.get("driver_number", ""),
                        "team_name": d_info.get("team_name", ""),
                        "team_color": d_info.get("team_color", "888888"),
                        "compound_in": prev_compound if prev_compound else comp,
                        "compound_out": comp,
                        "duration_sec": duration,
                        "session_time_sec": round(pit_in_t or pit_out_t or 0.0, 2)
                    })

                prev_compound = comp

                laps_list.append({
                    "lap_number": lap_num,
                    "compound": comp,
                    "tyre_life": tyre_life,
                    "lap_time": lap_time,
                    "start_t": start_t,
                    "end_t": end_t,
                    "pit_in_t": pit_in_t,
                    "pit_out_t": pit_out_t,
                    "last_pit_lap": last_pit_lap,
                    "last_pit_duration": last_pit_duration
                })

            driver_laps_data[abbr] = laps_list

    if min_session_t == float('inf'):
        min_session_t = 0.0
    if max_session_t == float('-inf'):
        max_session_t = 7200.0

    # Sort pit stops chronologically
    pit_stops.sort(key=lambda x: x.get("session_time_sec", 0))

    # 4. Compute Final Pitwall Leaderboard
    final_leaderboard = []
    # Rank by final position or laps completed
    sorted_drivers = sorted(
        driver_metadata.values(),
        key=lambda d: d.get("final_position") if d.get("final_position") is not None else 999
    )

    leader_laps = 0
    if sorted_drivers and sorted_drivers[0]["abbreviation"] in driver_laps_data:
        leader_laps = len(driver_laps_data[sorted_drivers[0]["abbreviation"]])

    for pos_idx, d_meta in enumerate(sorted_drivers):
        abbr = d_meta["abbreviation"]
        d_laps = driver_laps_data.get(abbr, [])

        last_lap_obj = d_laps[-1] if d_laps else {}
        curr_compound = last_lap_obj.get("compound")
        tyre_life = last_lap_obj.get("tyre_life")
        last_lap_time = last_lap_obj.get("lap_time")
        last_pit_lap = last_lap_obj.get("last_pit_lap")
        last_pit_duration = last_lap_obj.get("last_pit_duration")

        current_lap = len(d_laps) if d_laps else None

        # Calculate gap representation
        gap_to_leader = "LEADER" if pos_idx == 0 else "N/A"
        gap_to_ahead = "-" if pos_idx == 0 else "N/A"
        if pos_idx > 0:
            if current_lap and leader_laps:
                lap_diff = leader_laps - current_lap
                if lap_diff > 0:
                    gap_to_leader = f"+{lap_diff} LAP{'S' if lap_diff > 1 else ''}"

        final_leaderboard.append({
            "position": d_meta.get("final_position") or (pos_idx + 1),
            "driver_number": d_meta["driver_number"],
            "driver": abbr,
            "broadcast_name": d_meta["broadcast_name"],
            "full_name": d_meta["full_name"],
            "team_name": d_meta["team_name"],
            "team_color": d_meta["team_color"],
            "current_lap": current_lap,
            "status": d_meta["status"],
            "current_compound": curr_compound,
            "tyre_life": tyre_life,
            "last_lap_time": last_lap_time,
            "last_pit_lap": last_pit_lap,
            "last_pit_duration": last_pit_duration,
            "gap_to_leader": gap_to_leader,
            "gap_to_ahead": gap_to_ahead
        })

    total_duration_sec = max(0.0, max_session_t - min_session_t)

    # 5. Build Scrubbable Timestamps Array (0.0 to total_duration_sec step 2s)
    num_steps = 100
    step_size = max(1.0, total_duration_sec / num_steps)
    timestamps = [round(i * step_size, 1) for i in range(num_steps + 1)]

    payload = {
        "event": event_meta,
        "session_min_t": round(min_session_t, 2),
        "session_max_t": round(max_session_t, 2),
        "total_duration_sec": round(total_duration_sec, 2),
        "track_status_history": track_status_history,
        "current_track_status": track_status_history[-1] if track_status_history else {"code": "1", "text": "GREEN", "description": "Track Clear", "color": "emerald"},
        "pit_stops": pit_stops,
        "leaderboard": final_leaderboard,
        "timestamps": timestamps
    }

    try:
        with open(cache_file, "w") as f:
            json.dump(payload, f)
    except Exception as e:
        logger.error(f"Error caching pitwall data: {e}")

    return payload

@router.get("/events/{event_id}/pitwall")
@router.get("/api/events/{event_id}/pitwall")
@router.get("/api/session/{year}/{event_id}/pitwall")
def get_pitwall_snapshot(
    event_id: str,
    year: int = 2026,
    timestamp: Optional[float] = Query(None, description="Session relative time in seconds for scrubbing"),
    lap: Optional[int] = Query(None, description="Lap number for scrubbing")
):
    """Returns pitwall screen data: track status, live leaderboard, gap matrix, tyre compounds & age, pit stop history."""
    try:
        try:
            round_no = int(event_id)
        except ValueError:
            round_no = 1

        data = process_pitwall_data(year, round_no)

        # If timestamp parameter is provided, filter state at that moment
        if timestamp is not None and "session_min_t" in data:
            abs_t = data["session_min_t"] + timestamp
            
            # Active track status at timestamp
            active_ts = data["track_status_history"][0]
            for ts in data["track_status_history"]:
                if ts["session_time_sec"] <= abs_t:
                    active_ts = ts
                else:
                    break
            data["current_track_status"] = active_ts

            # Filter pit stops up to timestamp
            data["pit_stops"] = [ps for ps in data["pit_stops"] if ps.get("session_time_sec", 0) <= abs_t]

        return data
    except Exception as e:
        logger.error(f"Error loading pitwall snapshot for event {event_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed loading pitwall data: {str(e)}")
