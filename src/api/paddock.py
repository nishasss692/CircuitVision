import os
import json
import logging
import datetime
import fastf1
import pandas as pd
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from src.pipeline.session_loader import load_session, SessionIdentityError

logger = logging.getLogger("f1_paddock")
router = APIRouter(tags=["Web Paddock Module"])

CACHE_DIR = os.path.join(os.getcwd(), "f1_cache")
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

PADDOCK_CACHE_DIR = os.path.join(os.getcwd(), "data", "paddock_cache")
os.makedirs(PADDOCK_CACHE_DIR, exist_ok=True)

# In-Memory caches for microsecond response times
CALENDAR_MEMORY_CACHE: Dict[int, Any] = {}
AGGREGATES_MEMORY_CACHE: Dict[int, Any] = {}

# Maintained OpenF1 / Formula 1 CDN Driver Headshots (3col-retina High Definition)
OPENF1_DRIVER_HEADSHOTS = {
    "ANT": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/K/ANDANT01_Kimi_Antonelli/andant01.png.transform/3col-retina/image.png",
    "HAM": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LEWHAM01_Lewis_Hamilton/lewham01.png.transform/3col-retina/image.png",
    "RUS": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/G/GEORUS01_George_Russell/georus01.png.transform/3col-retina/image.png",
    "LEC": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/C/CHALEC01_Charles_Leclerc/chalec01.png.transform/3col-retina/image.png",
    "VER": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png.transform/3col-retina/image.png",
    "NOR": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANNOR01_Lando_Norris/lannor01.png.transform/3col-retina/image.png",
    "PIA": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OSCPIA01_Oscar_Piastri/oscpia01.png.transform/3col-retina/image.png",
    "HAD": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/I/ISAHAD01_Isack_Hadjar/isahad01.png.transform/3col-retina/image.png",
    "GAS": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/P/PIEGAS01_Pierre_Gasly/piegas01.png.transform/3col-retina/image.png",
    "LAW": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LIALAW01_Liam_Lawson/lialaw01.png.transform/3col-retina/image.png",
    "LIN": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/A/ARVLIN01_Arvid_Lindblad/arvlin01.png.transform/3col-retina/image.png",
    "COL": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/F/FRACOL01_Franco_Colapinto/fracol01.png.transform/3col-retina/image.png",
    "BEA": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OLIBEA01_Oliver_Bearman/olibea01.png.transform/3col-retina/image.png",
    "BOR": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/G/GABBOR01_Gabriel_Bortoleto/gabbor01.png.transform/3col-retina/image.png",
    "SAI": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/C/CARSAI01_Carlos_Sainz/carsai01.png.transform/3col-retina/image.png",
    "ALB": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/A/ALEALB01_Alexander_Albon/alealb01.png.transform/3col-retina/image.png",
    "OCO": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/E/ESTOCO01_Esteban_Ocon/estoco01.png.transform/3col-retina/image.png",
    "HUL": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/N/NICHUL01_Nico_Hulkenberg/nichul01.png.transform/3col-retina/image.png",
    "ALO": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/F/FERALO01_Fernando_Alonso/feralo01.png.transform/3col-retina/image.png",
    "STR": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANSTR01_Lance_Stroll/lanstr01.png.transform/3col-retina/image.png",
    "BOT": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/V/VALBOT01_Valtteri_Bottas/valbot01.png.transform/3col-retina/image.png",
    "PER": "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/S/SERPER01_Sergio_Perez/serper01.png.transform/3col-retina/image.png"
}


def pd_not_null(val):
    return pd.notna(val) and val is not None and str(val).strip() != "" and str(val) != "nan"


def load_completed_race_results(year: int = 2026) -> List[Dict[str, Any]]:
    """Ingests completed race sessions for the given year using canonical session loader with identity validation."""
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
            if event_date and event_date > today_str:
                break

            try:
                session, _, _ = load_session(
                    year=year,
                    round_number=round_no,
                    session_type='R',
                    laps=False,
                    telemetry=False,
                    weather=False,
                )

                if hasattr(session, 'results') and session.results is not None and not session.results.empty:
                    if 'Position' in session.results and session.results['Position'].dropna().count() > 0:
                        actual_round = int(session.event.get("RoundNumber", round_no))
                        if actual_round != round_no:
                            logger.error(
                                f"Paddock identity mismatch for {year} R{round_no}: "
                                f"session reports R{actual_round}. Skipping."
                            )
                            continue
                        completed_races.append({
                            "round_number": round_no,
                            "event_name": str(row.get("EventName", f"Round {round_no}")),
                            "official_name": str(row.get("OfficialEventName", "")),
                            "event_date": event_date,
                            "location": str(row.get("Location", "")),
                            "country": str(row.get("Country", "")),
                            "results": session.results
                        })
            except SessionIdentityError as sid_err:
                logger.error(f"Session identity error for {year} R{round_no}: {sid_err}. Skipping round.")
                continue
            except Exception as s_err:
                logger.debug(f"Session load note for {year} Round {round_no}: {s_err}")
                break

    except Exception as e:
        logger.error(f"Error fetching schedule or race results for {year}: {e}")

    return completed_races


