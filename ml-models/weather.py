"""Bounded, cached weather inputs for the public district/GPS assessment.

Provider rainfall is a preceding-hour amount: a complete local day uses
interval endings (00:00, next 00:00]. Instantaneous weather samples use
[00:00, next 00:00). This deployment convention avoids partial-day totals;
the modeled training CSV does not document its original timezone/provider.
"""

import asyncio
from collections import OrderedDict
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import math
from typing import Any
from zoneinfo import ZoneInfo

import httpx

LOCAL_TIMEZONE = ZoneInfo("Asia/Colombo")
PROVIDER_URL = "https://api.open-meteo.com/v1/ecmwf"
MODEL = "ecmwf_ifs025"
CACHE_SECONDS = 900
MAX_CACHE_ENTRIES = 128
HOURLY_VARIABLES = (
    "precipitation", "rain", "soil_moisture_0_to_7cm",
    "soil_moisture_7_to_28cm", "temperature_2m", "wind_speed_10m",
)

# Representative points, consistent with the existing app's district map.
# A point estimate does not describe every location in an entire district.
DISTRICT_COORDS = {
    "Ampara": (7.2913, 81.6724), "Anuradhapura": (8.3114, 80.4037),
    "Badulla": (6.9934, 81.0550), "Batticaloa": (7.7310, 81.6747),
    "Colombo": (6.9271, 79.8612), "Galle": (6.0535, 80.2210),
    "Gampaha": (7.0840, 80.0098), "Hambantota": (6.1429, 81.1212),
    "Jaffna": (9.6615, 80.0255), "Kalutara": (6.5854, 80.1140),
    "Kandy": (7.2906, 80.6337), "Kegalle": (7.2513, 80.3464),
    "Kilinochchi": (9.3803, 80.3770), "Kurunegala": (7.4818, 80.3609),
    "Mannar": (8.9810, 79.9044), "Matale": (7.4675, 80.6234),
    "Matara": (5.9549, 80.5550), "Monaragala": (6.8728, 81.3507),
    "Mullaitivu": (9.2671, 80.8142), "Nuwara Eliya": (6.9497, 80.7891),
    "Polonnaruwa": (7.9403, 81.0188), "Puttalam": (8.0362, 79.8283),
    "Ratnapura": (6.6828, 80.3992), "Trincomalee": (8.5874, 81.2152),
    "Vavuniya": (8.7514, 80.4971),
}


class WeatherUnavailable(Exception):
    """Weather is incomplete or unavailable; never substitute dry defaults."""


def resolve_location(district: str, latitude: float | None, longitude: float | None) -> dict:
    canonical = next((name for name in DISTRICT_COORDS if name.lower() == district.strip().lower()), None)
    if canonical is None:
        raise ValueError("Choose a supported Sri Lankan district.")
    if (latitude is None) != (longitude is None):
        raise ValueError("Latitude and longitude must be supplied together.")
    source = "district_representative"
    if latitude is None:
        latitude, longitude = DISTRICT_COORDS[canonical]
    else:
        # Regional bounds, not administrative boundary identification. The user
        # explicitly confirms the district used for the model profile.
        if not (math.isfinite(latitude) and math.isfinite(longitude)
                and 5.8 <= latitude <= 9.9 and 79.5 <= longitude <= 82.0):
            raise ValueError("Choose a weather location within the Sri Lanka region.")
        source = "gps"
    return {"district": canonical, "latitude": round(latitude, 4),
            "longitude": round(longitude, 4), "source": source}


def _number(value: Any, minimum: float, maximum: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (float, int)):
        raise WeatherUnavailable("Weather data is incomplete.")
    value = float(value)
    if not math.isfinite(value) or not minimum <= value <= maximum:
        raise WeatherUnavailable("Weather data contains invalid values.")
    return value


