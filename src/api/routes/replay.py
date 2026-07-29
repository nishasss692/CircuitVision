import os
import json
import logging
import fastf1
import pandas as pd
import numpy as np
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("f1_replay")

# Enable FastF1 disk cache
CACHE_DIR = os.path.join(os.getcwd(), "f1_cache")
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

# Disk cache for computed replay/leaderboard JSON
REPLAY_CACHE_DIR = os.path.join(os.getcwd(), "data", "replay_cache")
os.makedirs(REPLAY_CACHE_DIR, exist_ok=True)

router = APIRouter(tags=["2D Race Replay Module"])

def get_replay_cache_path(year: int, round_no: int, cache_type: str) -> str:
    return os.path.join(REPLAY_CACHE_DIR, f"{year}_round_{round_no}_{cache_type}.json")

def load_session_for_replay(year: int = 2026, round_no: int = 1):
    """Loads FastF1 race session. If requested 2026/future session has no telemetry, falls back to historical session."""
    session_type = 'R'
    try:
        session = fastf1.get_session(year, round_no, session_type)
        session.load(laps=True, telemetry=True, weather=False)
        if hasattr(session, 'pos_data') and session.pos_data:
            return session, year, False
        raise ValueError("No position telemetry in session")
    except Exception as e:
        logger.warning(f"Could not load 2026 session {year} R{round_no}: {e}. Fallback to historical session...")
        try:
            fb_session = fastf1.get_session(2024, round_no, session_type)
            fb_session.load(laps=True, telemetry=True, weather=False)
            return fb_session, 2024, True
        except Exception as fb_err:
            logger.warning(f"Fallback 1 failed: {fb_err}. Fallback to 2024 Round 1...")
            fb_session2 = fastf1.get_session(2024, 1, session_type)
            fb_session2.load(laps=True, telemetry=True, weather=False)
            return fb_session2, 2024, True

def build_event_metadata(session, year: int, round_no: int, is_fallback: bool) -> Dict[str, Any]:
    event_info = session.event if hasattr(session, 'event') else {}
    return {
        "year": year,
        "round_number": round_no,
        "event_name": str(event_info.get("EventName", f"Grand Prix Round {round_no}")),
        "official_name": str(event_info.get("OfficialEventName", f"Formula 1 Grand Prix Round {round_no}")),
        "country": str(event_info.get("Country", "Global")),
        "location": str(event_info.get("Location", "")),
        "circuit": str(event_info.get("EventName", "Grand Prix Circuit")),
        "is_fallback": is_fallback
    }

