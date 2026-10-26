
"""
ResQAI — Sri Lanka Disaster Hazard Prediction Microservice

FastAPI REST API for:
- Machine learning flood category prediction
- Flood risk score regression
- NBRO landslide threshold evaluation
- Sri Lanka's 25 administrative districts
- Daily weather-based hazard analysis

Version: 3.0.0

Local:
    uvicorn api:app --host 0.0.0.0 --port 5005 --reload

Render:
    uvicorn api:app --host 0.0.0.0 --port $PORT
"""

import os
import sys
import logging
from pathlib import Path
from typing import Dict, Optional

import uvicorn

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Local Module Resolution
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from predict import (
    predict_disaster_risk,
    get_supported_districts,
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)

logger = logging.getLogger("resqai.ml")

# FastAPI Application
app = FastAPI(
    title="ResQAI Sri Lanka Disaster Hazard ML API",
    description=(
        "Machine learning prediction service for Sri Lankan "
        "riverine floods, flood risk scores, and "
        "NBRO landslide risk alerts."
    ),
    version="3.0.0",
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root Endpoint
# Fixes GET / 404 on Render
@app.get("/", tags=["System"])
def root():
    return {
        "status": "online",
        "service": "ResQAI Sri Lanka Disaster Hazard ML API",
        "version": app.version,
        "message": "ResQAI ML Prediction Service is running",
        "endpoints": {
            "health": "/health",
            "districts": "/districts",
            "prediction": "/predict",
            "documentation": "/docs",
            "openapi": "/openapi.json",
        },
    }


# Explicit HEAD support for monitoring services
@app.head("/", include_in_schema=False)
def root_head():
    return Response(status_code=200)

# ML Model Health Check
@app.get("/health", tags=["System"])
def health_check():
    try:
        districts = get_supported_districts()

        return {
            "status": "healthy",
            "service": "resqai-ml",
            "version": app.version,
            "models": "loaded",
            "supported_districts_count": len(districts),
        }

    except Exception:
        logger.exception("ML model health check failed")

        raise HTTPException(
            status_code=503,
            detail="ML model artifacts are unavailable",
        )

# Hazard Prediction Request Schema
class HazardPredictionRequest(BaseModel):

    district: str = Field(
        ...,
        min_length=1,
        description=(
            "Sri Lankan district, such as Colombo, "
            "Ratnapura, or Kandy."
        ),
    )

    climatic_zone: Optional[str] = Field(
        None,
        description=(
            "Climatic zone: Wet, Dry, or Intermediate. "
            "Automatically detected if omitted."
        ),
    )

    precipitation_sum: float = Field(
        0.0,
        description="Total daily precipitation (mm)",
    )

    rain_sum: float = Field(
        0.0,
        description="Total daily rainfall (mm)",
    )

    soil_moisture_0_to_7cm: float = Field(
        0.3,
        ge=0.0,
        le=1.0,
        description="Mean soil moisture at 0–7 cm (m³/m³)",
    )

    soil_moisture_7_to_28cm: float = Field(
        0.3,
        ge=0.0,
        le=1.0,
        description="Mean soil moisture at 7–28 cm (m³/m³)",
    )

    temperature_2m_max: float = Field(
        30.0,
        description="Maximum temperature at 2m (°C)",
    )

    wind_speed_10m_max: float = Field(
        10.0,
        description="Maximum wind speed at 10m (km/h)",
    )

    rain_24h: float = Field(
        0.0,
        description="Accumulated rainfall during 24 hours (mm)",
    )

    rain_48h: Optional[float] = Field(
        None,
        description=(
            "Accumulated rainfall during 48 hours (mm). "
            "Defaults to rain_24h."
        ),
    )

    rain_72h: Optional[float] = Field(
        None,
        description=(
            "Accumulated rainfall during 72 hours (mm). "
            "Defaults to rain_48h."
        ),
    )

    soil_saturation_index: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Soil saturation index between 0 and 1",
    )

    # Legacy request compatibility

    peak_24h_rain_mm: Optional[float] = Field(
        None,
        description="Legacy 24-hour rainfall parameter",
    )

    monthly_rainfall: Optional[Dict[str, float]] = Field(
        None,
        description="Legacy monthly rainfall values",
    )

    annual_rainfall_mm: Optional[float] = Field(
        None,
        description="Legacy annual rainfall parameter",
    )

    model_config = {
        "json_schema_extra": {
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
                "rain_72h": 350.0,
            }
        }
    }

# Supported Districts Endpoint
@app.get("/districts", tags=["Districts"])
def list_districts():
    """
    Returns supported Sri Lankan administrative districts.
    """

    try:
        districts = get_supported_districts()

        return {
            "status": "success",
            "count": len(districts),
            "districts": districts,
        }

    except Exception:
        logger.exception("Failed to load supported districts")

        raise HTTPException(
            status_code=503,
            detail="District information is unavailable",
        )

# Hazard Prediction Endpoint
@app.post("/predict", tags=["Prediction"])
def predict_hazard(payload: HazardPredictionRequest):
    """
    Predicts:
    - Flood category
    - Flood risk score
    - NBRO landslide alert
    - Actionable disaster guidance
    """

    # Support legacy 24-hour rainfall parameter
    rain_24 = payload.rain_24h

    if (
        (rain_24 is None or rain_24 == 0.0)
        and payload.peak_24h_rain_mm is not None
    ):
        rain_24 = payload.peak_24h_rain_mm

    # Default precipitation/rain totals
    precip = (
        payload.precipitation_sum
        if payload.precipitation_sum > 0.0
        else rain_24
    )

    rain_s = (
        payload.rain_sum
        if payload.rain_sum > 0.0
        else rain_24
    )

    try:
        result = predict_disaster_risk(
            district=payload.district,
            climatic_zone=payload.climatic_zone,
            precipitation_sum=precip,
            rain_sum=rain_s,
            soil_moisture_0_to_7cm=(
                payload.soil_moisture_0_to_7cm
            ),
            soil_moisture_7_to_28cm=(
                payload.soil_moisture_7_to_28cm
            ),
            temperature_2m_max=(
                payload.temperature_2m_max
            ),
            wind_speed_10m_max=(
                payload.wind_speed_10m_max
            ),
            rain_24h=rain_24,
            rain_48h=payload.rain_48h,
            rain_72h=payload.rain_72h,
            soil_saturation_index=(
                payload.soil_saturation_index
            ),
        )

        if "error" in result:
            raise HTTPException(
                status_code=400,
                detail=result,
            )

        return result

    except HTTPException:
        raise

    except (FileNotFoundError, OSError):
        logger.exception("ML artifacts unavailable")

        raise HTTPException(
            status_code=503,
            detail="Prediction models are unavailable",
        )

    except Exception:
        logger.exception("Hazard prediction failed")

        raise HTTPException(
            status_code=500,
            detail="Hazard prediction failed",
        )

# Application Entry Point
if __name__ == "__main__":

    port = int(os.getenv("PORT", "5005"))

    logger.info(
        "Starting ResQAI ML API on port %s",
        port,
    )

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
    )
