import os
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from typing import cast, Any
from sklearn.metrics import classification_report, accuracy_score, mean_absolute_error, r2_score

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(BASE_DIR, "datasets", "sri_lanka_flood_risk_modeled.csv")
MODELS_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

def train_pipeline():
    print(f"Loading Sri Lankan flood risk dataset from: {DATASET_PATH}")
    df = pd.read_csv(DATASET_PATH)
    print(f"Dataset loaded: {df.shape[0]} records, {df.shape[1]} features")

    # --- Encode categorical features ---
    district_encoder = LabelEncoder()
    df["district_encoded"] = cast(Any, district_encoder.fit_transform(df["district"]))
    assert district_encoder.classes_ is not None
    print(f"Encoded {len(district_encoder.classes_)} Sri Lankan districts:")
    print(list(district_encoder.classes_))

    climatic_zone_encoder = LabelEncoder()
    df["climatic_zone_encoded"] = cast(Any, climatic_zone_encoder.fit_transform(df["climatic_zone"]))
    print(f"Encoded {len(climatic_zone_encoder.classes_)} climatic zones: {list(climatic_zone_encoder.classes_)}")

    # Save encoders
    encoder_path = os.path.join(MODELS_DIR, "sri_lanka_district_encoder.joblib")
    joblib.dump(district_encoder, encoder_path)
    print(f"Saved district encoder to: {encoder_path}")

    zone_encoder_path = os.path.join(MODELS_DIR, "sri_lanka_climatic_zone_encoder.joblib")
    joblib.dump(climatic_zone_encoder, zone_encoder_path)
    print(f"Saved climatic zone encoder to: {zone_encoder_path}")

    # --- Feature columns ---
    feature_cols = [
        "district_encoded",
        "climatic_zone_encoded",
        "precipitation_sum",
        "rain_sum",
        "soil_moisture_0_to_7cm_mean",
        "soil_moisture_7_to_28cm_mean",
        "temperature_2m_max",
        "wind_speed_10m_max",
        "rain_24h",
        "rain_48h",
        "rain_72h",
        "soil_saturation_index",
    ]
    X = df[feature_cols]

    # ====================================================================
    # Model 1: Flood Category Classifier
    # ====================================================================
    y_flood = df["flood_category"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_flood, test_size=0.20, random_state=42, stratify=y_flood
    )

    print("\nTraining Random Forest Flood Category Classifier...")
    flood_clf = RandomForestClassifier(
        n_estimators=150, max_depth=12, random_state=42, class_weight="balanced"
    )
    flood_clf.fit(X_train, y_train)

    y_pred = flood_clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"Flood Category Classifier Accuracy: {acc * 100:.2f}%\n")
    print(classification_report(y_test, y_pred))

    flood_model_path = os.path.join(MODELS_DIR, "sri_lanka_flood_model.joblib")
    joblib.dump(flood_clf, flood_model_path)
    print(f"Saved flood category model to: {flood_model_path}")

    # ====================================================================
    # Model 2: Flood Risk Score Regressor
    # ====================================================================
    y_risk = df["flood_risk_score"]

    X_train_r, X_test_r, y_train_r, y_test_r = train_test_split(
        X, y_risk, test_size=0.20, random_state=42
    )

    print("\nTraining Random Forest Flood Risk Score Regressor...")
    risk_reg = RandomForestRegressor(
        n_estimators=150, max_depth=12, random_state=42
    )
    risk_reg.fit(X_train_r, y_train_r)

    y_pred_r = risk_reg.predict(X_test_r)
    mae = mean_absolute_error(y_test_r, y_pred_r)
    r2 = r2_score(y_test_r, y_pred_r)
    print(f"Flood Risk Score Regressor — MAE: {mae:.4f}, R²: {r2:.4f}\n")

    risk_model_path = os.path.join(MODELS_DIR, "sri_lanka_flood_risk_model.joblib")
    joblib.dump(risk_reg, risk_model_path)
    print(f"Saved flood risk score model to: {risk_model_path}")

    # ====================================================================
    # Feature importances
    # ====================================================================
    print("\nFlood Category Classifier — Feature Importances:")
    for name, imp in sorted(
        zip(feature_cols, flood_clf.feature_importances_), key=lambda x: -x[1]
    ):
        print(f"  {name:40s} {imp:.4f}")

    # ====================================================================
    # Save metadata
    # ====================================================================
    assert flood_clf.classes_ is not None
    metadata = {
        "dataset": "sri_lanka_flood_risk_modeled.csv",
        "feature_names": feature_cols,
        "districts": list(district_encoder.classes_),
        "climatic_zones": list(climatic_zone_encoder.classes_),
        "target_flood_classes": list(flood_clf.classes_),
        "flood_classifier_accuracy": float(acc),
        "risk_regressor_mae": float(mae),
        "risk_regressor_r2": float(r2),
    }
    meta_path = os.path.join(MODELS_DIR, "model_metadata.json")
    import json
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2, default=str)
    print(f"Saved metadata to: {meta_path}")

    print("\n=== Training Completed Successfully ===")

if __name__ == "__main__":
    train_pipeline()
