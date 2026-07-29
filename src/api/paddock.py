import os
import json
import logging
import datetime
import fastf1
import pandas as pd
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException

logger = logging.getLogger("f1_paddock")
router = APIRouter(tags=["Web Paddock Module"])

CACHE_DIR = os.path.join(os.getcwd(), "f1_cache")
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

PADDOCK_CACHE_DIR = os.path.join(os.getcwd(), "data", "paddock_cache")
os.makedirs(PADDOCK_CACHE_DIR, exist_ok=True)

def pd_not_null(val):
    return pd.notna(val) and val is not None and str(val).strip() != "" and str(val) != "nan"

def load_completed_race_results(year: int = 2026) -> List[Dict[str, Any]]:
    """Ingests completed race sessions for the given year."""
    completed_races = []
    try:
        schedule = fastf1.get_event_schedule(year)
        if schedule.empty:
            return completed_races

        today_str = datetime.date.today().isoformat()

        for _, row in schedule.iterrows():
            round_no = int(row.get("RoundNumber", 0))
            if round_no == 0:
                continue

            event_date = str(row.get("EventDate", ""))[:10]
            # Stop if event is in the future
            if event_date and event_date > today_str:
                break

            try:
                session = fastf1.get_session(year, round_no, 'R')
                # Load minimal results fast
                session.load(laps=False, telemetry=False, weather=False)

                if hasattr(session, 'results') and session.results is not None and not session.results.empty:
                    if 'Position' in session.results and session.results['Position'].dropna().count() > 0:
                        completed_races.append({
                            "round_number": round_no,
                            "event_name": str(row.get("EventName", f"Round {round_no}")),
                            "official_name": str(row.get("OfficialEventName", "")),
                            "event_date": event_date,
                            "results": session.results
                        })
            except Exception as s_err:
                logger.debug(f"Session load note for {year} Round {round_no}: {s_err}")
                # If a round cannot be loaded, break to avoid delaying API
                break

    except Exception as e:
        logger.error(f"Error fetching schedule or race results for {year}: {e}")

    return completed_races

