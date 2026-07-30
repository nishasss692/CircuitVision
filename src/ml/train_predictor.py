import os
import sys
import joblib
import numpy as np
import pandas as pd
import logging

try:
    import xgboost as xgb
except ImportError:
    xgb = None

try:
    import lightgbm as lgb
except ImportError:
    lgb = None

from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import brier_score_loss, log_loss, accuracy_score

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from src.ml.dataset_builder import build_anti_leakage_dataset

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("train_predictor")

MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'models'))
os.makedirs(MODEL_DIR, exist_ok=True)
MODEL_PATH = os.path.join(MODEL_DIR, 'championship_predictor.joblib')

FEATURE_COLS = [
    "grid_position",
    "teammate_skill_index",
    "driver_rolling_pos_mean",
    "driver_rolling_pts_mean",
    "reliability_dnf_rate",
    "team_grid_mean",
    "car_rolling_pts_mean",
    "is_rookie",
    "is_street_circuit",
    "is_high_downforce",
    "season_progress",
    "races_remaining",
    "pts_gap_to_leader"
]

def train_and_evaluate():
    logger.info("Step 1: Building anti-leakage historical dataset (2019-2025)...")
    df = build_anti_leakage_dataset(seasons=[2019, 2020, 2021, 2022, 2023, 2024, 2025])

    # Chronological Walk-Forward Train/Test Split (Strict anti-leakage)
    train_df = df[df["season"] <= 2023]
    test_df  = df[df["season"] >= 2024]

    logger.info(f"Dataset Split: Train (2019-2023): {len(train_df)} rows | Test (2024-2025): {len(test_df)} rows")

    X_train = train_df[FEATURE_COLS]
    y_win_train = train_df["is_win"]
    y_top10_train = train_df["is_top10"]
    sample_weight_train = train_df["sample_weight"]

    X_test = test_df[FEATURE_COLS]
    y_win_test = test_df["is_win"]
    y_top10_test = test_df["is_top10"]

    # Select primary GBDT model (XGBoost / LightGBM fallback to HistGradientBoosting)
    algo_name = "XGBoost + Platt Calibration"
    if xgb is not None:
        logger.info("Training Calibrated XGBoost Classifier for Race Win (P1)...")
        win_base = xgb.XGBClassifier(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.05,
            random_state=42,
            eval_metric="logloss"
        )
        top10_base = xgb.XGBClassifier(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.05,
            random_state=42,
            eval_metric="logloss"
        )
    elif lgb is not None:
        algo_name = "LightGBM + Platt Calibration"
        logger.info("Training Calibrated LightGBM Classifier for Race Win (P1)...")
        win_base = lgb.LGBMClassifier(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.05,
            random_state=42,
            verbose=-1
        )
        top10_base = lgb.LGBMClassifier(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.05,
            random_state=42,
            verbose=-1
        )
    else:
        algo_name = "HistGradientBoosting + Platt Calibration"
        win_base = HistGradientBoostingClassifier(max_iter=100, max_depth=4, learning_rate=0.05, random_state=42)
        top10_base = HistGradientBoostingClassifier(max_iter=100, max_depth=4, learning_rate=0.05, random_state=42)

    # 1. Fit Calibrated Win Model with Platt Scaling
    calibrated_win_model = CalibratedClassifierCV(estimator=win_base, cv=3, method='sigmoid')
    calibrated_win_model.fit(X_train, y_win_train, sample_weight=sample_weight_train)

    # 2. Fit Calibrated Top-10 / Points Finish Model
    logger.info("Training Calibrated Gradient-Boosted Classifier for Top-10 / Points Finish...")
    calibrated_top10_model = CalibratedClassifierCV(estimator=top10_base, cv=3, method='sigmoid')
    calibrated_top10_model.fit(X_train, y_top10_train, sample_weight=sample_weight_train)

    # 3. Walk-Forward Backtest Evaluation
    win_probs = calibrated_win_model.predict_proba(X_test)[:, 1]
    top10_probs = calibrated_top10_model.predict_proba(X_test)[:, 1]

    brier_win = brier_score_loss(y_win_test, win_probs)
    logloss_win = log_loss(y_win_test, win_probs)
    acc_win = accuracy_score(y_win_test, (win_probs > 0.5).astype(int))

    brier_top10 = brier_score_loss(y_top10_test, top10_probs)
    logloss_top10 = log_loss(y_top10_test, top10_probs)
    acc_top10 = accuracy_score(y_top10_test, (top10_probs > 0.5).astype(int))

    print("\n============================================================")
    print("  MODEL CALIBRATION & WALK-FORWARD BACKTEST RESULTS")
    print(f"  Algorithm: {algo_name}")
    print("  Validation Period: 2024-2025 (Trained strictly on 2019-2023)")
    print("============================================================")
    print(f"  * Win Model Brier Score: {brier_win:.4f}  (Ideal < 0.05)")
    print(f"  * Win Model Log Loss:   {logloss_win:.4f}")
    print(f"  * Win Model Accuracy:   {acc_win * 100:.2f}%\n")
    print(f"  * Top-10 Brier Score:   {brier_top10:.4f} (Ideal < 0.15)")
    print(f"  * Top-10 Log Loss:      {logloss_top10:.4f}")
    print(f"  * Top-10 Accuracy:      {acc_top10 * 100:.2f}%")
    print("============================================================\n")

    # Save artifact
    artifact = {
        "win_model": calibrated_win_model,
        "top10_model": calibrated_top10_model,
        "feature_cols": FEATURE_COLS,
        "algorithm": algo_name,
        "metrics": {
            "brier_win": round(float(brier_win), 4),
            "logloss_win": round(float(logloss_win), 4),
            "accuracy_win": round(float(acc_win), 4),
            "brier_top10": round(float(brier_top10), 4),
            "logloss_top10": round(float(logloss_top10), 4),
            "accuracy_top10": round(float(acc_top10), 4),
            "train_period": "2019-2023",
            "test_period": "2024-2025"
        }
    }

    joblib.dump(artifact, MODEL_PATH)
    logger.info(f"Model artifact successfully saved to: {MODEL_PATH}")

if __name__ == "__main__":
    train_and_evaluate()

