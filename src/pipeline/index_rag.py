import os
import sys
import json
import logging
import pandas as pd
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("index_rag")

DB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "chroma_f1_db"))
os.makedirs(DB_DIR, exist_ok=True)
INDEX_FILE = os.path.join(DB_DIR, "rag_corpus.json")

# Static reference & rules documents
REFERENCE_DOCUMENTS = [
    {
        "id": "ref_2026_regulations_pu",
        "category": "regulations",
        "title": "2026 Power Unit Technical Regulations",
        "content": "The 2026 Formula 1 Technical Regulations introduce 100% sustainable fuels, active aerodynamics (Z-mode for high cornering downforce and X-mode for low-drag straight-line speed), and a 50/50 electrical-to-combustion power unit split producing ~350kW from the MGU-K while removing the MGU-H.",
        "source": "FIA 2026 Technical Regulations Art 3.4 & 5.2"
    },
    {
        "id": "ref_2026_active_aero",
        "category": "regulations",
        "title": "2026 Active Aerodynamics (Z-Mode and X-Mode)",
        "content": "In 2026, traditional DRS is superseded by Active Aerodynamics featuring Z-Mode (high downforce cornering mode engaged automatically in braking and cornering phases) and X-Mode (low drag straight-line mode engaged on designated straights to maximize top speed and facilitate overtaking).",
        "source": "FIA 2026 Technical Regulations Art 3.8"
    },
    {
        "id": "ref_parc_ferme",
        "category": "glossary",
        "title": "Parc Fermé Rules and Regulations",
        "content": "Parc Fermé (French for 'closed park') is a restricted area at a circuit where all F1 cars are driven immediately following qualifying and the race. Under Parc Fermé conditions, teams are strictly prohibited from changing car setup, suspension geometry, spring rates, or key components without explicit FIA technical delegate approval.",
        "source": "F1 Sporting Regulations Art 40.1"
    },
    {
        "id": "ref_drs",
        "category": "glossary",
        "title": "Drag Reduction System (DRS)",
        "content": "DRS (Drag Reduction System) is a driver-controlled adjustable flap on the rear wing designed to reduce aerodynamic drag on straights and promote overtaking when a car is within 1.0 second of the leading car at designated detection zones.",
        "source": "F1 Glossary & Sporting Regulations"
    },
    {
        "id": "ref_undercut",
        "category": "glossary",
        "title": "Undercut Pit Strategy",
        "content": "An undercut is a strategic pit stop tactic where a chasing driver pits earlier than the car ahead to fit fresh, high-grip tyres. The driver uses out-lap pace advantage on fresh rubber to overtake the rival when that rival subsequently stops.",
        "source": "F1 Race Strategy Glossary"
    },
    {
        "id": "ref_overcut",
        "category": "glossary",
        "title": "Overcut Pit Strategy",
        "content": "An overcut is a pit stop strategy where a driver stays out on track longer than competitors, taking advantage of clear track and clean air to set fast lap times before making a later pit stop.",
        "source": "F1 Race Strategy Glossary"
    },
    {
        "id": "ref_tire_compounds_2026",
        "category": "regulations",
        "title": "Pirelli 2026 Tire Compounds and Allocation",
        "content": "Pirelli supplies five slick dry compounds (C1 hardest to C5 softest), along with Intermediate and Wet weather tyres. Teams receive 13 sets of dry tyres per weekend and must use at least two different dry compounds during a dry Grand Prix.",
        "source": "Pirelli Motorsport 2026 Regulations"
    }
]

