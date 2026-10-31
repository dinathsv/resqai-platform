from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from services import llm_service

@pytest.mark.asyncio
async def test_chatbot_english_critical(client, monkeypatch):

    async def mock_chat(*args, **kwargs):
        return 'Call 1990 immediately. Step 1: ...'

    monkeypatch.setattr('services.llm_service.chat', mock_chat)

    r = await client.post('/api/ai/first-aid-chat',
        json={"message": "My father is not breathing"})

    assert r.status_code == 200
    assert r.json()['show_1990'] == True
    assert r.json()['is_critical'] == True

@pytest.mark.asyncio
async def test_chatbot_fallback(client, monkeypatch):

    def mock_chat_raise(*args, **kwargs):
        raise Exception("LLM Error")

    monkeypatch.setattr('services.llm_service.chat', mock_chat_raise)

    r = await client.post('/api/ai/first-aid-chat',
        json={"message": "help"})

    assert r.status_code == 200
    assert '1990' in r.json()['reply']
    assert r.json()['is_critical'] is False
    assert r.json()['service_available'] is False


@pytest.mark.asyncio
async def test_chatbot_success_without_fallback(client, monkeypatch):
    async def mock_chat(*args, **kwargs):
        return '1. Generated guidance.'

    monkeypatch.setattr('services.llm_service.chat', mock_chat)
    r = await client.post('/api/ai/first-aid-chat',
        json={"message": "I need guidance", "language": "en"})
    assert r.status_code == 200
    assert r.json()['reply'] == '1. Generated guidance.'
    assert r.json()['is_critical'] is False
    assert r.json()['service_available'] is True


@pytest.mark.asyncio
async def test_chatbot_recovers_from_primary_503_using_backup(client, monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'test-key')
    monkeypatch.setenv('LLM_MODEL', 'primary')
    monkeypatch.setenv('LLM_FALLBACK_MODELS', 'backup')
    error = RuntimeError('model overloaded')
    error.code = 503
    generate = AsyncMock(side_effect=[error, SimpleNamespace(text='1. Generated guidance.')])
    sdk_client = SimpleNamespace(models=SimpleNamespace(generate_content=generate), aclose=AsyncMock())
    monkeypatch.setattr(llm_service.genai, 'Client', MagicMock(return_value=SimpleNamespace(aio=sdk_client)))
    sleep = AsyncMock()
    monkeypatch.setattr(llm_service.asyncio, 'sleep', sleep)

    response = await client.post('/api/ai/first-aid-chat',
        json={'message': 'Severe Burns guidance', 'language': 'en'})

    assert response.status_code == 200
    assert response.json()['reply'] == '1. Generated guidance.'
    assert response.json()['service_available'] is True
    assert [call.kwargs['model'] for call in generate.call_args_list] == ['primary', 'backup']
    sleep.assert_not_awaited()
    sdk_client.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_chatbot_all_models_unavailable_returns_emergency_fallback(client, monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'test-key')
    monkeypatch.setenv('LLM_MODEL', 'primary')
    monkeypatch.setenv('LLM_FALLBACK_MODELS', 'backup')
    error = RuntimeError('model overloaded')
    error.code = 503
    generate = AsyncMock(side_effect=error)
    sdk_client = SimpleNamespace(models=SimpleNamespace(generate_content=generate), aclose=AsyncMock())
    monkeypatch.setattr(llm_service.genai, 'Client', MagicMock(return_value=SimpleNamespace(aio=sdk_client)))
    monkeypatch.setattr(llm_service.asyncio, 'sleep', AsyncMock())

    response = await client.post('/api/ai/first-aid-chat',
        json={'message': 'I need general guidance', 'language': 'en'})

    assert response.status_code == 200
    body = response.json()
    assert body['service_available'] is False
    assert body['show_1990'] is True
    assert body['is_critical'] is False
    assert '1990' in body['reply']
    assert generate.await_count == 2 * llm_service.MAX_ATTEMPTS_PER_MODEL
    sdk_client.aclose.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize('message,language', [
    ('My father is not breathing', 'en'), ('ඔහු සිහිසුන්', 'si'), ('சுவாசிக்க முடியவில்லை', 'ta'),
])
async def test_critical_warning_does_not_wait_for_llm(client, monkeypatch, message, language):
    llm = AsyncMock(side_effect=AssertionError('Critical warning must not wait for the model'))
    monkeypatch.setattr(llm_service, 'chat', llm)
    response = await client.post('/api/ai/first-aid-chat', json={'message': message})
    assert response.status_code == 200
    assert response.json()['is_critical'] is True
    assert response.json()['language_detected'] == language
    llm.assert_not_awaited()
