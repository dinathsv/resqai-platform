"""
ResQAI — Sri Lanka Disaster Hazard & Flood Prediction Engine
Evaluates riverine flood probabilities, NBRO landslide risk thresholds,
and generates actionable emergency guidance for Sri Lanka's 25 districts.
"""

import os
import json
import joblib
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
DATASETS_DIR = os.path.join(BASE_DIR, "datasets")

ENCODER_PATH = os.path.join(MODELS_DIR, "sri_lanka_district_encoder.joblib")
FLOOD_MODEL_PATH = os.path.join(MODELS_DIR, "sri_lanka_flood_model.joblib")
HAZARD_MODEL_PATH = os.path.join(MODELS_DIR, "sri_lanka_hazard_model.joblib")
DISTRICTS_CSV = os.path.join(DATASETS_DIR, "sri_lanka_districts.csv")

# Global cached resources
_district_encoder: Any = None
_flood_model: Any = None
_hazard_model: Any = None
_districts_meta: Dict[str, Any] = {}

def _load_artifacts() -> None:
    global _district_encoder, _flood_model, _hazard_model, _districts_meta
    if _district_encoder is None:
        if not os.path.exists(ENCODER_PATH) or not os.path.exists(FLOOD_MODEL_PATH):
            raise FileNotFoundError(
                "Model artifacts not found. Please run 'python train.py' first."
            )
        _district_encoder = joblib.load(ENCODER_PATH)
        _flood_model = joblib.load(FLOOD_MODEL_PATH)
        _hazard_model = joblib.load(HAZARD_MODEL_PATH)

        if os.path.exists(DISTRICTS_CSV):
            df_dist = pd.read_csv(DISTRICTS_CSV)
            for _, row in df_dist.iterrows():
                dist_name = str(row["district"]).strip()
                _districts_meta[dist_name.lower()] = {
                    "district": dist_name,
                    "province": str(row["province"]),
                    "zone": str(row["zone"]),
                    "primary_river_basin": str(row["primary_river_basin"]),
                    "landslide_prone_zone": str(row["landslide_prone_zone"]),
                    "major_hazard_profile": str(row["major_hazard_profile"])
                }

def get_supported_districts() -> List[str]:
    """Returns list of supported 25 Sri Lankan administrative districts."""
    _load_artifacts()
    return list(_district_encoder.classes_)

def evaluate_nbro_landslide_alert(is_landslide_zone: bool, peak_24h_rain: float) -> Dict[str, Any]:
    """
    Evaluates official NBRO (National Building Research Organisation)
    24-hour rainfall threshold rules for Sri Lanka hill slopes.
    """
    if not is_landslide_zone:
        return {
            "level": 0,
            "color": "Green",
            "status": "Safe / No Alert",
            "message": "Region is not designated as a high-risk slope failure area by NBRO."
        }

    if peak_24h_rain >= 150.0:
        return {
            "level": 3,
            "color": "Red",
            "status": "Level 3 - Evacuation",
            "message": "Rainfall exceeds 150mm within 24h. High risk of landslides, rock falls, and cut-slope failures. Evacuate designated slopes immediately to safe shelters."
        }
    elif peak_24h_rain >= 100.0:
        return {
            "level": 2,
            "color": "Amber",
            "status": "Level 2 - Warning",
            "message": "Rainfall exceeds 100mm within 24h. Be ready to evacuate immediately if continuous rains or slope ground cracks appear."
        }
    elif peak_24h_rain >= 75.0:
        return {
            "level": 1,
            "color": "Yellow",
            "status": "Level 1 - Watch / Alert",
            "message": "Rainfall exceeds 75mm within 24h. Stay vigilant for signs of slope failures, leaning trees, or suddenly muddied springs."
        }
    else:
        return {
            "level": 0,
            "color": "Green",
            "status": "Safe / Normal",
            "message": "Rainfall is below NBRO advisory threshold (<75mm/24h)."
        }