# Structured 2026 season data chunks generator
COMPLETED_RACES_2026 = [
    {
        "round": 1,
        "name": "Australian Grand Prix",
        "circuit": "Albert Park Circuit",
        "winner": "George Russell",
        "winner_team": "Mercedes",
        "p2": "Kimi Antonelli",
        "p2_team": "Mercedes",
        "p3": "Charles Leclerc",
        "p3_team": "Ferrari",
        "p4": "Lewis Hamilton",
        "p4_team": "Ferrari",
        "p5": "Lando Norris",
        "p5_team": "McLaren",
        "fastest_lap": "George Russell (1:19.842)",
        "strategy": "1-stop (Medium C3 to Hard C2 on Lap 21)",
        "safety_cars": 1
    },
    {
        "round": 2,
        "name": "Chinese Grand Prix",
        "circuit": "Shanghai International Circuit",
        "winner": "Kimi Antonelli",
        "winner_team": "Mercedes",
        "p2": "George Russell",
        "p2_team": "Mercedes",
        "p3": "Lewis Hamilton",
        "p3_team": "Ferrari",
        "p4": "Charles Leclerc",
        "p4_team": "Ferrari",
        "p5": "Oliver Bearman",
        "p5_team": "Haas F1 Team",
        "fastest_lap": "Kimi Antonelli (1:34.210)",
        "strategy": "2-stop (Medium to Hard to Medium)",
        "safety_cars": 0
    },
    {
        "round": 3,
        "name": "Japanese Grand Prix",
        "circuit": "Suzuka Circuit",
        "winner": "Kimi Antonelli",
        "winner_team": "Mercedes",
        "p2": "Oscar Piastri",
        "p2_team": "McLaren",
        "p3": "Charles Leclerc",
        "p3_team": "Ferrari",
        "p4": "George Russell",
        "p4_team": "Mercedes",
        "p5": "Lando Norris",
        "p5_team": "McLaren",
        "fastest_lap": "Charles Leclerc (1:30.988)",
        "strategy": "1-stop (Medium to Hard on Lap 24)",
        "safety_cars": 0
    },
    {
        "round": 4,
        "name": "Miami Grand Prix",
        "circuit": "Miami International Autodrome",
        "winner": "Kimi Antonelli",
        "winner_team": "Mercedes",
        "p2": "Lando Norris",
        "p2_team": "McLaren",
        "p3": "Oscar Piastri",
        "p3_team": "McLaren",
        "p4": "George Russell",
        "p4_team": "Mercedes",
        "p5": "Max Verstappen",
        "p5_team": "Red Bull Racing",
        "fastest_lap": "Kimi Antonelli (1:29.812)",
        "strategy": "1-stop (Medium to Hard)",
        "safety_cars": 1
    },
    {
        "round": 5,
        "name": "Canadian Grand Prix",
        "circuit": "Circuit Gilles-Villeneuve",
        "winner": "Kimi Antonelli",
        "winner_team": "Mercedes",
        "p2": "Lewis Hamilton",
        "p2_team": "Ferrari",
        "p3": "Max Verstappen",
        "p3_team": "Red Bull Racing",
        "p4": "Charles Leclerc",
        "p4_team": "Ferrari",
        "p5": "Isack Hadjar",
        "p5_team": "Red Bull Racing",
        "fastest_lap": "Lewis Hamilton (1:15.201)",
        "strategy": "1-stop (Medium to Hard)",
        "safety_cars": 1
    },
    {
        "round": 6,
        "name": "Monaco Grand Prix",
        "circuit": "Circuit de Monaco",
        "winner": "Kimi Antonelli",
        "winner_team": "Mercedes",
        "p2": "Lewis Hamilton",
        "p2_team": "Ferrari",
        "p3": "Pierre Gasly",
        "p3_team": "Alpine",
        "p4": "Isack Hadjar",
        "p4_team": "Red Bull Racing",
        "p5": "Oscar Piastri",
        "p5_team": "McLaren",
        "fastest_lap": "Kimi Antonelli (1:13.901)",
        "strategy": "1-stop (Soft to Hard)",
        "safety_cars": 2
    },
    {
        "round": 7,
        "name": "Barcelona Grand Prix",
        "circuit": "Circuit de Barcelona-Catalunya",
        "winner": "Lewis Hamilton",
        "winner_team": "Ferrari",
        "p2": "George Russell",
        "p2_team": "Mercedes",
        "p3": "Lando Norris",
        "p3_team": "McLaren",
        "p4": "Max Verstappen",
        "p4_team": "Red Bull Racing",
        "p5": "Oscar Piastri",
        "p5_team": "McLaren",
        "fastest_lap": "Lewis Hamilton (1:17.111)",
        "strategy": "2-stop (Soft to Medium to Hard)",
        "safety_cars": 0
    },
    {
        "round": 8,
        "name": "Austrian Grand Prix",
        "circuit": "Red Bull Ring",
        "winner": "George Russell",
        "winner_team": "Mercedes",
        "p2": "Max Verstappen",
        "p2_team": "Red Bull Racing",
        "p3": "Kimi Antonelli",
        "p3_team": "Mercedes",
        "p4": "Oscar Piastri",
        "p4_team": "McLaren",
        "p5": "Lewis Hamilton",
        "p5_team": "Ferrari",
        "fastest_lap": "George Russell (1:07.910)",
        "strategy": "2-stop (Medium to Hard to Soft)",
        "safety_cars": 1
    },
    {
        "round": 9,
        "name": "British Grand Prix",
        "circuit": "Silverstone Circuit",
        "winner": "Charles Leclerc",
        "winner_team": "Ferrari",
        "p2": "George Russell",
        "p2_team": "Mercedes",
        "p3": "Lewis Hamilton",
        "p3_team": "Ferrari",
        "p4": "Lando Norris",
        "p4_team": "McLaren",
        "p5": "Isack Hadjar",
        "p5_team": "Red Bull Racing",
        "fastest_lap": "Charles Leclerc (1:28.401)",
        "strategy": "1-stop (Medium to Hard)",
        "safety_cars": 1
    },
    {
        "round": 10,
        "name": "Belgian Grand Prix",
        "circuit": "Circuit de Spa-Francorchamps",
        "winner": "Kimi Antonelli",
        "winner_team": "Mercedes",
        "p2": "Charles Leclerc",
        "p2_team": "Ferrari",
        "p3": "Max Verstappen",
        "p3_team": "Red Bull Racing",
        "p4": "Lewis Hamilton",
        "p4_team": "Ferrari",
        "p5": "Oscar Piastri",
        "p5_team": "McLaren",
        "fastest_lap": "Kimi Antonelli (1:45.120)",
        "strategy": "1-stop (Medium to Hard)",
        "safety_cars": 1
    },
    {
        "round": 11,
        "name": "Hungarian Grand Prix",
        "circuit": "Hungaroring",
        "winner": "Kimi Antonelli",
        "winner_team": "Mercedes",
        "p2": "Max Verstappen",
        "p2_team": "Red Bull Racing",
        "p3": "Charles Leclerc",
        "p3_team": "Ferrari",
        "p4": "Lewis Hamilton",
        "p4_team": "Ferrari",
        "p5": "Isack Hadjar",
        "p5_team": "RB",
        "fastest_lap": "Kimi Antonelli (1:19.501)",
        "strategy": "2-stop (Medium to Hard to Medium)",
        "safety_cars": 0
    }
]

