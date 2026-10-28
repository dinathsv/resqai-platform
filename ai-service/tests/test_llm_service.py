from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from services import llm_service


@pytest.mark.asyncio
async def test_api_key_request_and_client_cleanup(monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'test-key')
    monkeypatch.setenv('LLM_MODEL', 'test-model')
    client = SimpleNamespace(models=SimpleNamespace(
        generate_content=AsyncMock(return_value=SimpleNamespace(text='Generated guidance')),
    ))
    context = MagicMock()
    context.__aenter__ = AsyncMock(return_value=client)
    context.__aexit__ = AsyncMock(return_value=None)
    factory = MagicMock(return_value=SimpleNamespace(aio=context))
    monkeypatch.setattr(llm_service.genai, 'Client', factory)

    assert await llm_service.chat('System instructions', 'User question', 512, 0.3) == 'Generated guidance'
    factory.assert_called_once_with(api_key='test-key', vertexai=False)
    args = client.models.generate_content.call_args.kwargs
    assert args['model'] == 'test-model'
    assert args['contents'] == 'User question'
    assert args['config'].system_instruction == 'System instructions'
    assert args['config'].max_output_tokens == 512
    context.__aexit__.assert_awaited_once()

    client.models.generate_content.return_value = SimpleNamespace(text='')
    with pytest.raises(ValueError, match='empty response'):
        await llm_service.chat('System', 'Question')


@pytest.mark.asyncio
async def test_missing_key_fails_before_network_call(monkeypatch):
    for name in ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'API_KEY', 'AI_API_KEY']:
        monkeypatch.delenv(name, raising=False)
    with pytest.raises(RuntimeError, match='GEMINI_API_KEY'):
        await llm_service.chat('System', 'Question')
