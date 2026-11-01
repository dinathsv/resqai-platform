from unittest.mock import AsyncMock, Mock

import httpx
import pytest

import api
from weather import WeatherUnavailable


@pytest.mark.asyncio
async def test_automatic_api_only_uses_validated_provider_features(monkeypatch):
    features = {"rain_24h": 20, "rain_48h": 45, "rain_72h": 70,
                "precipitation_sum": 20, "rain_sum": 20,
                "soil_moisture_0_to_7cm": 0.4, "soil_moisture_7_to_28cm": 0.5,
                "temperature_2m_max": 29, "wind_speed_10m_max": 12, "soil_saturation_index": 0.44}
    fetch = AsyncMock(return_value={"provider": "Open-Meteo", "features": features})
    model = Mock(return_value={"status": "success", "district": "Colombo"})
    monkeypatch.setattr(api.weather_service, "get_weather", fetch)
    monkeypatch.setattr(api, "predict_disaster_risk", model)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=api.app), base_url="http://test") as client:
        response = await client.post("/predict/automatic", json={"district": "colombo"})
    assert response.status_code == 200
    result = response.json()
    assert result["mode"] == "automatic"
    assert result["assessment"]["is_official_warning"] is False
    assert result["location"]["source"] == "district_representative"
    model.assert_called_once_with(district="Colombo", **features)
    fetch.assert_awaited_once_with(6.9271, 79.8612)


@pytest.mark.asyncio
async def test_missing_weather_never_runs_model(monkeypatch):
    monkeypatch.setattr(api.weather_service, "get_weather", AsyncMock(side_effect=WeatherUnavailable("missing")))
    model = Mock()
    monkeypatch.setattr(api, "predict_disaster_risk", model)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=api.app), base_url="http://test") as client:
        response = await client.post("/predict/automatic", json={"district": "Colombo"})
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "weather_unavailable"
    model.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("body", [
    {"district": "Unknown"}, {"district": "Colombo", "latitude": 6.9},
    {"district": "Colombo", "latitude": 20, "longitude": 80},
    {"district": "Colombo", "rain_24h": 0},
])
async def test_invalid_automatic_inputs_do_not_contact_weather(monkeypatch, body):
    fetch = AsyncMock()
    monkeypatch.setattr(api.weather_service, "get_weather", fetch)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=api.app), base_url="http://test") as client:
        response = await client.post("/predict/automatic", json=body)
    assert response.status_code == 422
    fetch.assert_not_awaited()
