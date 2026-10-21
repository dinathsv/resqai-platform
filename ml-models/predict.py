"""
ResQAI — Sri Lanka Disaster Hazard & Flood Prediction Engine
Evaluates daily weather-driven flood probabilities, NBRO landslide risk thresholds,
and generates actionable emergency guidance for Sri Lanka's 25 districts.

Uses the sri_lanka_flood_risk_modeled.csv feature schema:
  precipitation_sum, rain_sum, soil_moisture, temperature, wind_speed,
  rain_24h/48h/72h, soil_saturation_index
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
ZONE_ENCODER_PATH = os.path.join(MODELS_DIR, "sri_lanka_climatic_zone_encoder.joblib")
FLOOD_MODEL_PATH = os.path.join(MODELS_DIR, "sri_lanka_flood_model.joblib")
RISK_MODEL_PATH = os.path.join(MODELS_DIR, "sri_lanka_flood_risk_model.joblib")
DISTRICTS_CSV = os.path.join(DATASETS_DIR, "sri_lanka_districts.csv")

# Global cached resources
_district_encoder: Any = None
_zone_encoder: Any = None
_flood_model: Any = None
_risk_model: Any = None
_districts_meta: Dict[str, Any] = {}

def _load_artifacts() -> None:
    global _district_encoder, _zone_encoder, _flood_model, _risk_model, _districts_meta
    if _district_encoder is None:
        if not os.path.exists(ENCODER_PATH) or not os.path.exists(FLOOD_MODEL_PATH):
            raise FileNotFoundError(
                "Model artifacts not found. Please run 'python train.py' first."
            )
        _district_encoder = joblib.load(ENCODER_PATH)
        _zone_encoder = joblib.load(ZONE_ENCODER_PATH)
        _flood_model = joblib.load(FLOOD_MODEL_PATH)
        _risk_model = joblib.load(RISK_MODEL_PATH)

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

def evaluate_nbro_landslide_alert(is_landslide_zone: bool, rain_24h: float) -> Dict[str, Any]:
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

    if rain_24h >= 150.0:
        return {
            "level": 3,
            "color": "Red",
            "status": "Level 3 - Evacuation",
            "message": "Rainfall exceeds 150mm within 24h. High risk of landslides, rock falls, and cut-slope failures. Evacuate designated slopes immediately to safe shelters."
        }
    elif rain_24h >= 100.0:
        return {
            "level": 2,
            "color": "Amber",
            "status": "Level 2 - Warning",
            "message": "Rainfall exceeds 100mm within 24h. Be ready to evacuate immediately if continuous rains or slope ground cracks appear."
        }
    elif rain_24h >= 75.0:
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
    climatic_zone: Optional[str] = None,
    precipitation_sum: float = 0.0,
    rain_sum: float = 0.0,
    soil_moisture_0_to_7cm: float = 0.3,
    soil_moisture_7_to_28cm: float = 0.3,
    temperature_2m_max: float = 30.0,
    wind_speed_10m_max: float = 10.0,
    rain_24h: float = 0.0,
    rain_48h: Optional[float] = None,
    rain_72h: Optional[float] = None,
    soil_saturation_index: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Predicts flood category and flood risk score for a given Sri Lankan district
    using daily weather parameters.

    Args:
        district: Sri Lankan district name (e.g., 'Colombo', 'Ratnapura')
        climatic_zone: Climatic zone ('Wet', 'Dry', 'Intermediate'). Auto-detected if omitted.
        precipitation_sum: Total precipitation for the day (mm)
        rain_sum: Total rainfall for the day (mm)
        soil_moisture_0_to_7cm: Mean soil moisture in 0–7 cm layer (m³/m³, 0–1)
        soil_moisture_7_to_28cm: Mean soil moisture in 7–28 cm layer (m³/m³, 0–1)
        temperature_2m_max: Maximum temperature at 2m height (°C)
        wind_speed_10m_max: Maximum wind speed at 10m height (km/h)
        rain_24h: Accumulated rainfall in last 24 hours (mm)
        rain_48h: Accumulated rainfall in last 48 hours (mm). Defaults to rain_24h if not provided.
        rain_72h: Accumulated rainfall in last 72 hours (mm). Defaults to rain_48h if not provided.
        soil_saturation_index: Computed soil saturation index (0–1). Auto-calculated if omitted.
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

    # Encode district
    encoded_district = _district_encoder.transform([official_district_name])[0]

    # Auto-detect climatic zone from district metadata if not supplied
    if climatic_zone is None:
        climatic_zone = meta.get("zone", "Dry")
    # Encode climatic zone
    try:
        encoded_zone = _zone_encoder.transform([climatic_zone])[0]
    except ValueError:
        # Fallback if zone not seen during training
        encoded_zone = 0

    # Default accumulated rain values
    if rain_48h is None:
        rain_48h = rain_24h
    if rain_72h is None:
        rain_72h = rain_48h

    # Auto-calculate soil saturation index if not provided
    if soil_saturation_index is None:
        soil_saturation_index = (soil_moisture_0_to_7cm + soil_moisture_7_to_28cm) / 2.0

    # Prepare DataFrame for model inference
    input_row = {
        "district_encoded": encoded_district,
        "climatic_zone_encoded": encoded_zone,
        "precipitation_sum": precipitation_sum,
        "rain_sum": rain_sum,
        "soil_moisture_0_to_7cm_mean": soil_moisture_0_to_7cm,
        "soil_moisture_7_to_28cm_mean": soil_moisture_7_to_28cm,
        "temperature_2m_max": temperature_2m_max,
        "wind_speed_10m_max": wind_speed_10m_max,
        "rain_24h": rain_24h,
        "rain_48h": rain_48h,
        "rain_72h": rain_72h,
        "soil_saturation_index": soil_saturation_index,
    }
    df_input = pd.DataFrame([input_row])

    # --- Model Inferences ---
    # Flood category classification
    flood_category = _flood_model.predict(df_input)[0]
    flood_probs = _flood_model.predict_proba(df_input)[0]
    classes = list(_flood_model.classes_)
    prob_dict = {cls: round(float(prob) * 100, 1) for cls, prob in zip(classes, flood_probs)}

    # Flood risk score regression
    flood_risk_score = float(_risk_model.predict(df_input)[0])
    flood_risk_score = max(0.0, round(flood_risk_score, 2))

    # NBRO Landslide Analysis
    is_landslide_zone = meta["landslide_prone_zone"] in ["High", "Medium"]
    landslide_alert = evaluate_nbro_landslide_alert(is_landslide_zone, rain_24h)

    # --- Actionable guidance tailored to Sri Lankan emergency response ---
    guidance = []
    if flood_category == "Critical Emergency (Catastrophic Overflow)":
        guidance.append(
            f"CRITICAL: Catastrophic flooding predicted for {official_district_name} "
            f"along the {meta['primary_river_basin']} basin. Evacuate immediately to higher ground."
        )
    elif flood_category == "High Warning (Inundation)":
        guidance.append(
            f"URGENT: Significant inundation expected in {official_district_name}. "
            f"Move to elevated areas and avoid river crossings."
        )
    elif flood_category == "Advisory (Waterlogging)":
        guidance.append(
            f"ADVISORY: Waterlogging and localized flooding anticipated in low-lying areas of {official_district_name}."
        )
    else:
        guidance.append(
            f"Normal conditions. No widespread riverine flooding anticipated for {official_district_name}."
        )

    if landslide_alert["level"] >= 2:
        guidance.append(
            f"NBRO WARNING: {landslide_alert['status']} active. "
            f"Evacuate steep slopes in {official_district_name} immediately."
        )

    return {
        "status": "success",
        "district": official_district_name,
        "province": meta["province"],
        "climatic_zone": climatic_zone,
        "river_basin": meta["primary_river_basin"],
        "hazard_profile": meta["major_hazard_profile"],
        "prediction": {
            "flood_category": flood_category,
            "flood_status": flood_category,
            "flood_category_probabilities": prob_dict,
            "flood_probabilities": prob_dict,
            "flood_risk_score": flood_risk_score,
            "hazard_index": flood_risk_score,
            "overall_hazard_level": flood_category,
            "rain_24h_mm": rain_24h,
            "peak_24h_rain_mm": rain_24h,
            "rain_48h_mm": rain_48h,
            "rain_72h_mm": rain_72h,
            "annual_rainfall_mm": round(rain_24h * 15, 1),
            "soil_saturation_index": round(soil_saturation_index, 4),
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

    # Test 1: Colombo during heavy monsoon day
    print("\n--- Test 1: Colombo (Heavy Monsoon Rain Day) ---")
    res_colombo = predict_disaster_risk(
        district="Colombo",
        precipitation_sum=185.0,
        rain_sum=185.0,
        soil_moisture_0_to_7cm=0.48,
        soil_moisture_7_to_28cm=0.45,
        temperature_2m_max=27.5,
        wind_speed_10m_max=22.0,
        rain_24h=185.0,
        rain_48h=310.0,
        rain_72h=420.0,
    )
    print(json.dumps(res_colombo, indent=2))

    # Test 2: Ratnapura (Hill country slope + Kalu Ganga flood risk)
    print("\n--- Test 2: Ratnapura (Kalu Ganga + Landslide Risk) ---")
    res_ratnapura = predict_disaster_risk(
        district="Ratnapura",
        precipitation_sum=140.0,
        rain_sum=140.0,
        soil_moisture_0_to_7cm=0.52,
        soil_moisture_7_to_28cm=0.50,
        temperature_2m_max=26.0,
        wind_speed_10m_max=18.5,
        rain_24h=140.0,
        rain_48h=250.0,
        rain_72h=350.0,
    )
    print(json.dumps(res_ratnapura, indent=2))

    # Test 3: Jaffna during dry period
    print("\n--- Test 3: Jaffna (Dry Period) ---")
    res_jaffna = predict_disaster_risk(
        district="Jaffna",
        precipitation_sum=2.0,
        rain_sum=2.0,
        soil_moisture_0_to_7cm=0.18,
        soil_moisture_7_to_28cm=0.20,
        temperature_2m_max=33.0,
        wind_speed_10m_max=12.0,
        rain_24h=2.0,
    )
    print(json.dumps(res_jaffna, indent=2))
