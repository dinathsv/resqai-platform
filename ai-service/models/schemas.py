"""
ResQAI AI Microservice — Pydantic request/response schemas.
All validation is handled here so routers stay clean.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ── Chatbot ──────────────────────────────────────────────────

class FirstAidRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="User's first-aid question")
    language: str = Field(default="auto", description="Language code or 'auto' for detection")


class FirstAidResponse(BaseModel):
    reply: str
    language_detected: str
    show_1990: bool
    is_critical: bool


# ── Multilingual Report ──────────────────────────────────────

class TranslateReportRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000, description="Disaster report in any language")


class TranslateReportResponse(BaseModel):
    emergency_type: str
    urgency_level: int = Field(..., ge=1, le=5)
    location_mentioned: Optional[str] = None
    people_count: Optional[int] = None
    summary_english: str
    original_language: str


# ── Situational Summary ──────────────────────────────────────

class HelpRequestItem(BaseModel):
    request_id: Optional[str] = None
    emergency_type: str
    urgency_level: int = Field(..., ge=1, le=5)
    location: Optional[str] = None
    message: Optional[str] = None
    status: Optional[str] = None


class GenerateSummaryRequest(BaseModel):
    requests: list[HelpRequestItem] = Field(..., min_length=1, description="Active help requests to summarise")


class GenerateSummaryResponse(BaseModel):
    narrative: str
    total_incidents: int
    critical_count: int
    zones: list[str]


# ── Resource Locator ─────────────────────────────────────────

class LocateResourcesRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lng: float = Field(..., ge=-180, le=180, description="Longitude")
    emergency_type: str = Field(..., min_length=1, description="Type of emergency")


class HospitalInfo(BaseModel):
    hospital_id: str
    name: str
    phone: Optional[str] = None
    specialization: Optional[str] = None
    has_cardiac_icu: bool
    has_trauma_unit: bool
    latitude: float
    longitude: float
    distance_metres: float


class LocateResourcesResponse(BaseModel):
    hospitals: list[HospitalInfo]
    recommended: Optional[HospitalInfo] = None
    recommendation_reason: str = ""
    contact_1990: bool