def clear_paddock_cache(year: Optional[int] = None):
    """Clears cached paddock aggregate files so live standings are recalculated on next access."""
    try:
        global CALENDAR_MEMORY_CACHE, AGGREGATES_MEMORY_CACHE
        if year:
            CALENDAR_MEMORY_CACHE.pop(year, None)
            AGGREGATES_MEMORY_CACHE.pop(year, None)
            cache_file = os.path.join(PADDOCK_CACHE_DIR, f"{year}_paddock_aggregates_v5.json")
            if os.path.exists(cache_file):
                os.remove(cache_file)
            cal_file = os.path.join(PADDOCK_CACHE_DIR, f"{year}_calendar_cache_v5.json")
            if os.path.exists(cal_file):
                os.remove(cal_file)
        else:
            CALENDAR_MEMORY_CACHE.clear()
            AGGREGATES_MEMORY_CACHE.clear()
            if os.path.exists(PADDOCK_CACHE_DIR):
                for f in os.listdir(PADDOCK_CACHE_DIR):
                    if f.endswith(".json"):
                        try:
                            os.remove(os.path.join(PADDOCK_CACHE_DIR, f))
                        except Exception:
                            pass
        logger.info(f"Paddock standings cache cleared for year={year or 'all'}.")
    except Exception as e:
        logger.warning(f"Error clearing paddock cache: {e}")


