"""
ResQAI — Sri Lanka Disaster Hazard Prediction Microservice
Exposes REST endpoints for real-time flood risk evaluation and NBRO landslide alerts.
Uses daily weather parameters from the sri_lanka_flood_risk_modeled dataset.
"""

import os
import sys
from pathlib import Path
from typing import Dict, Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# Ensure the directory of this script is in sys.path for local module resolution
sys.path.insert(0, str(Path(__file__).resolve().parent))

from predict import predict_disaster_risk, get_supported_districts

app = FastAPI(
    title="ResQAI Sri Lanka Disaster Hazard ML API",
    description="Machine Learning prediction service for Sri Lankan riverine floods and NBRO landslide alerts.",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HazardPredictionRequest(BaseModel):
    district: str = Field(..., description="Sri Lankan District (e.g., 'Colombo', 'Ratnapura', 'Kandy')")
    climatic_zone: Optional[str] = Field(
        None,
        description="Climatic zone ('Wet', 'Dry', 'Intermediate'). Auto-detected from district if omitted."
    )
    precipitation_sum: float = Field(
        0.0, description="Total precipitation for the day (mm)"
    )
    rain_sum: float = Field(
        0.0, description="Total rainfall for the day (mm)"
    )
    soil_moisture_0_to_7cm: float = Field(
        0.3, description="Mean soil moisture in 0–7 cm layer (m³/m³, range 0–1)"
    )
    soil_moisture_7_to_28cm: float = Field(
        0.3, description="Mean soil moisture in 7–28 cm layer (m³/m³, range 0–1)"
    )
    temperature_2m_max: float = Field(
        30.0, description="Maximum temperature at 2m height (°C)"
    )
    wind_speed_10m_max: float = Field(
        10.0, description="Maximum wind speed at 10m height (km/h)"
    )
    rain_24h: float = Field(
        0.0, description="Accumulated rainfall in last 24 hours (mm)"
    )
    rain_48h: Optional[float] = Field(
        None, description="Accumulated rainfall in last 48 hours (mm). Defaults to rain_24h."
    )
    rain_72h: Optional[float] = Field(
        None, description="Accumulated rainfall in last 72 hours (mm). Defaults to rain_48h."
    )
    soil_saturation_index: Optional[float] = Field(
        None, description="Computed soil saturation index (0–1). Auto-calculated if omitted."
    )

    class Config:
        json_schema_extra = {
            "example": {
                "district": "Ratnapura",
                "precipitation_sum": 140.0,
                "rain_sum": 140.0,
                "soil_moisture_0_to_7cm": 0.52,
                "soil_moisture_7_to_28cm": 0.50,
                "temperature_2m_max": 26.0,
                "wind_speed_10m_max": 18.5,
                "rain_24h": 140.0,
                "rain_48h": 250.0,
                "rain_72h": 350.0
            }
        }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "ResQAI Sri Lanka Disaster ML API",
        "supported_districts_count": len(get_supported_districts())
    }

@app.get("/districts")
def list_districts():
    """Returns the list of all 25 supported Sri Lankan administrative districts."""
    return {"districts": get_supported_districts()}

@app.post("/predict")
def predict_hazard(payload: HazardPredictionRequest):
    """Predicts flood category, flood risk score, and NBRO landslide alert from daily weather data."""
    result = predict_disaster_risk(
        district=payload.district,
        climatic_zone=payload.climatic_zone,
        precipitation_sum=payload.precipitation_sum,
        rain_sum=payload.rain_sum,
        soil_moisture_0_to_7cm=payload.soil_moisture_0_to_7cm,
        soil_moisture_7_to_28cm=payload.soil_moisture_7_to_28cm,
        temperature_2m_max=payload.temperature_2m_max,
        wind_speed_10m_max=payload.wind_speed_10m_max,
        rain_24h=payload.rain_24h,
        rain_48h=payload.rain_48h,
        rain_72h=payload.rain_72h,
        soil_saturation_index=payload.soil_saturation_index,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result)
    return result

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5005"))
    uvicorn.run(app, host="0.0.0.0", port=port)
