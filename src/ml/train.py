import os
import sys
import joblib
import pandas as pd

# Ensure root directory is in Python path for clean imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from src.ml.features import extract_graph_features

def train_predictive_model():
    print("📊 Pulling features from Neo4j graph...")
    df = extract_graph_features()
    
    if df.empty:
        print("❌ Feature DataFrame is empty. Verify that events are linked in Neo4j.")
        return

    # 1. Feature Engineering & One-Hot Encoding for Track Zones
    X = pd.get_dummies(df[['zone_name', 'time_start', 'speed_start']], columns=['zone_name'], drop_first=True)
    y = df['speed_delta']

    # 2. Train-Test Split (80/20)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # 3. Model Training
    print("🤖 Training RandomForest Predictive Model...")
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    # 4. Model Evaluation
    predictions = model.predict(X_test)
    mae = mean_absolute_error(y_test, predictions)
    r2 = r2_score(y_test, predictions)

    print("\n✅ Model Evaluation Metrics:")
    print(f"   • Mean Absolute Error (MAE): {mae:.2f} km/h")
    print(f"   • R² Score: {r2:.4f}")

    # 5. Persist Model Artifact and Feature Columns
    os.makedirs("src/ml/models", exist_ok=True)
    model_path = "src/ml/models/speed_delta_model.joblib"
    joblib.dump({'model': model, 'features': X.columns.tolist()}, model_path)
    print(f"💾 Model saved successfully to {model_path}")

if __name__ == "__main__":
    train_predictive_model()