def compute_paddock_aggregates(year: int = 2026):
    """Computes driver stats, constructor stats, and standings from ingested race sessions, cached to disk."""
    cache_file = os.path.join(PADDOCK_CACHE_DIR, f"{year}_paddock_aggregates.json")
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r") as f:
                return json.load(f)
        except Exception:
            pass

    races = load_completed_race_results(year)

    drivers_dict: Dict[str, Dict[str, Any]] = {}
    constructors_dict: Dict[str, Dict[str, Any]] = {}

    for race_data in races:
        round_no = race_data["round_number"]
        event_name = race_data["event_name"]
        results = race_data["results"]

        for idx, row in results.iterrows():
            d_num = str(row.get("DriverNumber", "")) if pd_not_null(row.get("DriverNumber")) else ""
            abbr = str(row.get("Abbreviation", f"D{d_num}")) if pd_not_null(row.get("Abbreviation")) else f"D{d_num}"
            if not abbr:
                continue

            full_name = str(row.get("FullName", abbr)) if pd_not_null(row.get("FullName")) else abbr
            broadcast_name = str(row.get("BroadcastName", full_name)) if pd_not_null(row.get("BroadcastName")) else full_name
            team_name = str(row.get("TeamName", "Unknown")) if pd_not_null(row.get("TeamName")) else "Unknown"
            raw_color = str(row.get("TeamColor", "888888")) if pd_not_null(row.get("TeamColor")) else "888888"
            team_color = raw_color if raw_color and raw_color != "nan" and raw_color.strip() else "888888"
            country = str(row.get("CountryCode", "N/A")) if pd_not_null(row.get("CountryCode")) else "N/A"

            pos = int(row.get("Position")) if pd_not_null(row.get("Position")) else None
            grid_pos = int(row.get("GridPosition")) if pd_not_null(row.get("GridPosition")) else None
            pts = float(row.get("Points", 0.0)) if pd_not_null(row.get("Points")) else 0.0
            status = str(row.get("Status", "FINISHED")) if pd_not_null(row.get("Status")) else "FINISHED"

            if abbr not in drivers_dict:
                drivers_dict[abbr] = {
                    "driver_number": d_num,
                    "abbreviation": abbr,
                    "broadcast_name": broadcast_name,
                    "full_name": full_name,
                    "team_name": team_name,
                    "team_color": team_color,
                    "country": country,
                    "points": 0.0,
                    "wins": 0,
                    "podiums": 0,
                    "best_finish": None,
                    "races_completed": 0,
                    "race_history": []
                }

            d_entry = drivers_dict[abbr]
            d_entry["points"] += pts
            d_entry["races_completed"] += 1
            if pos == 1:
                d_entry["wins"] += 1
            if pos and pos <= 3:
                d_entry["podiums"] += 1
            if pos is not None:
                if d_entry["best_finish"] is None or pos < d_entry["best_finish"]:
                    d_entry["best_finish"] = pos

            d_entry["race_history"].append({
                "round_number": round_no,
                "event_name": event_name,
                "grid_position": grid_pos,
                "position": pos,
                "points": pts,
                "status": status
            })

            if team_name not in constructors_dict:
                constructors_dict[team_name] = {
                    "team_name": team_name,
                    "team_color": team_color,
                    "points": 0.0,
                    "wins": 0,
                    "podiums": 0,
                    "best_finish": None,
                    "drivers": set()
                }

            c_entry = constructors_dict[team_name]
            c_entry["points"] += pts
            c_entry["drivers"].add(abbr)
            if pos == 1:
                c_entry["wins"] += 1
            if pos and pos <= 3:
                c_entry["podiums"] += 1
            if pos is not None:
                if c_entry["best_finish"] is None or pos < c_entry["best_finish"]:
                    c_entry["best_finish"] = pos

    sorted_drivers = sorted(
        drivers_dict.values(),
        key=lambda d: (d["points"], d["wins"], -(d["best_finish"] or 999)),
        reverse=True
    )
    for rank, d in enumerate(sorted_drivers, start=1):
        d["championship_position"] = rank

    sorted_constructors = []
    for c_name, c_data in constructors_dict.items():
        sorted_constructors.append({
            "team_name": c_data["team_name"],
            "team_color": c_data["team_color"],
            "points": c_data["points"],
            "wins": c_data["wins"],
            "podiums": c_data["podiums"],
            "best_finish": c_data["best_finish"],
            "drivers": list(c_data["drivers"])
        })
    sorted_constructors.sort(
        key=lambda c: (c["points"], c["wins"], -(c["best_finish"] or 999)),
        reverse=True
    )
    for rank, c in enumerate(sorted_constructors, start=1):
        c["championship_position"] = rank

    payload = {
        "races_loaded": len(races),
        "drivers": sorted_drivers,
        "constructors": sorted_constructors
    }

    try:
        with open(cache_file, "w") as f:
            json.dump(payload, f)
    except Exception as e:
        logger.error(f"Error caching paddock aggregates: {e}")

    return payload


# Endpoints

@router.get("/calendar")
@router.get("/api/calendar")
@router.get("/api/paddock/calendar/{year}")
def get_season_calendar(year: int = 2026):
    """Fetches full Formula 1 season calendar with race completed status from FastF1."""
    try:
        schedule = fastf1.get_event_schedule(year)
        if schedule.empty:
            raise HTTPException(status_code=404, detail=f"Calendar schedule for {year} not found")

        today_str = datetime.date.today().isoformat()
        events = []

        for _, row in schedule.iterrows():
            round_no = int(row.get("RoundNumber", 0))
            if round_no == 0:
                continue

            event_name = str(row.get("EventName", ""))
            official_name = str(row.get("OfficialEventName", event_name))
            location = str(row.get("Location", ""))
            country = str(row.get("Country", ""))
            event_date = str(row.get("EventDate", ""))[:10]
            f1_api_support = bool(row.get("F1ApiSupport", False))

            is_completed = bool(event_date and event_date <= today_str)

            events.append({
                "round_number": round_no,
                "event_name": event_name,
                "official_name": official_name,
                "location": location,
                "country": country,
                "event_date": event_date,
                "f1_api_support": f1_api_support,
                "is_completed": is_completed
            })

        return {
            "year": year,
            "total_rounds": len(events),
            "events": events
        }
    except Exception as e:
        logger.error(f"Error fetching calendar for {year}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed loading season calendar: {str(e)}")