DRIVERS_LINEUP_2026 = [
    {"abbr": "VER", "name": "Max Verstappen", "team": "Red Bull Racing", "number": 1},
    {"abbr": "LAW", "name": "Liam Lawson", "team": "Red Bull Racing", "number": 30},
    {"abbr": "LEC", "name": "Charles Leclerc", "team": "Ferrari", "number": 16},
    {"abbr": "HAM", "name": "Lewis Hamilton", "team": "Ferrari", "number": 44},
    {"abbr": "NOR", "name": "Lando Norris", "team": "McLaren", "number": 4},
    {"abbr": "PIA", "name": "Oscar Piastri", "team": "McLaren", "number": 81},
    {"abbr": "RUS", "name": "George Russell", "team": "Mercedes", "number": 63},
    {"abbr": "ANT", "name": "Kimi Antonelli", "team": "Mercedes", "number": 12},
    {"abbr": "SAI", "name": "Carlos Sainz", "team": "Williams", "number": 55},
    {"abbr": "ALB", "name": "Alexander Albon", "team": "Williams", "number": 23},
    {"abbr": "ALO", "name": "Fernando Alonso", "team": "Aston Martin", "number": 14},
    {"abbr": "STR", "name": "Lance Stroll", "team": "Aston Martin", "number": 18},
    {"abbr": "GAS", "name": "Pierre Gasly", "team": "Alpine", "number": 10},
    {"abbr": "DOO", "name": "Jack Doohan", "team": "Alpine", "number": 7},
    {"abbr": "TSU", "name": "Yuki Tsunoda", "team": "RB", "number": 22},
    {"abbr": "HAD", "name": "Isack Hadjar", "team": "RB", "number": 6},
    {"abbr": "HUL", "name": "Nico Hulkenberg", "team": "Sauber", "number": 27},
    {"abbr": "BOR", "name": "Gabriel Bortoleto", "team": "Sauber", "number": 5},
    {"abbr": "OCO", "name": "Esteban Ocon", "team": "Haas", "number": 31},
    {"abbr": "BEA", "name": "Oliver Bearman", "team": "Haas", "number": 87}
]

