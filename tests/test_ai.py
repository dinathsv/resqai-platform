import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_chatbot_english_critical(client: AsyncClient, monkeypatch):
    async def mock_call_llm(*args, **kwargs):
        return "Call 1990 immediately for severe bleeding. Step 1: Apply pressure."
        
    monkeypatch.setattr("app.routers.ai.call_llm", mock_call_llm)
    
    r = await client.post('/api/ai/first-aid-chat', json={
        "message": "My father is not breathing",
        "language": "en"
    })
    
    assert r.status_code == 200
    data = r.json()
    assert data["show_1990"] is True
    assert data["is_critical"] is True
    assert "1990" in data["reply"]

@pytest.mark.asyncio
async def test_chatbot_sinhala(client: AsyncClient, monkeypatch):
    async def mock_call_llm(*args, **kwargs):
        return "මෙය පරීක්ෂණයකි." # "This is a test." in Sinhala
        
    monkeypatch.setattr("app.routers.ai.call_llm", mock_call_llm)
    
    r = await client.post('/api/ai/first-aid-chat', json={
        "message": "මට උදව් ඕනේ" # "I need help" in Sinhala
    })
    
    assert r.status_code == 200
    data = r.json()
    assert data["language_detected"] == "si"
    assert "මෙය" in data["reply"]

@pytest.mark.asyncio
async def test_chatbot_fallback_when_api_down(client: AsyncClient, monkeypatch):
    async def mock_call_llm_none(*args, **kwargs):
        return None
        
    monkeypatch.setattr("app.routers.ai.call_llm", mock_call_llm_none)
    
    r = await client.post('/api/ai/first-aid-chat', json={
        "message": "help"
    })
    
    assert r.status_code == 200
    data = r.json()
    assert data["show_1990"] is True
    assert "1990" in data["reply"]

@pytest.mark.asyncio
async def test_translate_report_flood(client: AsyncClient, monkeypatch):
    async def mock_call_llm_json(*args, **kwargs):
        return '{"emergency_type": "flood", "urgency_level": 4, "location_mentioned": "Colombo", "people_count": 2, "summary_english": "Flood reported"}'
        
    monkeypatch.setattr("app.routers.ai.call_llm", mock_call_llm_json)
    
    r = await client.post('/api/ai/translate-report', json={
        "message": "watura gedarata awa, ammala innawa"
    })
    
    assert r.status_code == 200
    data = r.json()
    assert data["emergency_type"] == "flood"
    assert data["urgency_level"] >= 3

@pytest.mark.asyncio
async def test_locate_resources_returns_hospitals(client: AsyncClient, monkeypatch):
    async def mock_call_llm_json(*args, **kwargs):
        return '{"recommended_hospital_id": "1", "reason": "Closest with trauma unit", "should_call_1990": true}'
        
    monkeypatch.setattr("app.routers.ai.call_llm", mock_call_llm_json)
    
    hospitals = [
        {"hospital_id": "1", "name": "Hospital A", "has_cardiac_icu": False, "has_trauma_unit": True, "distance_meters": 500},
        {"hospital_id": "2", "name": "Hospital B", "has_cardiac_icu": True, "has_trauma_unit": False, "distance_meters": 1500}
    ]
    
    r = await client.post('/api/ai/locate-resources', json={
        "lat": 6.9,
        "lng": 79.8,
        "emergency_type": "accident",
        "hospitals": hospitals
    })
    
    assert r.status_code == 200
    data = r.json()
    assert len(data["hospitals"]) == 2
    assert type(data["should_call_1990"]) is bool