def aggregate_weather(data: dict, end: datetime, fetched_at: datetime) -> dict:
    """Require all 72 hourly rainfall intervals and latest-day state samples."""
    try:
        if not isinstance(data, dict):
            raise WeatherUnavailable("Weather response is invalid.")
        if data.get("timezone") != "Asia/Colombo" or data.get("utc_offset_seconds") != 19800:
            raise WeatherUnavailable("The weather timezone does not match the assessment.")
        units = data["hourly_units"]
        hourly = data["hourly"]
        if not isinstance(units, dict) or not isinstance(hourly, dict):
            raise WeatherUnavailable("Weather response is invalid.")
        expected_units = {"precipitation": "mm", "rain": "mm", "temperature_2m": "°C",
                          "wind_speed_10m": "km/h", "soil_moisture_0_to_7cm": "m³/m³",
                          "soil_moisture_7_to_28cm": "m³/m³"}
        if any(units.get(name) != unit for name, unit in expected_units.items()):
            raise WeatherUnavailable("The weather units do not match the model inputs.")
        times = hourly["time"]
        if not isinstance(times, list) or not times or len(times) > 240:
            raise WeatherUnavailable("Unexpected weather time range.")
        if any(not isinstance(hourly.get(name), list) or len(hourly[name]) != len(times)
               for name in HOURLY_VARIABLES):
            raise WeatherUnavailable("Weather data is incomplete.")
        if any(not isinstance(value, str) for value in times) or len(set(times)) != len(times):
            raise WeatherUnavailable("Weather timestamps are invalid.")
        index = {value: i for i, value in enumerate(times)}
        local_end = end.astimezone(LOCAL_TIMEZONE).replace(tzinfo=None)
        rainfall_times = [local_end - timedelta(hours=hour) for hour in range(72)]
        state_times = [local_end - timedelta(hours=hour) for hour in range(1, 25)]

        def samples(name: str, timestamps: list[datetime], minimum: float, maximum: float) -> list[float]:
            return [_number(hourly[name][index[stamp.isoformat(timespec="minutes")]], minimum, maximum)
                    for stamp in timestamps]

        rain = samples("rain", rainfall_times, 0, 1000)
        # Need the latest day's precipitation as a separate trained feature.
        precipitation = samples("precipitation", rainfall_times[:24], 0, 1000)
        top = samples("soil_moisture_0_to_7cm", state_times, 0, 1)
        deep = samples("soil_moisture_7_to_28cm", state_times, 0, 1)
        temperature = samples("temperature_2m", state_times, -60, 65)
        wind = samples("wind_speed_10m", state_times, 0, 500)
        top_mean, deep_mean = sum(top) / 24, sum(deep) / 24
        features = {
            "precipitation_sum": sum(precipitation), "rain_sum": sum(rain[:24]),
            "soil_moisture_0_to_7cm": top_mean, "soil_moisture_7_to_28cm": deep_mean,
            "temperature_2m_max": max(temperature), "wind_speed_10m_max": max(wind),
            "rain_24h": sum(rain[:24]), "rain_48h": sum(rain[:48]), "rain_72h": sum(rain),
            "soil_saturation_index": 0.6 * top_mean + 0.4 * deep_mean,
        }
        start = end - timedelta(days=1)
        return {
            "provider": "Open-Meteo", "model": "ECMWF IFS 0.25°", "model_id": MODEL,
            "source_url": "https://open-meteo.com/en/docs/ecmwf-api",
            "timezone": "Asia/Colombo", "weather_date": start.date().isoformat(),
            "period_start": start.isoformat(), "period_end": end.isoformat(),
            "fetched_at": fetched_at.isoformat(),
            "expires_at": min(fetched_at + timedelta(seconds=CACHE_SECONDS),
                              end + timedelta(days=1)).isoformat(),
            "cached": False, "data_kind": "recent_model_weather",
            "grid_latitude": _number(data["latitude"], -90, 90),
            "grid_longitude": _number(data["longitude"], -180, 180),
            "features": features,
        }
    except (KeyError, TypeError, ValueError, OverflowError) as exc:
        raise WeatherUnavailable("Weather data is incomplete for the required period.") from exc


class WeatherService:
    def __init__(self):
        self._cache: OrderedDict[tuple, dict] = OrderedDict()
        self._fetch_lock = asyncio.Lock()

    async def _fetch(self, latitude: float, longitude: float) -> dict:
        params = {
            "latitude": latitude, "longitude": longitude, "models": MODEL,
            "hourly": ",".join(HOURLY_VARIABLES), "past_days": 4, "forecast_days": 1,
            "timezone": "Asia/Colombo", "wind_speed_unit": "kmh",
            "temperature_unit": "celsius", "precipitation_unit": "mm",
        }
        try:
            async with httpx.AsyncClient(timeout=8, follow_redirects=False) as client:
                response = await asyncio.wait_for(client.get(PROVIDER_URL, params=params), timeout=10)
                response.raise_for_status()
                if len(response.content) > 250_000:
                    raise WeatherUnavailable("Weather response exceeded the expected size.")
                return response.json()
        except (httpx.HTTPError, asyncio.TimeoutError, ValueError) as exc:
            raise WeatherUnavailable("The weather provider is temporarily unavailable.") from exc

    async def get_weather(self, latitude: float, longitude: float, *, now: datetime | None = None) -> dict:
        # The optional clock is for deterministic isolated tests.
        clock = (lambda: now.astimezone(timezone.utc)) if now is not None else lambda: datetime.now(timezone.utc)
        started_at = clock()
        end = started_at.astimezone(LOCAL_TIMEZONE).replace(hour=0, minute=0, second=0, microsecond=0)
        key = (latitude, longitude, end.date())

        def cached_result() -> dict | None:
            cached = self._cache.get(key)
            if cached and datetime.fromisoformat(cached["expires_at"]) > clock():
                self._cache.move_to_end(key)
                result = deepcopy(cached)
                result["cached"] = True
                return result
            return None

        cached = cached_result()
        if cached:
            return cached
        # Coalesce identical concurrent misses and bound outbound provider load.
        # At most one request is in flight per worker; cached hits never wait.
        try:
            async with asyncio.timeout(12):
                async with self._fetch_lock:
                    cached = cached_result()
                    if cached:
                        return cached
                    data = await self._fetch(latitude, longitude)
                    fetched_at = clock()
                    if fetched_at.astimezone(LOCAL_TIMEZONE).date() != end.date():
                        raise WeatherUnavailable("The assessment day changed. Please retry for the latest complete day.")
                    result = aggregate_weather(data, end, fetched_at)
                    self._cache[key] = result
                    self._cache.move_to_end(key)
                    while len(self._cache) > MAX_CACHE_ENTRIES:
                        self._cache.popitem(last=False)
                    return deepcopy(result)
        except TimeoutError as exc:
            raise WeatherUnavailable("Weather requests are busy. Please try again shortly.") from exc


weather_service = WeatherService()
