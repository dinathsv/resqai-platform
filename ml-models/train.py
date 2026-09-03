import os
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from typing import cast, Any
from sklearn.metrics import classification_report, accuracy_score

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(BASE_DIR, "datasets", "sri_lanka_flood_landslide_history.csv")
MODELS_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

def train_pipeline():
    print(f"Loading Sri Lankan disaster dataset from: {DATASET_PATH}")
    df = pd.read_csv(DATASET_PATH)
    print(f"Dataset loaded: {df.shape[0]} records, {df.shape[1]} features")

    district_encoder = LabelEncoder()
    df["DISTRICT_ENCODED"] = cast(Any, district_encoder.fit_transform(df["DISTRICT"]))
    assert district_encoder.classes_ is not None
    print(f"Encoded {len(district_encoder.classes_)} Sri Lankan districts:")
    print(list(district_encoder.classes_))

    encoder_path = os.path.join(MODELS_DIR, "sri_lanka_district_encoder.joblib")
    joblib.dump(district_encoder, encoder_path)
    print(f"Saved district encoder to: {encoder_path}")

    feature_cols = [
        "DISTRICT_ENCODED",
        "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
        "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
        "ANNUAL", "PEAK_24H_RAIN"
    ]
    X = df[feature_cols]

    y_flood = df["FLOOD_OCCURRENCE"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_flood, test_size=0.20, random_state=42, stratify=y_flood
    )

    print("\nTraining Random Forest Flood Prediction Classifier...")
    flood_rf = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
    flood_rf.fit(X_train, y_train)

    y_pred_rf = flood_rf.predict(X_test)
    acc_rf = accuracy_score(y_test, y_pred_rf)
    print(f"Random Forest Flood Prediction Accuracy: {acc_rf * 100:.2f}%\n")
    print(classification_report(y_test, y_pred_rf))

    flood_model_path = os.path.join(MODELS_DIR, "sri_lanka_flood_model.joblib")
    joblib.dump(flood_rf, flood_model_path)
    print(f"Saved flood model to: {flood_model_path}")

    y_hazard = df["HAZARD_INDEX"]
    X_train_h, X_test_h, y_train_h, y_test_h = train_test_split(
        X, y_hazard, test_size=0.20, random_state=42, stratify=y_hazard
    )

    print("\nTraining Multi-Hazard Index Classifier (Flood + Landslide)...")
    hazard_rf = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
    hazard_rf.fit(X_train_h, y_train_h)

    y_pred_h = hazard_rf.predict(X_test_h)
    acc_h = accuracy_score(y_test_h, y_pred_h)
    print(f"Multi-Hazard Model Accuracy: {acc_h * 100:.2f}%\n")
    print(classification_report(y_test_h, y_pred_h))

    hazard_model_path = os.path.join(MODELS_DIR, "sri_lanka_hazard_model.joblib")
    joblib.dump(hazard_rf, hazard_model_path)
    print(f"Saved hazard model to: {hazard_model_path}")

    assert flood_rf.classes_ is not None
    metadata = {
        "feature_names": feature_cols,
        "districts": list(district_encoder.classes_),
        "target_flood_classes": list(flood_rf.classes_),
        "flood_accuracy": float(acc_rf),
        "hazard_accuracy": float(acc_h)
    }
    meta_path = os.path.join(MODELS_DIR, "model_metadata.json")
    import json
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"Saved metadata to: {meta_path}")

    print("\n=== Training Completed Successfully ===")

if __name__ == "__main__":
    train_pipeline()
