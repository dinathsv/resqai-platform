from copy import deepcopy
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import httpx
import pytest

from weather import (
    CACHE_SECONDS, LOCAL_TIMEZONE, MODEL, WeatherService, WeatherUnavailable,
    aggregate_weather, resolve_location,
)

END = datetime(2026, 10, 31, tzinfo=LOCAL_TIMEZONE)
NOW = datetime(2026, 10, 31, 10, tzinfo=timezone.utc)


@pytest.fixture
def provider_data():
    # Include extra hours: aggregation must select exact local-day intervals.
    stamps = [END + timedelta(hours=hour) for hour in range(-96, 25)]
    count = len(stamps)
    data = {
        "latitude": 7.0, "longitude": 80.0, "timezone": "Asia/Colombo", "utc_offset_seconds": 19800,
        "hourly_units": {"precipitation": "mm", "rain": "mm", "temperature_2m": "°C",
                         "wind_speed_10m": "km/h", "soil_moisture_0_to_7cm": "m³/m³",
                         "soil_moisture_7_to_28cm": "m³/m³"},
        "hourly": {
            "time": [stamp.strftime("%Y-%m-%dT%H:%M") for stamp in stamps],
            "precipitation": [1.0] * count, "rain": [1.0] * count,
            "soil_moisture_0_to_7cm": [0.4] * count, "soil_moisture_7_to_28cm": [0.6] * count,
            "temperature_2m": [25.0] * count, "wind_speed_10m": [8.0] * count,
        },
    }
    return data


