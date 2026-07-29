import numpy as np
import pandas as pd
from typing import Any, Dict, List, Optional, Union

def clean_value(val: Any) -> Any:
    """Converts numpy/pandas missing or complex types into JSON-serializable standard Python types."""
    if pd.isna(val) or val is None:
        return None
    if isinstance(val, (pd.Timedelta, np.timedelta64)):
        total_sec = val.total_seconds()
        return round(total_sec, 3) if not pd.isna(total_sec) else None
    if isinstance(val, (pd.Timestamp, np.datetime64)):
        return val.isoformat()
    if isinstance(val, (np.integer, int)):
        return int(val)
    if isinstance(val, (np.floating, float)):
        if np.isnan(val) or np.isinf(val):
            return None
        return round(float(val), 4)
    if isinstance(val, (np.bool_, bool)):
        return bool(val)
    return str(val)

def format_timedelta_str(seconds: Optional[float]) -> Optional[str]:
    """Formats a float seconds value into MM:SS.mmm format."""
    if seconds is None or seconds <= 0:
        return None
    minutes = int(seconds // 60)
    secs = seconds % 60
    return f"{minutes}:{secs:06.3f}"

def normalize_dataframe(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Converts a pandas DataFrame into a list of cleaned JSON-serializable dictionaries."""
    if df is None or df.empty:
        return []
    
    cleaned_records = []
    records = df.to_dict(orient="records")
    for rec in records:
        cleaned_rec = {col: clean_value(val) for col, val in rec.items()}
        cleaned_records.append(cleaned_rec)
    return cleaned_records

def normalize_session_summary(session) -> Dict[str, Any]:
    """Extracts high level normalized info from a FastF1 Session object."""
    event_info = session.event
    results_list = []
    
    if hasattr(session, 'results') and session.results is not None and not session.results.empty:
        for idx, row in session.results.iterrows():
            results_list.append({
                "driver_number": clean_value(row.get("DriverNumber")),
                "broadcast_name": clean_value(row.get("BroadcastName")),
                "full_name": clean_value(row.get("FullName")),
                "abbreviation": clean_value(row.get("Abbreviation")),
                "team_name": clean_value(row.get("TeamName")),
                "team_color": clean_value(row.get("TeamColor")),
                "position": clean_value(row.get("Position")),
                "grid_position": clean_value(row.get("GridPosition")),
                "status": clean_value(row.get("Status")),
                "points": clean_value(row.get("Points")),
                "time_delta": clean_value(row.get("Time")),
            })
            
    return {
        "year": clean_value(event_info.get("Year")),
        "round_number": clean_value(event_info.get("RoundNumber")),
        "event_name": clean_value(event_info.get("EventName")),
        "official_event_name": clean_value(event_info.get("OfficialEventName")),
        "country": clean_value(event_info.get("Country")),
        "location": clean_value(event_info.get("Location")),
        "session_name": session.name,
        "session_date": clean_value(session.date),
        "drivers_count": len(results_list),
        "results": results_list
    }

def normalize_laps(session) -> List[Dict[str, Any]]:
    """Extracts normalized lap times, sector times, compounds, and pit stops from FastF1 session laps."""
    if not hasattr(session, 'laps') or session.laps is None or session.laps.empty:
        return []
    
    laps_data = []
    for idx, lap in session.laps.iterrows():
        lap_time_sec = clean_value(lap.get("LapTime"))
        s1_sec = clean_value(lap.get("Sector1Time"))
        s2_sec = clean_value(lap.get("Sector2Time"))
        s3_sec = clean_value(lap.get("Sector3Time"))
        
        laps_data.append({
            "lap_number": clean_value(lap.get("LapNumber")),
            "driver": clean_value(lap.get("Driver")),
            "driver_number": clean_value(lap.get("DriverNumber")),
            "lap_time": lap_time_sec,
            "lap_time_str": format_timedelta_str(lap_time_sec),
            "sector_1": s1_sec,
            "sector_2": s2_sec,
            "sector_3": s3_sec,
            "compound": clean_value(lap.get("Compound")),
            "tyre_life": clean_value(lap.get("TyreLife")),
            "fresh_tyre": clean_value(lap.get("FreshTyre")),
            "stint": clean_value(lap.get("Stint")),
            "pit_out_time": clean_value(lap.get("PitOutTime")),
            "pit_in_time": clean_value(lap.get("PitInTime")),
            "is_personal_best": clean_value(lap.get("IsPersonalBest")),
            "is_accurate": clean_value(lap.get("IsAccurate")),
            "track_status": clean_value(lap.get("TrackStatus")),
        })
    return laps_data

def normalize_telemetry(session, driver: Optional[str] = None, lap_number: Optional[int] = None) -> List[Dict[str, Any]]:
    """Extracts car position & sensor telemetry (X, Y, Z, Speed, Throttle, Brake, nGear, DRS, Distance)."""
    if not hasattr(session, 'laps') or session.laps is None or session.laps.empty:
        return []
    
    laps_subset = session.laps
    if driver:
        laps_subset = laps_subset[laps_subset['Driver'] == str(driver).upper()]
    if lap_number and not laps_subset.empty:
        laps_subset = laps_subset[laps_subset['LapNumber'] == lap_number]
        
    if laps_subset.empty:
        return []

    telemetry_records = []
    # If single driver lap requested, get full telemetry stream for that lap
    for idx, lap in laps_subset.iterrows():
        try:
            tel = lap.get_telemetry()
            if tel is None or tel.empty:
                continue
            
            for t_idx, row in tel.iterrows():
                telemetry_records.append({
                    "time": clean_value(row.get("Time")),
                    "session_time": clean_value(row.get("SessionTime")),
                    "driver": str(lap.get("Driver")),
                    "lap_number": int(lap.get("LapNumber")),
                    "x": clean_value(row.get("X")),
                    "y": clean_value(row.get("Y")),
                    "z": clean_value(row.get("Z")),
                    "speed": clean_value(row.get("Speed")),
                    "rpm": clean_value(row.get("RPM")),
                    "gear": clean_value(row.get("nGear")),
                    "throttle": clean_value(row.get("Throttle")),
                    "brake": clean_value(row.get("Brake")),
                    "drs": clean_value(row.get("DRS")),
                    "distance": clean_value(row.get("Distance")),
                    "relative_distance": clean_value(row.get("RelativeDistance")),
                })
        except Exception as e:
            continue
            
    return telemetry_records

def normalize_weather(session) -> List[Dict[str, Any]]:
    """Extracts weather data per timestamp (AirTemp, TrackTemp, Humidity, Pressure, WindSpeed, Rain)."""
    if not hasattr(session, 'weather_data') or session.weather_data is None or session.weather_data.empty:
        return []
    
    weather_records = []
    for idx, row in session.weather_data.iterrows():
        weather_records.append({
            "time": clean_value(row.get("Time")),
            "air_temp": clean_value(row.get("AirTemp")),
            "humidity": clean_value(row.get("Humidity")),
            "pressure": clean_value(row.get("Pressure")),
            "rainfall": clean_value(row.get("Rainfall")),
            "track_temp": clean_value(row.get("TrackTemp")),
            "wind_direction": clean_value(row.get("WindDirection")),
            "wind_speed": clean_value(row.get("WindSpeed")),
        })
    return weather_records