def predict_disaster_risk(
    district: str,
    monthly_rainfall: Optional[Dict[str, float]] = None,
    peak_24h_rain: float = 0.0,
    annual_rainfall: Optional[float] = None
) -> Dict[str, Any]:
    """
    Predicts flood occurrence and multi-hazard index for a given Sri Lankan district.
    """
    _load_artifacts()

    # Case-insensitive district lookup
    matched_key = district.strip().lower()
    if matched_key not in _districts_meta:
        valid_districts = list(_district_encoder.classes_)
        return {
            "error": f"Unknown Sri Lankan district: '{district}'.",
            "supported_districts": valid_districts
        }

    meta = _districts_meta[matched_key]
    official_district_name = meta["district"]
    encoded_district = _district_encoder.transform([official_district_name])[0]

    # Default baseline monthly distribution if not fully supplied
    default_monthly = {
        "JAN": 40.0, "FEB": 30.0, "MAR": 60.0, "APR": 120.0,
        "MAY": 200.0, "JUN": 180.0, "JUL": 140.0, "AUG": 130.0,
        "SEP": 160.0, "OCT": 250.0, "NOV": 280.0, "DEC": 110.0
    }
    if monthly_rainfall:
        for month, val in monthly_rainfall.items():
            month_upper = month.upper()
            if month_upper in default_monthly:
                default_monthly[month_upper] = float(val)

    if annual_rainfall is None:
        annual_rainfall = sum(default_monthly.values())

    if peak_24h_rain <= 0.0:
        # Default peak estimate from highest monthly rain
        max_month = max(default_monthly.values())
        peak_24h_rain = round(max_month * 0.35, 1)

    # Prepare DataFrame for scikit-learn model
    input_row = {
        "DISTRICT_ENCODED": encoded_district,
        "JAN": default_monthly["JAN"],
        "FEB": default_monthly["FEB"],
        "MAR": default_monthly["MAR"],
        "APR": default_monthly["APR"],
        "MAY": default_monthly["MAY"],
        "JUN": default_monthly["JUN"],
        "JUL": default_monthly["JUL"],
        "AUG": default_monthly["AUG"],
        "SEP": default_monthly["SEP"],
        "OCT": default_monthly["OCT"],
        "NOV": default_monthly["NOV"],
        "DEC": default_monthly["DEC"],
        "ANNUAL": annual_rainfall,
        "PEAK_24H_RAIN": peak_24h_rain
    }
    df_input = pd.DataFrame([input_row])

    # Model Inferences
    flood_pred = _flood_model.predict(df_input)[0]
    flood_probs = _flood_model.predict_proba(df_input)[0]
    classes = list(_flood_model.classes_)
    prob_dict = {cls: round(float(prob) * 100, 1) for cls, prob in zip(classes, flood_probs)}

    hazard_idx = int(_hazard_model.predict(df_input)[0])
    hazard_labels = {
        0: "Low / Normal",
        1: "Moderate / Advisory",
        2: "Critical / Emergency"
    }

    # NBRO Landslide Analysis
    is_landslide_zone = meta["landslide_prone_zone"] in ["High", "Medium"]
    landslide_alert = evaluate_nbro_landslide_alert(is_landslide_zone, peak_24h_rain)

    # Actionable guidance tailored to Sri Lankan emergency response
    guidance = []
    if flood_pred == "Major Flood":
        guidance.append(
            f"URGENT: Major flooding predicted for {official_district_name} along the {meta['primary_river_basin']} basin. Move to higher ground."
        )
    elif flood_pred == "Minor Flood":
        guidance.append(
            f"ADVISORY: Minor localized inundation anticipated in low-lying areas of {official_district_name}."
        )
    else:
        guidance.append(f"Normal conditions. No widespread riverine flooding anticipated for {official_district_name}.")

    if landslide_alert["level"] >= 2:
        guidance.append(
            f"NBRO WARNING: {landslide_alert['status']} active. Evacuate steep slopes in {official_district_name} immediately."
        )

    return {
        "status": "success",
        "district": official_district_name,
        "province": meta["province"],
        "climatic_zone": meta["zone"],
        "river_basin": meta["primary_river_basin"],
        "hazard_profile": meta["major_hazard_profile"],
        "prediction": {
            "flood_status": flood_pred,
            "flood_probabilities": prob_dict,
            "overall_hazard_level": hazard_labels.get(hazard_idx, "Unknown"),
            "hazard_index": hazard_idx,
            "peak_24h_rain_mm": peak_24h_rain,
            "annual_rainfall_mm": round(annual_rainfall, 1)
        },
        "nbro_landslide_alert": landslide_alert,
        "actionable_guidance": guidance,
        "emergency_contacts": {
            "dmc_hotline": "117 (Disaster Management Centre 24/7)",
            "ambulance": "1990 (Suwa Seriya Pre-Hospital Care)",
            "police": "119",
            "nbro_landslides": "011-2588946 / 011-2588949",
            "met_department": "011-2676493"
        }
    }

if __name__ == "__main__":
    print("=== Testing Sri Lanka Disaster Prediction Engine ===")
    
    # Test 1: Colombo during heavy Southwest monsoon
    print("\n--- Test 1: Colombo (Heavy Southwest Monsoon) ---")
    res_colombo = predict_disaster_risk(
        district="Colombo",
        monthly_rainfall={"MAY": 450.0, "JUN": 420.0, "JUL": 300.0},
        peak_24h_rain=175.0
    )
    print(json.dumps(res_colombo, indent=2))

    # Test 2: Ratnapura (Hill country slope + Kalu Ganga flood risk)
    print("\n--- Test 2: Ratnapura (Kalu Ganga + Landslide Risk) ---")
    res_ratnapura = predict_disaster_risk(
        district="Ratnapura",
        monthly_rainfall={"MAY": 520.0, "NOV": 450.0},
        peak_24h_rain=135.0
    )
    print(json.dumps(res_ratnapura, indent=2))

    # Test 3: Jaffna during dry period
    print("\n--- Test 3: Jaffna (Dry Period) ---")
    res_jaffna = predict_disaster_risk(
        district="Jaffna",
        monthly_rainfall={"MAY": 15.0, "JUN": 10.0},
        peak_24h_rain=12.0
    )
    print(json.dumps(res_jaffna, indent=2))
