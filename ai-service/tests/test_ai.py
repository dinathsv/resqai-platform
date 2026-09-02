import pytest

@pytest.mark.asyncio
async def test_chatbot_english_critical(client, monkeypatch):

    monkeypatch.setattr('services.llm_service.chat',
        lambda *args, **kwargs: 'Call 1990 immediately. Step 1: ...')

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
    assert r.json()['is_critical'] == True