def process_replay_and_leaderboard(year: int, round_no: int):
    """Computes track outline, sampled multi-car telemetry frames, and synced leaderboard frames."""
    replay_file = get_replay_cache_path(year, round_no, "replay")
    leaderboard_file = get_replay_cache_path(year, round_no, "leaderboard")

    if os.path.exists(replay_file) and os.path.exists(leaderboard_file):
        with open(replay_file, "r") as f:
            replay_data = json.load(f)
        with open(leaderboard_file, "r") as f:
            leaderboard_data = json.load(f)
        return replay_data, leaderboard_data

    session, loaded_year, is_fallback = load_session_for_replay(year, round_no)
    event_meta = build_event_metadata(session, year, round_no, is_fallback)

    # 1. Driver Metadata from session.results (never hardcode!)
    driver_metadata = {}
    if hasattr(session, 'results') and session.results is not None and not session.results.empty:
        for _, row in session.results.iterrows():
            d_num = str(row['DriverNumber'])
            d_abbr = str(row['Abbreviation']) if pd.notna(row['Abbreviation']) else f"D{d_num}"
            team_name = str(row['TeamName']) if pd.notna(row['TeamName']) else "F1 Team"
            raw_color = str(row['TeamColor']) if pd.notna(row['TeamColor']) else ""
            team_color = f"#{raw_color}" if raw_color and raw_color != "nan" and raw_color.strip() else "#00f0ff"
            grid_pos = int(row['GridPosition']) if pd.notna(row['GridPosition']) else 20
            final_pos = int(row['Position']) if pd.notna(row['Position']) else 20
            full_name = str(row['FullName']) if pd.notna(row['FullName']) else d_abbr

            driver_metadata[d_abbr] = {
                "driver_number": d_num,
                "abbreviation": d_abbr,
                "full_name": full_name,
                "team": team_name,
                "team_color": team_color,
                "grid_position": grid_pos,
                "final_position": final_pos
            }

    # 2. Track Outline from fastest lap telemetry
    track_outline = []
    try:
        fastest_lap = session.laps.pick_fastest()
        fastest_tel = fastest_lap.get_telemetry()
        for _, row in fastest_tel.iterrows():
            if pd.notna(row['X']) and pd.notna(row['Y']):
                track_outline.append({"x": round(float(row['X']), 1), "y": round(float(row['Y']), 1)})
    except Exception as e:
        logger.warning(f"Could not extract track outline from fastest lap: {e}")

    if not track_outline and hasattr(session, 'pos_data') and session.pos_data:
        first_driver_pos = list(session.pos_data.values())[0]
        if first_driver_pos is not None and not first_driver_pos.empty:
            sample_df = first_driver_pos.dropna(subset=['X', 'Y']).iloc[::10]
            for _, row in sample_df.iterrows():
                track_outline.append({"x": round(float(row['X']), 1), "y": round(float(row['Y']), 1)})

    # 3. Process Telemetry & Resample onto Common Time Axis
    num_to_abbr = {meta['driver_number']: abbr for abbr, meta in driver_metadata.items()}

    min_t = float('inf')
    max_t = float('-inf')
    driver_pos_map = {}
    driver_car_map = {}

    if hasattr(session, 'pos_data') and session.pos_data:
        for d_num, pos_df in session.pos_data.items():
            if pos_df is None or pos_df.empty:
                continue
            pos_df = pos_df.dropna(subset=['X', 'Y', 'SessionTime']).copy()
            if pos_df.empty:
                continue
            
            pos_df['SessionTimeSec'] = pos_df['SessionTime'].dt.total_seconds()
            abbr = num_to_abbr.get(str(d_num), str(d_num))
            driver_pos_map[abbr] = pos_df
            
            min_t = min(min_t, pos_df['SessionTimeSec'].min())
            max_t = max(max_t, pos_df['SessionTimeSec'].max())

    if hasattr(session, 'car_data') and session.car_data:
        for d_num, car_df in session.car_data.items():
            if car_df is None or car_df.empty:
                continue
            car_df = car_df.dropna(subset=['SessionTime']).copy()
            if car_df.empty:
                continue
            car_df['SessionTimeSec'] = car_df['SessionTime'].dt.total_seconds()
            abbr = num_to_abbr.get(str(d_num), str(d_num))
            driver_car_map[abbr] = car_df

    if min_t == float('inf') or max_t == float('-inf'):
        min_t, max_t = 0.0, 100.0

    # Fixed sampling interval dt = 0.5s session time
    dt = 0.5
    time_grid = np.arange(min_t, max_t, dt)

    resampled_drivers = {}
    for abbr, pos_df in driver_pos_map.items():
        t_sec = pos_df['SessionTimeSec'].values
        x_vals = pos_df['X'].values
        y_vals = pos_df['Y'].values

        interp_x = np.interp(time_grid, t_sec, x_vals)
        interp_y = np.interp(time_grid, t_sec, y_vals)

        # Compute velocity gradient for car heading angle (radians)
        dx = np.gradient(interp_x)
        dy = np.gradient(interp_y)
        heading_vals = np.arctan2(dy, dx)

        if abbr in driver_car_map:
            car_df = driver_car_map[abbr]
            car_t = car_df['SessionTimeSec'].values
            interp_speed = np.interp(time_grid, car_t, car_df['Speed'].values if 'Speed' in car_df else np.zeros(len(car_t)))
            interp_gear = np.interp(time_grid, car_t, car_df['nGear'].values if 'nGear' in car_df else np.zeros(len(car_t)))
            interp_drs = np.interp(time_grid, car_t, car_df['DRS'].values if 'DRS' in car_df else np.zeros(len(car_t)))
            interp_throttle = np.interp(time_grid, car_t, car_df['Throttle'].values if 'Throttle' in car_df else np.zeros(len(car_t)))
            interp_brake = np.interp(time_grid, car_t, car_df['Brake'].values if 'Brake' in car_df else np.zeros(len(car_t)))
        else:
            interp_speed = np.zeros(len(time_grid))
            interp_gear = np.zeros(len(time_grid))
            interp_drs = np.zeros(len(time_grid))
            interp_throttle = np.zeros(len(time_grid))
            interp_brake = np.zeros(len(time_grid))

        resampled_drivers[abbr] = {
            "x": interp_x,
            "y": interp_y,
            "heading": heading_vals,
            "speed": interp_speed,
            "gear": interp_gear,
            "drs": interp_drs,
            "throttle": interp_throttle,
            "brake": interp_brake,
            "min_t": t_sec.min(),
            "max_t": t_sec.max()
        }

    # 4. Pre-calculate Lap Fast Lookups (vectorized)
    driver_lap_lookup = {}
    if hasattr(session, 'laps') and session.laps is not None and not session.laps.empty:
        laps_df = session.laps.dropna(subset=['LapStartTime', 'Time', 'LapNumber']).copy()
        if not laps_df.empty:
            laps_df['StartTimeSec'] = laps_df['LapStartTime'].dt.total_seconds()
            laps_df['EndTimeSec'] = laps_df['Time'].dt.total_seconds()
            laps_df['DurationSec'] = laps_df['LapTime'].dt.total_seconds()

            for abbr in driver_metadata.keys():
                d_laps = laps_df[laps_df['Driver'] == abbr].sort_values('LapNumber')
                if not d_laps.empty:
                    driver_lap_lookup[abbr] = {
                        "starts": d_laps['StartTimeSec'].values,
                        "ends": d_laps['EndTimeSec'].values,
                        "durs": d_laps['DurationSec'].values,
                        "numbers": d_laps['LapNumber'].values.astype(int),
                        "min_start": d_laps['StartTimeSec'].min(),
                        "max_end": d_laps['EndTimeSec'].max(),
                        "max_lap": int(d_laps['LapNumber'].max())
                    }

    # Sample time steps: cap at ~2000 points max for smooth animation & fast payload
    step_stride = 1
    if len(time_grid) > 2500:
        step_stride = int(np.ceil(len(time_grid) / 2000.0))

    sampled_time_grid = time_grid[::step_stride]
    normalized_timestamps = (sampled_time_grid - min_t).round(2).tolist()

    replay_frames = []
    leaderboard_frames = []

    for step_idx, abs_t in enumerate(sampled_time_grid):
        rel_t = round(float(abs_t - min_t), 2)
        grid_idx = step_idx * step_stride

        driver_progress_list = []

        for abbr, meta in driver_metadata.items():
            if abbr in resampled_drivers:
                d_res = resampled_drivers[abbr]
                if abs_t < d_res['min_t'] - 10 or abs_t > d_res['max_t'] + 10:
                    continue
                
                cx = round(float(d_res['x'][grid_idx]), 1)
                cy = round(float(d_res['y'][grid_idx]), 1)
                heading = round(float(d_res['heading'][grid_idx]), 3)
                spd = int(round(float(d_res['speed'][grid_idx])))
                gear = int(round(float(d_res['gear'][grid_idx])))
                raw_drs = float(d_res['drs'][grid_idx])
                drs_active = bool(raw_drs >= 8 or raw_drs in [10, 12, 14])
                throttle = int(round(float(d_res['throttle'][grid_idx])))
                brake = int(round(float(d_res['brake'][grid_idx])))
            else:
                continue

            # Fast lap calculation using numpy binary search
            lap_num = 1
            progress = 0.0
            lap_dur = 85.0
            if abbr in driver_lap_lookup:
                lookup = driver_lap_lookup[abbr]
                if abs_t < lookup["min_start"]:
                    grid_p = meta.get('grid_position', 20)
                    progress = -(grid_p / 100.0)
                    lap_num = 1
                elif abs_t > lookup["max_end"]:
                    final_p = meta.get('final_position', 20)
                    progress = lookup["max_lap"] + 1.0 - (final_p / 100.0)
                    lap_num = lookup["max_lap"]
                else:
                    idx = np.searchsorted(lookup["ends"], abs_t)
                    if idx < len(lookup["starts"]):
                        s_t = lookup["starts"][idx]
                        dur = lookup["durs"][idx] if lookup["durs"][idx] > 0 else 85.0
                        lap_num = int(lookup["numbers"][idx])
                        frac = max(0.0, min(1.0, (abs_t - s_t) / dur))
                        progress = (lap_num - 1) + frac
                        lap_dur = dur
                    else:
                        lap_num = lookup["max_lap"]
                        progress = float(lap_num)

            driver_progress_list.append({
                "driver": abbr,
                "team": meta['team'],
                "team_color": meta['team_color'],
                "x": cx,
                "y": cy,
                "heading": heading,
                "speed": spd,
                "gear": gear,
                "drs": drs_active,
                "throttle": throttle,
                "brake": brake,
                "lap": lap_num,
                "lap_dur": lap_dur,
                "progress": progress
            })

        # Sort drivers by race progress descending to get position
        driver_progress_list.sort(key=lambda item: item['progress'], reverse=True)
        leader_progress = driver_progress_list[0]['progress'] if driver_progress_list else 0.0
        leader_lap_dur = driver_progress_list[0]['lap_dur'] if driver_progress_list else 85.0

        frame_cars = []
        frame_leaderboard = []

        for pos_idx, d_item in enumerate(driver_progress_list):
            pos = pos_idx + 1
            prog_diff = leader_progress - d_item['progress']
            gap_val = prog_diff * leader_lap_dur

            if pos == 1:
                gap_str = "LEADER"
            elif prog_diff >= 1.0:
                laps_behind = int(np.floor(prog_diff))
                gap_str = f"+{laps_behind} LAP{'S' if laps_behind > 1 else ''}"
            else:
                gap_str = f"+{gap_val:.1f}s"

            frame_cars.append({
                "driver": d_item['driver'],
                "x": d_item['x'],
                "y": d_item['y'],
                "heading": d_item['heading'],
                "speed": d_item['speed'],
                "gear": d_item['gear'],
                "drs": d_item['drs'],
                "throttle": d_item['throttle'],
                "brake": d_item['brake'],
                "lap": d_item['lap'],
                "position": pos
            })

            frame_leaderboard.append({
                "position": pos,
                "driver": d_item['driver'],
                "team": d_item['team'],
                "team_color": d_item['team_color'],
                "current_lap": d_item['lap'],
                "gap_to_leader": gap_str,
                "speed": d_item['speed'],
                "gear": d_item['gear'],
                "drs": d_item['drs']
            })

        replay_frames.append({
            "timestamp": rel_t,
            "cars": frame_cars
        })

        leaderboard_frames.append({
            "timestamp": rel_t,
            "leaderboard": frame_leaderboard
        })

    replay_payload = {
        "event": event_meta,
        "track_outline": track_outline,
        "driver_metadata": driver_metadata,
        "timestamps": normalized_timestamps,
        "total_frames": len(replay_frames),
        "frames": replay_frames
    }

    leaderboard_payload = {
        "event": event_meta,
        "timestamps": normalized_timestamps,
        "total_frames": len(leaderboard_frames),
        "frames": leaderboard_frames
    }

    try:
        with open(replay_file, "w") as f:
            json.dump(replay_payload, f)
        with open(leaderboard_file, "w") as f:
            json.dump(leaderboard_payload, f)
        logger.info(f"Cached replay & leaderboard JSON for {year} Round {round_no}")
    except Exception as e:
        logger.error(f"Failed writing cache files: {e}")

    return replay_payload, leaderboard_payload


