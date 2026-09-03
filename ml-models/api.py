"""
ResQAI — Sri Lanka Disaster Hazard Prediction Microservice
Exposes REST endpoints for real-time flood risk evaluation and NBRO landslide alerts.
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
    version="2.0.0"
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
    monthly_rainfall: Optional[Dict[str, float]] = Field(
        None,
        description="Monthly rainfall in mm (e.g., {'MAY': 350.0, 'JUN': 280.0})"
    )
    peak_24h_rain_mm: Optional[float] = Field(
        0.0,
        description="Peak 24-hour rainfall in mm (critical for NBRO landslide alerts and flash floods)"
    )
    annual_rainfall_mm: Optional[float] = Field(
        None,
        description="Cumulative annual rainfall in mm (calculated automatically if omitted)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "district": "Ratnapura",
                "monthly_rainfall": {
                    "MAY": 480.0,
                    "JUN": 390.0,
                    "NOV": 350.0
                },
                "peak_24h_rain_mm": 125.0
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
    """Predicts flood occurrence, multi-hazard index, and NBRO landslide alert."""
    result = predict_disaster_risk(
        district=payload.district,
        monthly_rainfall=payload.monthly_rainfall,
        peak_24h_rain=payload.peak_24h_rain_mm or 0.0,
        annual_rainfall=payload.annual_rainfall_mm
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result)
    return result

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5005"))
    uvicorn.run(app, host="0.0.0.0", port=port)