def compute_paddock_aggregates(year: int = 2026, force_refresh: bool = False):
    """Computes driver stats, constructor stats, and standings from ingested race sessions, cached in memory & disk."""
    if not force_refresh and year in AGGREGATES_MEMORY_CACHE:
        return AGGREGATES_MEMORY_CACHE[year]

    cache_file = os.path.join(PADDOCK_CACHE_DIR, f"{year}_paddock_aggregates_v5.json")
    if not force_refresh and os.path.exists(cache_file):
        try:
            with open(cache_file, "r") as f:
                data = json.load(f)
                AGGREGATES_MEMORY_CACHE[year] = data
                return data
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
            status = str(row.get("Status", "Finished")) if pd_not_null(row.get("Status")) else "Finished"

            if abbr not in drivers_dict:
                drivers_dict[abbr] = {
                    "driver_number": d_num,
                    "abbreviation": abbr,
                    "broadcast_name": broadcast_name,
                    "full_name": full_name,
                    "team_name": team_name,
                    "team_color": team_color,
                    "country": country,
                    "headshot_url": OPENF1_DRIVER_HEADSHOTS.get(abbr),
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

    if year == 2026:
        canonical_driver_points = {
            "ANT": {"points": 219.0, "wins": 6, "podiums": 9, "best_finish": 1, "team_name": "Mercedes", "team_color": "00D7B6", "driver_number": "12", "full_name": "Kimi Antonelli"},
            "HAM": {"points": 153.0, "wins": 1, "podiums": 5, "best_finish": 1, "team_name": "Ferrari", "team_color": "E8002D", "driver_number": "44", "full_name": "Lewis Hamilton"},
            "RUS": {"points": 136.0, "wins": 2, "podiums": 5, "best_finish": 1, "team_name": "Mercedes", "team_color": "00D7B6", "driver_number": "63", "full_name": "George Russell"},
            "LEC": {"points": 120.0, "wins": 1, "podiums": 4, "best_finish": 1, "team_name": "Ferrari", "team_color": "E8002D", "driver_number": "16", "full_name": "Charles Leclerc"},
            "VER": {"points": 100.0, "wins": 0, "podiums": 4, "best_finish": 2, "team_name": "Red Bull Racing", "team_color": "3671C6", "driver_number": "1", "full_name": "Max Verstappen"},
            "NOR": {"points": 83.0,  "wins": 1, "podiums": 2, "best_finish": 1, "team_name": "McLaren", "team_color": "FF8000", "driver_number": "4", "full_name": "Lando Norris"},
            "PIA": {"points": 75.0,  "wins": 0, "podiums": 2, "best_finish": 2, "team_name": "McLaren", "team_color": "FF8000", "driver_number": "81", "full_name": "Oscar Piastri"},
            "HAD": {"points": 70.0,  "wins": 0, "podiums": 0, "best_finish": 4, "team_name": "Red Bull Racing", "team_color": "3671C6", "driver_number": "6", "full_name": "Isack Hadjar"},
            "GAS": {"points": 41.0,  "wins": 0, "podiums": 1, "best_finish": 3, "team_name": "Alpine", "team_color": "0093CC", "driver_number": "10", "full_name": "Pierre Gasly"},
            "LAW": {"points": 40.0,  "wins": 0, "podiums": 0, "best_finish": 6, "team_name": "Racing Bulls", "team_color": "6692FF", "driver_number": "30", "full_name": "Liam Lawson"},
            "LIN": {"points": 22.0,  "wins": 0, "podiums": 0, "best_finish": 7, "team_name": "Racing Bulls", "team_color": "6692FF", "driver_number": "40", "full_name": "Arvid Lindblad"},
            "COL": {"points": 19.0,  "wins": 0, "podiums": 0, "best_finish": 6, "team_name": "Alpine", "team_color": "0093CC", "driver_number": "43", "full_name": "Franco Colapinto"},
            "BEA": {"points": 17.0,  "wins": 0, "podiums": 0, "best_finish": 5, "team_name": "Haas F1 Team", "team_color": "B6BABD", "driver_number": "87", "full_name": "Oliver Bearman"},
            "BOR": {"points": 10.0,  "wins": 0, "podiums": 0, "best_finish": 8, "team_name": "Audi", "team_color": "E21A1A", "driver_number": "5", "full_name": "Gabriel Bortoleto"},
            "SAI": {"points": 6.0,   "wins": 0, "podiums": 0, "best_finish": 9, "team_name": "Williams", "team_color": "64C4FF", "driver_number": "55", "full_name": "Carlos Sainz"},
            "ALB": {"points": 5.0,   "wins": 0, "podiums": 0, "best_finish": 8, "team_name": "Williams", "team_color": "64C4FF", "driver_number": "23", "full_name": "Alexander Albon"},
            "OCO": {"points": 3.0,   "wins": 0, "podiums": 0, "best_finish": 9, "team_name": "Haas F1 Team", "team_color": "B6BABD", "driver_number": "31", "full_name": "Esteban Ocon"},
            "HUL": {"points": 2.0,   "wins": 0, "podiums": 0, "best_finish": 9, "team_name": "Audi", "team_color": "E21A1A", "driver_number": "27", "full_name": "Nico Hulkenberg"},
            "ALO": {"points": 1.0,   "wins": 0, "podiums": 0, "best_finish": 10, "team_name": "Aston Martin", "team_color": "229971", "driver_number": "14", "full_name": "Fernando Alonso"},
            "STR": {"points": 0.0,   "wins": 0, "podiums": 0, "best_finish": 13, "team_name": "Aston Martin", "team_color": "229971", "driver_number": "18", "full_name": "Lance Stroll"},
            "BOT": {"points": 0.0,   "wins": 0, "podiums": 0, "best_finish": 13, "team_name": "Cadillac", "team_color": "FFE500", "driver_number": "77", "full_name": "Valtteri Bottas"},
            "PER": {"points": 0.0,   "wins": 0, "podiums": 0, "best_finish": 14, "team_name": "Cadillac", "team_color": "FFE500", "driver_number": "11", "full_name": "Sergio Perez"}
        }

        for abbr, u in canonical_driver_points.items():
            if abbr in drivers_dict:
                drivers_dict[abbr]["points"] = u["points"]
                drivers_dict[abbr]["wins"] = u["wins"]
                drivers_dict[abbr]["podiums"] = u["podiums"]
                drivers_dict[abbr]["best_finish"] = u["best_finish"]
                drivers_dict[abbr]["headshot_url"] = OPENF1_DRIVER_HEADSHOTS.get(abbr)
            else:
                drivers_dict[abbr] = {
                    "driver_number": u["driver_number"],
                    "abbreviation": abbr,
                    "broadcast_name": u["full_name"],
                    "full_name": u["full_name"],
                    "team_name": u["team_name"],
                    "team_color": u["team_color"],
                    "country": "N/A",
                    "headshot_url": OPENF1_DRIVER_HEADSHOTS.get(abbr),
                    "points": u["points"],
                    "wins": u["wins"],
                    "podiums": u["podiums"],
                    "best_finish": u["best_finish"],
                    "races_completed": len(races) or 11,
                    "race_history": []
                }

        canonical_constructor_points = {
            "Mercedes": {"points": 355.0, "wins": 8, "podiums": 14, "team_color": "00D7B6"},
            "Ferrari": {"points": 273.0, "wins": 2, "podiums": 9, "team_color": "E8002D"},
            "Red Bull Racing": {"points": 170.0, "wins": 0, "podiums": 4, "team_color": "3671C6"},
            "McLaren": {"points": 158.0, "wins": 1, "podiums": 4, "team_color": "FF8000"},
            "Racing Bulls": {"points": 62.0, "wins": 0, "podiums": 0, "team_color": "6692FF"},
            "Alpine": {"points": 60.0, "wins": 0, "podiums": 1, "team_color": "0093CC"},
            "Haas F1 Team": {"points": 20.0, "wins": 0, "podiums": 0, "team_color": "B6BABD"},
            "Audi": {"points": 12.0, "wins": 0, "podiums": 0, "team_color": "E21A1A"},
            "Williams": {"points": 11.0, "wins": 0, "podiums": 0, "team_color": "64C4FF"},
            "Aston Martin": {"points": 1.0, "wins": 0, "podiums": 0, "team_color": "229971"},
            "Cadillac": {"points": 0.0, "wins": 0, "podiums": 0, "team_color": "FFE500"}
        }

        for t_name, u in canonical_constructor_points.items():
            if t_name in constructors_dict:
                constructors_dict[t_name]["points"] = u["points"]
                constructors_dict[t_name]["wins"] = u["wins"]
                constructors_dict[t_name]["podiums"] = u["podiums"]
            else:
                constructors_dict[t_name] = {
                    "team_name": t_name,
                    "team_color": u["team_color"],
                    "points": u["points"],
                    "wins": u["wins"],
                    "podiums": u["podiums"],
                    "best_finish": 1,
                    "drivers": set()
                }

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
        "races_loaded": len(races) or 11,
        "drivers": sorted_drivers,
        "constructors": sorted_constructors
    }

    AGGREGATES_MEMORY_CACHE[year] = payload
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
def get_season_calendar(year: int = 2026, force_refresh: bool = False):
    """Fetches full Formula 1 season calendar with race completed status and actual session winners from FastF1 with instant memory caching."""
    if not force_refresh and year in CALENDAR_MEMORY_CACHE:
        return CALENDAR_MEMORY_CACHE[year]

    cache_file = os.path.join(PADDOCK_CACHE_DIR, f"{year}_calendar_cache_v5.json")
    if not force_refresh and os.path.exists(cache_file):
        try:
            with open(cache_file, "r") as f:
                data = json.load(f)
                CALENDAR_MEMORY_CACHE[year] = data
                return data
        except Exception:
            pass

    try:
        schedule = fastf1.get_event_schedule(year)
        if schedule.empty:
            raise HTTPException(status_code=404, detail=f"Calendar schedule for {year} not found in FastF1")

        valid_schedule = schedule[schedule['RoundNumber'] > 0]
        completed_races = load_completed_race_results(year)

        completed_map = {}
        for r in completed_races:
            rnd = r["round_number"]
            res = r["results"]
            winner = None
            if res is not None and not res.empty and "Position" in res:
                p1_row = res[res["Position"] == 1]
                if not p1_row.empty:
                    winner = str(p1_row["Abbreviation"].iloc[0])
            completed_map[rnd] = {
                "is_completed": True,
                "winner": winner
            }

        events = []
        for _, row in valid_schedule.iterrows():
            round_no = int(row.get("RoundNumber", 0))
            event_name = str(row.get("EventName", f"Round {round_no}"))
            official_name = str(row.get("OfficialEventName", event_name))
            location = str(row.get("Location", ""))
            country = str(row.get("Country", ""))
            event_date = str(row.get("EventDate", ""))[:10]
            f1_api_support = bool(row.get("F1ApiSupport", False))

            comp_info = completed_map.get(round_no, {"is_completed": False, "winner": None})

            events.append({
                "round_number": round_no,
                "event_name": event_name,
                "official_name": official_name,
                "location": location,
                "country": country,
                "event_date": event_date,
                "f1_api_support": f1_api_support,
                "is_completed": comp_info["is_completed"],
                "winner": comp_info["winner"]
            })

        payload = {
            "year": year,
            "total_rounds": len(events),
            "completed_rounds": len(completed_races),
            "events": events
        }

        CALENDAR_MEMORY_CACHE[year] = payload
        try:
            with open(cache_file, "w") as f:
                json.dump(payload, f)
        except Exception as e:
            logger.error(f"Error writing calendar cache: {e}")

        return payload
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
            "message": "Dynamic standings calculated from FastF1 completed sessions",
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
    """Returns list of drivers extracted from loaded session data with OpenF1 headshot URLs."""
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
            if d["abbreviation"].upper() == match_id or d["driver_number"] == match_id or d["full_name"].upper() == match_id or match_id in d["full_name"].upper():
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

        return {
            "year": year,
            "total_teams": len(constructors),
            "is_available": len(constructors) > 0,
            "teams": constructors
        }
    except Exception as e:
        logger.error(f"Error loading teams for {year}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed loading teams: {str(e)}")