# API Routes

@router.get("/events")
@router.get("/api/events")
def get_2026_events(year: int = 2026):
    """Returns list of 2026 Grand Prix race events (race sessions only)."""
    try:
        schedule = fastf1.get_event_schedule(year)
        if schedule is None or schedule.empty:
            raise HTTPException(status_code=404, detail="Schedule not found")

        events = []
        for _, row in schedule.iterrows():
            round_no = int(row['RoundNumber'])
            if round_no == 0:  # Skip pre-season testing
                continue
            
            event_name = str(row['EventName'])
            official_name = str(row.get('OfficialEventName', event_name))
            country = str(row.get('Country', ''))
            location = str(row.get('Location', ''))
            event_date = str(row.get('EventDate', ''))[:10]

            events.append({
                "round_number": round_no,
                "name": event_name,
                "official_name": official_name,
                "country": country,
                "location": location,
                "circuit": f"{event_name} Circuit",
                "date": event_date,
                "session_type": "R"
            })

        return {
            "year": year,
            "total_events": len(events),
            "events": events
        }
    except Exception as e:
        logger.error(f"Error loading events for {year}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed fetching events: {str(e)}")


@router.get("/events/{event_id}/replay")
@router.get("/api/events/{event_id}/replay")
def get_event_replay(event_id: str, year: int = 2026):
    """Returns track outline, driver metadata, and resampled multi-car position replay frames."""
    try:
        try:
            round_no = int(event_id)
        except ValueError:
            round_no = 1

        replay_data, _ = process_replay_and_leaderboard(year, round_no)
        return replay_data
    except Exception as e:
        logger.error(f"Error producing replay for event {event_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed loading replay: {str(e)}")


@router.get("/events/{event_id}/leaderboard")
@router.get("/api/events/{event_id}/leaderboard")
def get_event_leaderboard(event_id: str, year: int = 2026):
    """Returns timestamp-synced running order & gap to leader frames for replay animation."""
    try:
        try:
            round_no = int(event_id)
        except ValueError:
            round_no = 1

        _, leaderboard_data = process_replay_and_leaderboard(year, round_no)
        return leaderboard_data
    except Exception as e:
        logger.error(f"Error producing leaderboard for event {event_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed loading leaderboard: {str(e)}")