@router.get("/standings/drivers")
@router.get("/api/standings/drivers")
@router.get("/api/paddock/standings/{year}")
def get_driver_standings(year: int = 2026):
    """Computes dynamic driver and constructor championship standings from ingested race sessions."""
    try:
        aggregates = compute_paddock_aggregates(year)
        drivers = aggregates["drivers"]
        constructors = aggregates["constructors"]

        is_available = aggregates["races_loaded"] > 0

        return {
            "year": year,
            "races_completed": aggregates["races_loaded"],
            "is_available": is_available,
            "message": "Dynamic standings calculated from FastF1 completed sessions" if is_available else f"No completed {year} race sessions available in FastF1 yet",
            "drivers": drivers,
            "constructors": constructors
        }
    except Exception as e:
        logger.error(f"Error computing standings for {year}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed computing standings: {str(e)}")


@router.get("/standings/constructors")
@router.get("/api/standings/constructors")
def get_constructor_standings(year: int = 2026):
    """Computes dynamic constructor standings from completed race sessions."""
    try:
        aggregates = compute_paddock_aggregates(year)
        constructors = aggregates["constructors"]
        is_available = aggregates["races_loaded"] > 0

        return {
            "year": year,
            "races_completed": aggregates["races_loaded"],
            "is_available": is_available,
            "constructors": constructors
        }
    except Exception as e:
        logger.error(f"Error computing constructor standings for {year}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed computing constructor standings: {str(e)}")


@router.get("/drivers")
@router.get("/api/drivers")
@router.get("/api/paddock/drivers")
def get_drivers_list(year: int = 2026):
    """Returns list of drivers extracted from loaded session data."""
    try:
        aggregates = compute_paddock_aggregates(year)
        drivers = aggregates["drivers"]

        return {
            "year": year,
            "total_drivers": len(drivers),
            "is_available": len(drivers) > 0,
            "drivers": drivers
        }
    except Exception as e:
        logger.error(f"Error loading drivers list for {year}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed loading drivers: {str(e)}")


@router.get("/drivers/{driver_id}")
@router.get("/api/drivers/{driver_id}")
def get_driver_profile(driver_id: str, year: int = 2026):
    """Returns detailed profile and race history for a specific driver (by abbreviation or driver number)."""
    try:
        aggregates = compute_paddock_aggregates(year)
        drivers = aggregates["drivers"]

        match_id = driver_id.strip().upper()
        target_driver = None

        for d in drivers:
            if d["abbreviation"].upper() == match_id or d["driver_number"] == match_id or d["full_name"].upper() == match_id:
                target_driver = d
                break

        if not target_driver:
            raise HTTPException(status_code=404, detail=f"Driver '{driver_id}' not found in loaded race data")

        return {
            "year": year,
            "driver": target_driver
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading profile for driver {driver_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed loading driver profile: {str(e)}")


@router.get("/teams")
@router.get("/api/teams")
@router.get("/api/paddock/teams")
def get_teams_list(year: int = 2026):
    """Returns list of constructor teams with points and driver rosters."""
    try:
        aggregates = compute_paddock_aggregates(year)
        constructors = aggregates["constructors"]
        drivers = {d["abbreviation"]: d for d in aggregates["drivers"]}

        teams_payload = []
        for c in constructors:
            roster = [drivers[abbr] for abbr in c["drivers"] if abbr in drivers]
            teams_payload.append({
                "team_name": c["team_name"],
                "team_color": c["team_color"],
                "championship_position": c["championship_position"],
                "points": c["points"],
                "wins": c["wins"],
                "podiums": c["podiums"],
                "best_finish": c["best_finish"],
                "drivers": roster
            })

        return {
            "year": year,
            "total_teams": len(teams_payload),
            "is_available": len(teams_payload) > 0,
            "teams": teams_payload
        }
    except Exception as e:
        logger.error(f"Error loading teams list for {year}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed loading teams: {str(e)}")
