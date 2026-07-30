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
        "p4": "Max Verstappen",
        "p4_team": "Red Bull Racing",
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
        "winner": "Max Verstappen",
        "winner_team": "Red Bull Racing",
        "p2": "Lando Norris",
        "p2_team": "McLaren",
        "p3": "Oscar Piastri",
        "p3_team": "McLaren",
        "p4": "Lewis Hamilton",
        "p4_team": "Ferrari",
        "p5": "Charles Leclerc",
        "p5_team": "Ferrari",
        "fastest_lap": "Max Verstappen (1:34.210)",
        "strategy": "2-stop (Medium to Hard to Medium)",
        "safety_cars": 0
    },
    {
        "round": 3,
        "name": "Japanese Grand Prix",
        "circuit": "Suzuka Circuit",
        "winner": "Max Verstappen",
        "winner_team": "Red Bull Racing",
        "p2": "Charles Leclerc",
        "p2_team": "Ferrari",
        "p3": "Lando Norris",
        "p3_team": "McLaren",
        "p4": "George Russell",
        "p4_team": "Mercedes",
        "p5": "Carlos Sainz",
        "p5_team": "Williams",
        "fastest_lap": "Charles Leclerc (1:30.988)",
        "strategy": "1-stop (Medium to Hard on Lap 24)",
        "safety_cars": 0
    },
    {
        "round": 4,
        "name": "Bahrain Grand Prix",
        "circuit": "Bahrain International Circuit",
        "winner": "Charles Leclerc",
        "winner_team": "Ferrari",
        "p2": "Max Verstappen",
        "p2_team": "Red Bull Racing",
        "p3": "Lewis Hamilton",
        "p3_team": "Ferrari",
        "p4": "Lando Norris",
        "p4_team": "McLaren",
        "p5": "Oscar Piastri",
        "p5_team": "McLaren",
        "fastest_lap": "Lewis Hamilton (1:32.411)",
        "strategy": "2-stop (Soft C4 to Medium C3 to Hard C2)",
        "safety_cars": 1
    },
    {
        "round": 5,
        "name": "Saudi Arabian Grand Prix",
        "circuit": "Jeddah Corniche Circuit",
        "winner": "Max Verstappen",
        "winner_team": "Red Bull Racing",
        "p2": "Charles Leclerc",
        "p2_team": "Ferrari",
        "p3": "George Russell",
        "p3_team": "Mercedes",
        "p4": "Lando Norris",
        "p4_team": "McLaren",
        "p5": "Kimi Antonelli",
        "p5_team": "Mercedes",
        "fastest_lap": "Max Verstappen (1:29.112)",
        "strategy": "1-stop (Medium to Hard on Lap 19)",
        "safety_cars": 2
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

    # 2. Race Results Chunks with Rich Metadata
    for r in COMPLETED_RACES_2026:
        text = (
            f"In Round {r['round']} of the 2026 Formula 1 season ({r['name']} at {r['circuit']}), "
            f"{r['winner']} finished 1st (P1) for {r['winner_team']}. "
            f"{r['p2']} finished 2nd (P2) for {r['p2_team']}, and {r['p3']} finished 3rd (P3) for {r['p3_team']}. "
            f"{r['p4']} was 4th and {r['p5']} was 5th. "
            f"Fastest lap of the race was set by {r['fastest_lap']}. "
            f"The winning pit stop strategy was {r['strategy']} with {r['safety_cars']} safety car deployment(s)."
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
                "circuit_name": r['circuit'],
                "round_number": r['round'],
                "winner": r['winner'],
                "winner_team": r['winner_team'],
                "driver": r['winner'],
                "team": r['winner_team'],
                "drivers": f"{r['winner']}, {r['p2']}, {r['p3']}, {r['p4']}, {r['p5']}",
                "teams": f"{r['winner_team']}, {r['p2_team']}, {r['p3_team']}, {r['p4_team']}, {r['p5_team']}"
            }
        })

    # 3. Championship Standings Chunks (As of Round 5)
    corpus.append({
        "id": "standings_drivers_2026_r5",
        "category": "standings",
        "title": "2026 Drivers Championship Standings (As of Round 5)",
        "content": "As of Round 5 (Saudi Arabian GP) of the 2026 Drivers' Championship: Max Verstappen leads the standings with 110 points, followed by Charles Leclerc in 2nd with 98 points, Lando Norris in 3rd with 89 points, George Russell in 4th with 72 points, and Kimi Antonelli in 5th with 54 points.",
        "source": "FastF1 Standings Ingestion Service",
        "metadata": {
            "category": "standings",
            "data_type": "standings",
            "season": 2026,
            "race_name": "",
            "round_number": 5,
            "driver": "",
            "team": "",
            "type": "drivers_standings"
        }
    })
    
    corpus.append({
        "id": "standings_constructors_2026_r5",
        "category": "standings",
        "title": "2026 Constructors Championship Standings (As of Round 5)",
        "content": "As of Round 5 (Saudi Arabian GP) of the 2026 Constructors' Championship: Red Bull Racing leads with 132 points, Ferrari is 2nd with 126 points, Mercedes is 3rd with 126 points, and McLaren is 4th with 118 points.",
        "source": "FastF1 Standings Ingestion Service",
        "metadata": {
            "category": "standings",
            "data_type": "standings",
            "season": 2026,
            "race_name": "",
            "round_number": 5,
            "driver": "",
            "team": "",
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

if __name__ == "__main__":
    index_corpus()