def test_exact_hour_end_rainfall_windows_and_state_aggregation(provider_data):
    h = provider_data["hourly"]
    first_excluded = h["time"].index((END - timedelta(hours=72)).strftime("%Y-%m-%dT%H:%M"))
    last = h["time"].index(END.strftime("%Y-%m-%dT%H:%M"))
    start = h["time"].index((END - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M"))
    h["rain"][first_excluded] = 999  # Outside (start,end].
    h["rain"][last] = 2
    h["precipitation"][last] = 3
    h["soil_moisture_0_to_7cm"][start] = 0.8
    h["soil_moisture_0_to_7cm"][last] = 0.99  # State sample belongs to next day.
    h["temperature_2m"][start] = 42
    h["temperature_2m"][last] = 60
    h["wind_speed_10m"][start] = 20
    h["wind_speed_10m"][last] = 400
    result = aggregate_weather(provider_data, END, NOW)
    f = result["features"]
    assert f["rain_24h"] == f["rain_sum"] == 25
    assert f["rain_48h"] == 49 and f["rain_72h"] == 73
    assert f["precipitation_sum"] == 26
    assert f["soil_moisture_0_to_7cm"] == pytest.approx((23 * 0.4 + 0.8) / 24)
    assert f["soil_saturation_index"] == pytest.approx(0.6 * f["soil_moisture_0_to_7cm"] + 0.4 * 0.6)
    assert f["temperature_2m_max"] == 42 and f["wind_speed_10m_max"] == 20
    assert result["weather_date"] == "2026-10-30"
    assert result["period_start"] == "2026-10-30T00:00:00+05:30"
    assert result["period_end"] == "2026-10-31T00:00:00+05:30"


@pytest.mark.parametrize("bad", [None, [], {}, {"hourly": []}, {"hourly_units": []}])
def test_malformed_provider_containers_are_unavailable(provider_data, bad):
    payload = bad if not isinstance(bad, dict) or not bad else {**provider_data, **bad}
    with pytest.raises(WeatherUnavailable):
        aggregate_weather(payload, END, NOW)


@pytest.mark.parametrize("value", [None, float("nan"), float("inf"), -1, "1", True])
def test_missing_or_invalid_rainfall_never_becomes_zero(provider_data, value):
    provider_data["hourly"]["rain"][-25] = value
    with pytest.raises(WeatherUnavailable):
        aggregate_weather(provider_data, END, NOW)


def test_missing_hour_and_wrong_units_are_rejected(provider_data):
    missing_hour = deepcopy(provider_data)
    for values in missing_hour["hourly"].values():
        del values[35]
    with pytest.raises(WeatherUnavailable):
        aggregate_weather(missing_hour, END, NOW)
    provider_data["hourly_units"]["wind_speed_10m"] = "m/s"
    with pytest.raises(WeatherUnavailable):
        aggregate_weather(provider_data, END, NOW)


def test_real_dry_weather_is_valid(provider_data):
    for name in ("rain", "precipitation"):
        provider_data["hourly"][name] = [0.0] * len(provider_data["hourly"][name])
    assert aggregate_weather(provider_data, END, NOW)["features"]["rain_72h"] == 0


@pytest.mark.asyncio
async def test_cache_reuses_fresh_data_but_never_returns_expired_data(provider_data):
    service = WeatherService()
    service._fetch = AsyncMock(return_value=provider_data)
    first = await service.get_weather(6.9271, 79.8612, now=NOW)
    second = await service.get_weather(6.9271, 79.8612, now=NOW + timedelta(seconds=30))
    assert first["cached"] is False and second["cached"] is True
    assert service._fetch.await_count == 1
    # Cached data returned to a caller cannot mutate the shared cache.
    second["features"]["rain_24h"] = 999
    third = await service.get_weather(6.9271, 79.8612, now=NOW + timedelta(seconds=60))
    assert third["features"]["rain_24h"] == 24
    service._fetch.side_effect = WeatherUnavailable("Provider down")
    with pytest.raises(WeatherUnavailable):
        await service.get_weather(6.9271, 79.8612, now=NOW + timedelta(seconds=CACHE_SECONDS + 1))


@pytest.mark.asyncio
async def test_near_midnight_cache_expires_at_local_day_boundary(provider_data):
    service = WeatherService()
    service._fetch = AsyncMock(return_value=provider_data)
    near_midnight = datetime(2026, 10, 31, 23, 59, tzinfo=LOCAL_TIMEZONE)
    result = await service.get_weather(6.9271, 79.8612, now=near_midnight)
    assert datetime.fromisoformat(result["expires_at"]) == END + timedelta(days=1)
    # New day must fetch new weather, even though15min TTL would not have elapsed.
    service._fetch.side_effect = WeatherUnavailable("Unavailable new day")
    with pytest.raises(WeatherUnavailable):
        await service.get_weather(6.9271, 79.8612, now=near_midnight + timedelta(minutes=2))
    assert service._fetch.await_count == 2


@pytest.mark.asyncio
async def test_provider_request_pins_model_units_and_timescale(monkeypatch, provider_data):
    real_client = httpx.AsyncClient
    def handler(request):
        assert request.url.host == "api.open-meteo.com"
        assert request.url.params["models"] == MODEL
        assert request.url.params["past_days"] == "4"
        assert request.url.params["timezone"] == "Asia/Colombo"
        assert request.url.params["wind_speed_unit"] == "kmh"
        return httpx.Response(200, json=provider_data)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs))
    result = await WeatherService().get_weather(6.9271, 79.8612, now=NOW)
    assert result["features"]["rain_24h"] == 24


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["http", "timeout", "invalid_json"])
async def test_provider_failures_are_explicit(monkeypatch, failure):
    real_client = httpx.AsyncClient
    def handler(request):
        if failure == "timeout":
            raise httpx.ReadTimeout("provider timeout", request=request)
        if failure == "invalid_json":
            return httpx.Response(200, content=b"bad json")
        return httpx.Response(503)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs))
    with pytest.raises(WeatherUnavailable):
        await WeatherService().get_weather(6.9271, 79.8612, now=NOW)


def test_location_requires_explicit_district_and_complete_valid_gps_pair():
    assert resolve_location(" colombo ", None, None)["source"] == "district_representative"
    assert resolve_location("Colombo", 6.93, 79.86)["source"] == "gps"
    for args in (("Unknown", None, None), ("Colombo", 6.9, None),
                 ("Colombo", float("nan"), 80), ("Colombo", 10.1, 80)):
        with pytest.raises(ValueError):
            resolve_location(*args)
