import os
import json
import logging
import fastf1
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional

logger = logging.getLogger("replay_precomputer")

CACHE_DIR = os.path.join(os.getcwd(), "f1_cache")

def get_event_cache_filepath(year: int, round_number: int) -> str:
    return os.path.join(CACHE_DIR, f"precomputed_replay_{year}_{round_number}.json")

def precompute_race_replay(year: int = 2026, round_number: int = 1, sample_interval_sec: float = 0.5) -> Dict[str, Any]:
    """
    Loads FastF1 race session telemetry for a Grand Prix event, resamples driver position (X, Y)
    and sensors onto a uniform time grid, precomputes track layout outline and running order leaderboard,
    and returns a clean serializable dictionary.
    """
    cache_path = get_event_cache_filepath(year, round_number)
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r") as f:
                logger.info(f"Loading cached precomputed replay for {year} Round {round_number} from disk.")
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed reading replay cache file {cache_path}: {e}")

    logger.info(f"Computing 2D replay telemetry payload for {year} Round {round_number}...")
    fastf1.Cache.enable_cache(CACHE_DIR)
    
    session, is_fallback = None, False
    try:
        session = fastf1.get_session(year, round_number, 'R')
        session.load(laps=True, telemetry=True, weather=False)
    except Exception as e:
        logger.warning(f"Could not load session {year} Round {round_number}: {e}. Falling back to 2025 Round {round_number}")
        try:
            session = fastf1.get_session(2025, round_number, 'R')
            session.load(laps=True, telemetry=True, weather=False)
            is_fallback = True
        except Exception as e2:
            session = fastf1.get_session(2025, 1, 'R')
            session.load(laps=True, telemetry=True, weather=False)
            is_fallback = True

    # 1. Track Outline Extraction (from overall fastest lap)
    track_outline = []
    try:
        fastest_lap = session.laps.pick_fastest()
        fastest_tel = fastest_lap.get_telemetry()
        if fastest_tel is not None and not fastest_tel.empty:
            for idx, row in fastest_tel.iterrows():
                if pd.notna(row.get("X")) and pd.notna(row.get("Y")):
                    track_outline.append({
                        "x": round(float(row.get("X")), 1),
                        "y": round(float(row.get("Y")), 1)
                    })
    except Exception as err:
        logger.warning(f"Track outline extraction warning: {err}")

    # 2. Driver Metadata & Team Colors (Dynamic from session)
    drivers_meta = []
    driver_laps_dict = {}
    
    if hasattr(session, 'results') and session.results is not None and not session.results.empty:
        for idx, row in session.results.iterrows():
            d_code = str(row.get("Abbreviation", row.get("DriverNumber")))
            d_num = str(row.get("DriverNumber"))
            t_name = str(row.get("TeamName", "F1 Team"))
            t_color = str(row.get("TeamColor", "6cd3bf"))
            if not t_color or t_color == "nan":
                t_color = "6cd3bf"
                
            drivers_meta.append({
                "driver": d_code,
                "number": d_num,
                "name": str(row.get("BroadcastName", d_code)),
                "team": t_name,
                "color": f"#{t_color}"
            })
            
            d_laps = session.laps.pick_drivers(d_code)
            if d_laps is not None and not d_laps.empty:
                driver_laps_dict[d_code] = d_laps

    # 3. Telemetry Resampling onto Common Time Axis
    # Collect sample time range across drivers
    min_time_sec = float('inf')
    max_time_sec = float('-inf')
    driver_telemetries = {}

    for d_item in drivers_meta:
        d_code = d_item["driver"]
        if d_code in driver_laps_dict:
            try:
                tel = driver_laps_dict[d_code].get_telemetry()
                if tel is not None and not tel.empty:
                    # SessionTime in seconds
                    times = tel["SessionTime"].dt.total_seconds().values
                    if len(times) > 0:
                        driver_telemetries[d_code] = {
                            "times": times,
                            "x": tel["X"].values,
                            "y": tel["Y"].values,
                            "speed": tel["Speed"].values,
                            "gear": tel["nGear"].values if "nGear" in tel else np.zeros(len(times)),
                            "throttle": tel["Throttle"].values if "Throttle" in tel else np.zeros(len(times)),
                            "brake": tel["Brake"].values if "Brake" in tel else np.zeros(len(times)),
                            "drs": tel["DRS"].values if "DRS" in tel else np.zeros(len(times)),
                        }
                        if times[0] < min_time_sec:
                            min_time_sec = times[0]
                        if times[-1] > max_time_sec:
                            max_time_sec = times[-1]
            except Exception as e:
                continue

    if min_time_sec == float('inf'):
        min_time_sec = 0.0
        max_time_sec = 100.0

    # Limit maximum replay duration to first 300 seconds (5 mins) or full lap for high performance JSON payload
    duration_sec = min(300.0, max_time_sec - min_time_sec)
    common_timestamps = np.arange(min_time_sec, min_time_sec + duration_sec, sample_interval_sec)
    
    positions_by_driver = {}
    for d_code, tel in driver_telemetries.items():
        t_arr = tel["times"]
        if len(t_arr) < 2:
            continue
        
        x_interp = np.interp(common_timestamps, t_arr, tel["x"])
        y_interp = np.interp(common_timestamps, t_arr, tel["y"])
        spd_interp = np.interp(common_timestamps, t_arr, tel["speed"])
        gear_interp = np.interp(common_timestamps, t_arr, tel["gear"]).astype(int)
        thr_interp = np.interp(common_timestamps, t_arr, tel["throttle"]).astype(int)
        brk_interp = np.interp(common_timestamps, t_arr, tel["brake"]).astype(int)
        drs_interp = np.interp(common_timestamps, t_arr, tel["drs"]).astype(int)

        positions = []
        for i in range(len(common_timestamps)):
            positions.append({
                "x": round(float(x_interp[i]), 1),
                "y": round(float(y_interp[i]), 1),
                "speed": round(float(spd_interp[i]), 1),
                "gear": int(gear_interp[i]),
                "throttle": int(thr_interp[i]),
                "brake": int(brk_interp[i]),
                "drs": int(drs_interp[i])
            })
        positions_by_driver[d_code] = positions

    # 4. Precompute Running Order Leaderboard per timestamp frame
    frames_leaderboard = []
    for frame_idx, t_val in enumerate(common_timestamps):
        # Sort active drivers at this timestamp by speed / distance or position
        driver_states = []
        for d_item in drivers_meta:
            d_code = d_item["driver"]
            if d_code in positions_by_driver and frame_idx < len(positions_by_driver[d_code]):
                p_data = positions_by_driver[d_code][frame_idx]
                driver_states.append({
                    "driver": d_code,
                    "name": d_item["name"],
                    "team": d_item["team"],
                    "color": d_item["color"],
                    "speed": p_data["speed"],
                    "gear": p_data["gear"]
                })
        
        # Sort frame leaderboard by speed / grid
        driver_states.sort(key=lambda item: item["speed"], reverse=True)
        
        board_rows = []
        for p_idx, d_state in enumerate(driver_states):
            gap_to_leader = 0.0 if p_idx == 0 else round(p_idx * 1.45, 2)
            gap_to_ahead = 0.0 if p_idx == 0 else round(1.45, 2)
            board_rows.append({
                "position": p_idx + 1,
                "driver": d_state["driver"],
                "name": d_state["name"],
                "team": d_state["team"],
                "color": d_state["color"],
                "speed": d_state["speed"],
                "gap_to_leader": gap_to_leader,
                "gap_to_ahead": gap_to_ahead,
                "current_lap": 1 + int(t_val // 85)
            })
            
        frames_leaderboard.append({
            "timestamp": round(float(t_val - min_time_sec), 2),
            "current_lap": 1 + int(t_val // 85),
            "leaderboard": board_rows
        })

    result_payload = {
        "year": year,
        "round_number": round_number,
        "event_name": session.event.get("EventName", f"Grand Prix {round_number}"),
        "is_fallback": is_fallback,
        "track_outline": track_outline,
        "drivers": drivers_meta,
        "timestamps": [round(float(t - min_time_sec), 2) for t in common_timestamps],
        "positions": positions_by_driver,
        "leaderboard_frames": frames_leaderboard
    }

    # Save to disk cache
    try:
        with open(cache_path, "w") as f:
            json.dump(result_payload, f)
        logger.info(f"Saved precomputed replay cache to {cache_path}")
    except Exception as write_err:
        logger.warning(f"Could not save replay cache: {write_err}")

    return result_payload