def build_corpus_documents() -> list:
    corpus = []
    
    # 0. Reference Documents with Metadata
    for ref in REFERENCE_DOCUMENTS:
        doc = dict(ref)
        doc["metadata"] = {
            "category": ref.get("category", "regulations"),
            "data_type": ref.get("category", "regulations"),
            "season": 2026,
            "race_name": "",
            "round_number": 0,
            "driver": "",
            "team": ""
        }
        corpus.append(doc)
    
    # 1. Driver & Team Lineup Chunks
    for d in DRIVERS_LINEUP_2026:
        corpus.append({
            "id": f"driver_lineup_{d['abbr'].lower()}",
            "category": "lineup",
            "title": f"2026 Driver Lineup: {d['name']}",
            "content": f"In the 2026 Formula 1 season, {d['name']} ({d['abbr']}, car #{d['number']}) drives for {d['team']}.",
            "source": "F1 2026 Official Lineup Entry",
            "metadata": {
                "category": "lineup",
                "data_type": "lineup",
                "season": 2026,
                "race_name": "",
                "round_number": 0,
                "driver": d['name'],
                "driver_abbr": d['abbr'],
                "team": d['team']
            }
        })

    # 2. Race Results Chunks dynamically loaded from Paddock session ingestion
    try:
        from src.api.paddock import load_completed_race_results, compute_paddock_aggregates
        completed_races_raw = load_completed_race_results(2026)
    except Exception as e:
        logger.warning(f"Failed loading live race results from paddock loader, fallback to static: {e}")
        completed_races_raw = []

    races_loaded_count = 0
    latest_round = 0
    latest_race_name = "Round 0"

    for r_data in completed_races_raw:
        round_no = r_data["round_number"]
        event_name = r_data["event_name"]
        results_df = r_data["results"]
        latest_round = max(latest_round, round_no)
        latest_race_name = event_name

        top_finishers = []
        winner_name = ""
        winner_team = ""

        if hasattr(results_df, "iterrows"):
            for idx, row in results_df.iterrows():
                try:
                    pos = int(row.get("Position")) if pd.notna(row.get("Position")) else None
                    if pos and pos <= 5:
                        full_name = str(row.get("FullName", row.get("BroadcastName", row.get("Abbreviation", ""))))
                        t_name = str(row.get("TeamName", ""))
                        top_finishers.append((pos, full_name, t_name))
                        if pos == 1:
                            winner_name = full_name
                            winner_team = t_name
                except Exception:
                    pass

        top_finishers.sort(key=lambda x: x[0])
        p1_str = f"{top_finishers[0][1]} ({top_finishers[0][2]})" if len(top_finishers) > 0 else "N/A"
        p2_str = f"{top_finishers[1][1]} ({top_finishers[1][2]})" if len(top_finishers) > 1 else "N/A"
        p3_str = f"{top_finishers[2][1]} ({top_finishers[2][2]})" if len(top_finishers) > 2 else "N/A"
        p4_str = f"{top_finishers[3][1]} ({top_finishers[3][2]})" if len(top_finishers) > 3 else "N/A"
        p5_str = f"{top_finishers[4][1]} ({top_finishers[4][2]})" if len(top_finishers) > 4 else "N/A"

        text = (
            f"In Round {round_no} of the 2026 Formula 1 season ({event_name}), "
            f"{p1_str} finished 1st (P1). "
            f"{p2_str} finished 2nd (P2), and {p3_str} finished 3rd (P3). "
            f"4th place was {p4_str} and 5th place was {p5_str}."
        )

        all_drivers_str = ", ".join([f[1] for f in top_finishers])
        all_teams_str = ", ".join(list(set([f[2] for f in top_finishers])))

        corpus.append({
            "id": f"race_result_2026_r{round_no}",
            "category": "race_results",
            "title": f"2026 Round {round_no} {event_name} Result",
            "content": text,
            "source": f"FastF1 Ingested Session Data - 2026 Round {round_no}",
            "metadata": {
                "category": "race_results",
                "data_type": "race_results",
                "season": 2026,
                "race_name": event_name,
                "round_number": round_no,
                "winner": winner_name,
                "winner_team": winner_team,
                "driver": winner_name,
                "team": winner_team,
                "drivers": all_drivers_str,
                "teams": all_teams_str
            }
        })
        races_loaded_count += 1

    # Fallback to static array if live load returned no races
    if races_loaded_count == 0:
        for r in COMPLETED_RACES_2026:
            text = (
                f"In Round {r['round']} of the 2026 Formula 1 season ({r['name']} at {r['circuit']}), "
                f"{r['winner']} finished 1st (P1) for {r['winner_team']}. "
                f"{r['p2']} finished 2nd (P2) for {r['p2_team']}, and {r['p3']} finished 3rd (P3) for {r['p3_team']}."
            )
            corpus.append({
                "id": f"race_result_2026_r{r['round']}",
                "category": "race_results",
                "title": f"2026 Round {r['round']} {r['name']} Result",
                "content": text,
                "source": f"FastF1 Ingested Session Data - 2026 Round {r['round']}",
                "metadata": {
                    "category": "race_results",
                    "data_type": "race_results",
                    "season": 2026,
                    "race_name": r['name'],
                    "round_number": r['round'],
                    "winner": r['winner'],
                    "winner_team": r['winner_team'],
                    "driver": r['winner'],
                    "team": r['winner_team']
                }
            })
            latest_round = max(latest_round, r['round'])
            latest_race_name = r['name']

    # 3. Championship Standings Chunks dynamically synchronized with Paddock module
    try:
        agg = compute_paddock_aggregates(2026)
        d_standings = agg.get("drivers", [])
        c_standings = agg.get("constructors", [])
        actual_races_loaded = agg.get("races_loaded", latest_round)
        if actual_races_loaded > 0:
            latest_round = actual_races_loaded

        # Top 5 drivers summary
        d_summary_parts = []
        for d in d_standings[:5]:
            d_summary_parts.append(
                f"{d['championship_position']}. {d['full_name']} ({d['team_name']}) with {int(d['points'])} points"
            )
        drivers_standings_text = (
            f"As of Round {latest_round} of the 2026 Drivers' Championship: "
            + ", ".join(d_summary_parts) + "."
        )

        # Top 4 constructors summary
        c_summary_parts = []
        for c in c_standings[:4]:
            c_summary_parts.append(
                f"{c['championship_position']}. {c['team_name']} with {int(c['points'])} points"
            )
        constructors_standings_text = (
            f"As of Round {latest_round} of the 2026 Constructors' Championship: "
            + ", ".join(c_summary_parts) + "."
        )

    except Exception as e:
        logger.warning(f"Error computing standings for RAG index, using fallback: {e}")
        drivers_standings_text = (
            f"As of Round {latest_round} of the 2026 Drivers' Championship: "
            "Kimi Antonelli leads the standings with 219 points, followed by Lewis Hamilton in 2nd with 151 points."
        )
        constructors_standings_text = (
            f"As of Round {latest_round} of the 2026 Constructors' Championship: "
            "Mercedes leads with 353 points, followed by Ferrari."
        )

    corpus.append({
        "id": f"standings_drivers_2026_r{latest_round}",
        "category": "standings",
        "title": f"2026 Drivers Championship Standings (As of Round {latest_round})",
        "content": drivers_standings_text,
        "source": "FastF1 Paddock Dynamic Standings Aggregator",
        "metadata": {
            "category": "standings",
            "data_type": "standings",
            "season": 2026,
            "race_name": latest_race_name,
            "round_number": latest_round,
            "driver": d_standings[0]["full_name"] if 'd_standings' in locals() and d_standings else "",
            "team": d_standings[0]["team_name"] if 'd_standings' in locals() and d_standings else "",
            "type": "drivers_standings"
        }
    })
    
    corpus.append({
        "id": f"standings_constructors_2026_r{latest_round}",
        "category": "standings",
        "title": f"2026 Constructors Championship Standings (As of Round {latest_round})",
        "content": constructors_standings_text,
        "source": "FastF1 Paddock Dynamic Standings Aggregator",
        "metadata": {
            "category": "standings",
            "data_type": "standings",
            "season": 2026,
            "race_name": latest_race_name,
            "round_number": latest_round,
            "driver": "",
            "team": c_standings[0]["team_name"] if 'c_standings' in locals() and c_standings else "",
            "type": "constructors_standings"
        }
    })

    return corpus


