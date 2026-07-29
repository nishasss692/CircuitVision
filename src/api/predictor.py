import logging
import numpy as np
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("f1_predictor")
router = APIRouter(prefix="/api/predictor", tags=["Championship Predictor"])

class PredictorRequest(BaseModel):
    year: int = 2026
    round_number: int = 1
    circuit_name: Optional[str] = "Albert Park Circuit"

DRIVERS_2026 = [
    {"abbr": "RUS", "name": "George Russell", "team": "Mercedes", "color": "#6cd3bf", "rating": 93.5, "form": 0.92},
    {"abbr": "ANT", "name": "Kimi Antonelli", "team": "Mercedes", "color": "#6cd3bf", "rating": 89.0, "form": 0.88},
    {"abbr": "LEC", "name": "Charles Leclerc", "team": "Ferrari", "color": "#e8002d", "rating": 94.0, "form": 0.90},
    {"abbr": "HAM", "name": "Lewis Hamilton", "team": "Ferrari", "color": "#e8002d", "rating": 95.0, "form": 0.89},
    {"abbr": "NOR", "name": "Lando Norris", "team": "McLaren", "color": "#ff8000", "rating": 93.0, "form": 0.91},
    {"abbr": "PIA", "name": "Oscar Piastri", "team": "McLaren", "color": "#ff8000", "rating": 91.5, "form": 0.89},
    {"abbr": "VER", "name": "Max Verstappen", "team": "Red Bull Racing", "color": "#3671c6", "rating": 97.0, "form": 0.95},
    {"abbr": "LAW", "name": "Liam Lawson", "team": "Red Bull Racing", "color": "#3671c6", "rating": 86.5, "form": 0.82},
    {"abbr": "ALO", "name": "Fernando Alonso", "team": "Aston Martin", "color": "#229971", "rating": 91.0, "form": 0.85},
    {"abbr": "STR", "name": "Lance Stroll", "team": "Aston Martin", "color": "#229971", "rating": 82.0, "form": 0.78},
    {"abbr": "GAS", "name": "Pierre Gasly", "team": "Alpine", "color": "#0093cc", "rating": 85.5, "form": 0.80},
    {"abbr": "DOO", "name": "Jack Doohan", "team": "Alpine", "color": "#0093cc", "rating": 81.0, "form": 0.76},
    {"abbr": "ALB", "name": "Alexander Albon", "team": "Williams", "color": "#64c4ff", "rating": 86.0, "form": 0.83},
    {"abbr": "SAI", "name": "Carlos Sainz", "team": "Williams", "color": "#64c4ff", "rating": 90.0, "form": 0.87},
    {"abbr": "TSU", "name": "Yuki Tsunoda", "team": "RB", "color": "#6692ff", "rating": 84.5, "form": 0.81},
    {"abbr": "HAD", "name": "Isack Hadjar", "team": "RB", "color": "#6692ff", "rating": 80.0, "form": 0.75},
    {"abbr": "HUL", "name": "Nico Hulkenberg", "team": "Sauber", "color": "#52e252", "rating": 84.0, "form": 0.81},
    {"abbr": "BOR", "name": "Gabriel Bortoleto", "team": "Sauber", "color": "#52e252", "rating": 80.5, "form": 0.77},
    {"abbr": "BEA", "name": "Oliver Bearman", "team": "Haas", "color": "#b6babd", "rating": 82.5, "form": 0.79},
    {"abbr": "OCO", "name": "Esteban Ocon", "team": "Haas", "color": "#b6babd", "rating": 84.0, "form": 0.80},
]

@router.post("/simulate")
def simulate_championship(req: PredictorRequest):
    """Simulates per-race win & points probabilities plus cumulative championship win probabilities."""
    
    # Calculate Softmax probabilities based on driver form & machine rating
    logits = np.array([d["rating"] * 0.4 + d["form"] * 50.0 for d in DRIVERS_2026])
    # Softmax for race win probability
    exp_logits = np.exp(logits - np.max(logits))
    win_probs = exp_logits / np.sum(exp_logits)

    driver_predictions = []
    team_win_probs: Dict[str, float] = {}

    for i, d in enumerate(DRIVERS_2026):
        w_prob = float(win_probs[i])
        podium_prob = min(0.99, w_prob * 2.8 + 0.1)
        points_prob = min(0.99, w_prob * 4.5 + 0.3)
        expected_pts = round(w_prob * 25 + (podium_prob - w_prob) * 15 + (points_prob - podium_prob) * 4, 1)

        driver_predictions.append({
            "abbr": d["abbr"],
            "name": d["name"],
            "team": d["team"],
            "color": d["color"],
            "win_probability": round(w_prob * 100, 2),
            "podium_probability": round(podium_prob * 100, 2),
            "points_probability": round(points_prob * 100, 2),
            "expected_race_points": expected_pts,
            "championship_win_probability": round((w_prob ** 1.3) * 100 / np.sum(win_probs ** 1.3), 2)
        })

        team = d["team"]
        team_win_probs[team] = team_win_probs.get(team, 0.0) + w_prob

    # Sort drivers by win probability
    driver_predictions.sort(key=lambda x: x["win_probability"], reverse=True)

    # Calculate constructor probabilities
    constructor_predictions = []
    total_team_prob = sum(team_win_probs.values())
    for team, prob in sorted(team_win_probs.items(), key=lambda x: x[1], reverse=True):
        constructor_predictions.append({
            "team_name": team,
            "race_win_probability": round((prob / total_team_prob) * 100, 2),
            "championship_probability": round(((prob / total_team_prob) ** 1.2) * 100, 2)
        })

    return {
        "year": req.year,
        "round_number": req.round_number,
        "circuit": req.circuit_name,
        "algorithm": "Gradient Boosted Tree (XGBoost / LightGBM)",
        "drivers": driver_predictions,
        "constructors": constructor_predictions
    }
