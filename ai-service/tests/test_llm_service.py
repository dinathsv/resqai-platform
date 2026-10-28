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
    client.aclose = AsyncMock()
    factory = MagicMock(return_value=SimpleNamespace(aio=client))
    monkeypatch.setattr(llm_service.genai, 'Client', factory)

    assert await llm_service.chat('System instructions', 'User question', 512, 0.3) == 'Generated guidance'
    assert factory.call_args.kwargs['api_key'] == 'test-key'
    assert factory.call_args.kwargs['vertexai'] is False
    assert factory.call_args.kwargs['http_options'].retry_options.attempts == 1
    args = client.models.generate_content.call_args.kwargs
    assert args['model'] == 'test-model'
    assert args['contents'] == 'User question'
    assert args['config'].system_instruction == 'System instructions'
    assert args['config'].max_output_tokens == 512
    client.aclose.assert_awaited_once()

    client.models.generate_content.return_value = SimpleNamespace(text='')
    with pytest.raises(ValueError, match='empty response'):
        await llm_service.chat('System', 'Question')

    client.aclose.reset_mock()
    client.models.generate_content.side_effect = RuntimeError('upstream unavailable')
    with pytest.raises(RuntimeError, match='upstream unavailable'):
        await llm_service.chat('System', 'Question')
    client.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_missing_key_fails_before_network_call(monkeypatch):
    for name in ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'API_KEY', 'AI_API_KEY']:
        monkeypatch.delenv(name, raising=False)
    with pytest.raises(RuntimeError, match='GEMINI_API_KEY'):
        await llm_service.chat('System', 'Question')


@pytest.mark.asyncio
@pytest.mark.parametrize('code', [429, 503])
async def test_transient_failure_retries_and_recovers(monkeypatch, code):
    monkeypatch.setenv('GEMINI_API_KEY', 'test-key')
    monkeypatch.setenv('LLM_FALLBACK_MODELS', '')
    error = RuntimeError('busy')
    error.code = code
    generate = AsyncMock(side_effect=[error, SimpleNamespace(text='Recovered')])
    client = SimpleNamespace(models=SimpleNamespace(generate_content=generate), aclose=AsyncMock())
    monkeypatch.setattr(llm_service.genai, 'Client', MagicMock(return_value=SimpleNamespace(aio=client)))
    monkeypatch.setattr(llm_service.asyncio, 'sleep', AsyncMock())
    assert await llm_service.chat('System', 'Question') == 'Recovered'
    assert generate.await_count == 2
    client.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_exhausted_primary_uses_configured_fallback(monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'test-key')
    monkeypatch.setenv('LLM_MODEL', 'primary')
    monkeypatch.setenv('LLM_FALLBACK_MODELS', 'primary, backup')
    error = RuntimeError('busy')
    error.code = 503
    generate = AsyncMock(side_effect=[error, error, error, SimpleNamespace(text='Backup answer')])
    client = SimpleNamespace(models=SimpleNamespace(generate_content=generate), aclose=AsyncMock())
    monkeypatch.setattr(llm_service.genai, 'Client', MagicMock(return_value=SimpleNamespace(aio=client)))
    monkeypatch.setattr(llm_service.asyncio, 'sleep', AsyncMock())
    assert await llm_service.chat('System', 'Question') == 'Backup answer'
    assert [call.kwargs['model'] for call in generate.call_args_list] == ['primary'] * 3 + ['backup']
    client.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_permanent_error_is_not_retried(monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'test-key')
    error = RuntimeError('invalid key')
    error.code = 403
    generate = AsyncMock(side_effect=error)
    client = SimpleNamespace(models=SimpleNamespace(generate_content=generate), aclose=AsyncMock())
    monkeypatch.setattr(llm_service.genai, 'Client', MagicMock(return_value=SimpleNamespace(aio=client)))
    with pytest.raises(RuntimeError, match='invalid key'):
        await llm_service.chat('System', 'Question')
    generate.assert_awaited_once()
    client.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_exhausted_retries_close_client(monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'test-key')
    monkeypatch.setenv('LLM_FALLBACK_MODELS', '')
    error = RuntimeError('busy')
    error.code = 503
    generate = AsyncMock(side_effect=error)
    client = SimpleNamespace(models=SimpleNamespace(generate_content=generate), aclose=AsyncMock())
    monkeypatch.setattr(llm_service.genai, 'Client', MagicMock(return_value=SimpleNamespace(aio=client)))
    monkeypatch.setattr(llm_service.asyncio, 'sleep', AsyncMock())
    with pytest.raises(RuntimeError, match='busy'):
        await llm_service.chat('System', 'Question')
    assert generate.await_count == 3
    client.aclose.assert_awaited_once()