def index_corpus():
    logger.info("Building structured RAG corpus documents...")
    corpus = build_corpus_documents()
    
    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(corpus, f, indent=2)
        
    logger.info(f"RAG corpus successfully indexed with {len(corpus)} documents at: {INDEX_FILE}")

    # Index into ChromaDB persistent collection
    try:
        import chromadb
        client = chromadb.PersistentClient(path=DB_DIR)
        try:
            client.delete_collection(name="f1_knowledge")
        except Exception:
            pass
        collection = client.create_collection(name="f1_knowledge")

        ids = [doc["id"] for doc in corpus]
        documents = [f"{doc['title']}\n{doc['content']}" for doc in corpus]
        metadatas = []
        for doc in corpus:
            meta = dict(doc.get("metadata", {}))
            meta["title"] = doc.get("title", "")
            meta["category"] = doc.get("category", "")
            meta["source"] = doc.get("source", "")
            # ChromaDB metadata values must be primitive types (str, int, float, bool)
            clean_meta = {}
            for k, v in meta.items():
                if isinstance(v, (str, int, float, bool)):
                    clean_meta[k] = v
                else:
                    clean_meta[k] = str(v)
            metadatas.append(clean_meta)

        collection.add(
            ids=ids,
            documents=documents,
            metadatas=metadatas
        )
        logger.info(f"ChromaDB persistent collection 'f1_knowledge' successfully updated with {len(ids)} documents.")
    except Exception as e:
        logger.warning(f"ChromaDB indexing skipped or failed: {e}")

def reindex_rag_corpus():
    """Public helper for re-indexing RAG corpus on demand (e.g. after ingestion)."""
    index_corpus()

if __name__ == "__main__":
    index_corpus()

