import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from google.genai import errors

from services import llm_service


@pytest.fixture(autouse=True)
def isolated_model_configuration(monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'test-key')
    monkeypatch.setenv('LLM_MODEL', 'primary')
    monkeypatch.setenv('LLM_FALLBACK_MODELS', 'backup')
    monkeypatch.delenv('LLM_MODEL_TIMEOUT_SECONDS', raising=False)
    monkeypatch.delenv('LLM_REQUEST_TIMEOUT_SECONDS', raising=False)


@pytest.fixture
def sdk(monkeypatch):
    generate = AsyncMock(return_value=SimpleNamespace(text='Generated guidance'))
    client = SimpleNamespace(
        models=SimpleNamespace(generate_content=generate),
        aclose=AsyncMock(),
    )
    factory = MagicMock(return_value=SimpleNamespace(aio=client))
    monkeypatch.setattr(llm_service.genai, 'Client', factory)
    return SimpleNamespace(client=client, generate=generate, factory=factory)


def upstream_error(code):
    error = RuntimeError(f'upstream status {code}')
    error.code = code
    return error


def called_models(sdk):
    return [call.kwargs['model'] for call in sdk.generate.call_args_list]


@pytest.mark.parametrize('configured', [None, '', '   '])
def test_missing_or_blank_configuration_has_default_fallback(monkeypatch, configured):
    for name in ('LLM_MODEL', 'LLM_FALLBACK_MODELS'):
        if configured is None:
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, configured)
    assert llm_service.get_model() == llm_service.DEFAULT_MODEL
    assert llm_service.get_models() == [
        llm_service.DEFAULT_MODEL, *llm_service.DEFAULT_FALLBACK_MODELS,
    ]


def test_model_names_are_normalized_and_deduplicated(monkeypatch):
    monkeypatch.setenv('LLM_MODEL', ' models/primary ')
    monkeypatch.setenv('LLM_FALLBACK_MODELS', 'primary, models/backup, , backup, second')
    assert llm_service.get_model() == 'primary'
    assert llm_service.get_models() == ['primary', 'backup', 'second']


@pytest.mark.parametrize('configured', [None, '', '   '])
def test_missing_or_blank_timeout_configuration_uses_defaults(monkeypatch, configured):
    for name in ('LLM_MODEL_TIMEOUT_SECONDS', 'LLM_REQUEST_TIMEOUT_SECONDS'):
        if configured is not None:
            monkeypatch.setenv(name, configured)
    assert llm_service.get_timeouts() == (
        llm_service.MODEL_TIMEOUT_SECONDS, llm_service.REQUEST_TIMEOUT_SECONDS,
    )


@pytest.mark.asyncio
async def test_configured_model_timeout_is_passed_to_sdk(monkeypatch, sdk):
    monkeypatch.setenv('LLM_MODEL_TIMEOUT_SECONDS', ' 2.5 ')
    monkeypatch.setenv('LLM_REQUEST_TIMEOUT_SECONDS', '7.5')
    assert llm_service.get_timeouts() == (2.5, 7.5)
    assert await llm_service.chat('System', 'Question') == 'Generated guidance'
    assert sdk.factory.call_args.kwargs['http_options'].timeout == 2500
    sdk.client.aclose.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize('name', ['LLM_MODEL_TIMEOUT_SECONDS', 'LLM_REQUEST_TIMEOUT_SECONDS'])
@pytest.mark.parametrize('invalid', ['0', '-1', 'nan', 'inf', '-inf', 'invalid'])
async def test_invalid_timeout_configuration_fails_before_network(monkeypatch, sdk, name, invalid):
    monkeypatch.setenv(name, invalid)
    with pytest.raises(ValueError):
        await llm_service.chat('System', 'Question')
    sdk.factory.assert_not_called()


@pytest.mark.asyncio
async def test_api_key_request_and_client_cleanup(sdk):
    assert await llm_service.chat('System instructions', 'User question', 512, 0.3) == 'Generated guidance'
    assert sdk.factory.call_args.kwargs['api_key'] == 'test-key'
    assert sdk.factory.call_args.kwargs['vertexai'] is False
    assert sdk.factory.call_args.kwargs['http_options'].retry_options.attempts == 1
    args = sdk.generate.call_args.kwargs
    assert args['model'] == 'primary'
    assert args['contents'] == 'User question'
    assert args['config'].system_instruction == 'System instructions'
    assert args['config'].max_output_tokens == 512
    assert args['config'].temperature == 0.3
    assert args['config'].automatic_function_calling.disable is True
    sdk.client.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_empty_response_does_not_retry(sdk):
    sdk.generate.return_value = SimpleNamespace(text='  ')
    with pytest.raises(ValueError, match='empty response'):
        await llm_service.chat('System', 'Question')
    sdk.generate.assert_awaited_once()
    sdk.client.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_unexpected_error_does_not_retry(sdk):
    sdk.generate.side_effect = RuntimeError('unexpected failure')
    with pytest.raises(RuntimeError, match='unexpected failure'):
        await llm_service.chat('System', 'Question')
    sdk.generate.assert_awaited_once()
    sdk.client.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_missing_key_fails_before_network_call(monkeypatch, sdk):
    for name in ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'API_KEY', 'AI_API_KEY']:
        monkeypatch.delenv(name, raising=False)
    with pytest.raises(RuntimeError, match='GEMINI_API_KEY'):
        await llm_service.chat('System', 'Question')
    sdk.factory.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize('code', [408, 429, 500, 502, 503, 504])
async def test_transient_primary_failure_immediately_uses_backup(monkeypatch, sdk, code):
    sdk.generate.side_effect = [upstream_error(code), SimpleNamespace(text='Backup answer')]
    sleep = AsyncMock()
    monkeypatch.setattr(llm_service.asyncio, 'sleep', sleep)
    assert await llm_service.chat('System', 'Question') == 'Backup answer'
    assert called_models(sdk) == ['primary', 'backup']
    sleep.assert_not_awaited()
    sdk.client.aclose.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize('error', [httpx.ConnectError('unreachable'), httpx.ReadTimeout('slow')])
async def test_transport_error_uses_backup(monkeypatch, sdk, error):
    sdk.generate.side_effect = [error, SimpleNamespace(text='Backup answer')]
    monkeypatch.setattr(llm_service.asyncio, 'sleep', AsyncMock())
    assert await llm_service.chat('System', 'Question') == 'Backup answer'
    assert called_models(sdk) == ['primary', 'backup']
    sdk.client.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_single_model_retries_and_recovers(monkeypatch, sdk):
    monkeypatch.setenv('LLM_FALLBACK_MODELS', 'primary')
    sdk.generate.side_effect = [upstream_error(503), SimpleNamespace(text='Recovered')]
    sleep = AsyncMock()
    monkeypatch.setattr(llm_service.asyncio, 'sleep', sleep)
    assert await llm_service.chat('System', 'Question') == 'Recovered'
    assert called_models(sdk) == ['primary', 'primary']
    sleep.assert_awaited_once()
    sdk.client.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_all_models_are_tried_before_retrying_primary(monkeypatch, sdk):
    sdk.generate.side_effect = [
        upstream_error(503), upstream_error(503), SimpleNamespace(text='Recovered'),
    ]
    sleep = AsyncMock()
    monkeypatch.setattr(llm_service.asyncio, 'sleep', sleep)
    assert await llm_service.chat('System', 'Question') == 'Recovered'
    assert called_models(sdk) == ['primary', 'backup', 'primary']
    sleep.assert_awaited_once()


@pytest.mark.asyncio
async def test_rate_limited_primary_is_not_retried_when_backup_is_temporary_unavailable(monkeypatch, sdk):
    sdk.generate.side_effect = [
        upstream_error(429), upstream_error(503), SimpleNamespace(text='Backup answer'),
    ]
    sleep = AsyncMock()
    monkeypatch.setattr(llm_service.asyncio, 'sleep', sleep)
    assert await llm_service.chat('System', 'Question') == 'Backup answer'
    assert called_models(sdk) == ['primary', 'backup', 'backup']
    sleep.assert_awaited_once()
    sdk.client.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_all_rate_limited_models_fail_without_retries_or_sleep(monkeypatch, sdk):
    sdk.generate.side_effect = upstream_error(429)
    sleep = AsyncMock()
    monkeypatch.setattr(llm_service.asyncio, 'sleep', sleep)
    with pytest.raises(RuntimeError, match='upstream status 429'):
        await llm_service.chat('System', 'Question')
    assert called_models(sdk) == ['primary', 'backup']
    sleep.assert_not_awaited()
    sdk.client.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_rate_limit_log_extracts_structured_metadata_without_error_body(monkeypatch, sdk, caplog):
    error = errors.ClientError(429, {'error': {
        'code': 429,
        'status': 'RESOURCE_EXHAUSTED',
        'message': 'private-error-body-do-not-log',
        'details': [
            {
                '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
                'violations': [{
                    'quotaId': 'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
                    'quotaValue': '0',
                    'description': 'private-quota-description-do-not-log',
                }],
            },
            {
                '@type': 'type.googleapis.com/google.rpc.RetryInfo',
                'retryDelay': '29.5s',
            },
        ],
    }})
    sdk.generate.side_effect = [error, SimpleNamespace(text='Backup answer')]
    sleep = AsyncMock()
    monkeypatch.setattr(llm_service.asyncio, 'sleep', sleep)

    with caplog.at_level('WARNING', logger='resqai.llm'):
        assert await llm_service.chat('System', 'Question') == 'Backup answer'

    assert 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' in caplog.text
    assert '29.5' in caplog.text
    assert 'private-error-body-do-not-log' not in caplog.text
    assert 'private-quota-description-do-not-log' not in caplog.text
    assert called_models(sdk) == ['primary', 'backup']
    sleep.assert_not_awaited()
    sdk.client.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_unavailable_model_is_not_retried_in_later_rounds(monkeypatch, sdk):
    sdk.generate.side_effect = [
        upstream_error(404), upstream_error(503), SimpleNamespace(text='Backup answer'),
    ]
    sleep = AsyncMock()
    monkeypatch.setattr(llm_service.asyncio, 'sleep', sleep)
    assert await llm_service.chat('System', 'Question') == 'Backup answer'
    assert called_models(sdk) == ['primary', 'backup', 'backup']
    sleep.assert_awaited_once()
    sdk.client.aclose.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize('code', [400, 401, 403])
async def test_permanent_error_is_not_retried(sdk, code):
    sdk.generate.side_effect = upstream_error(code)
    with pytest.raises(RuntimeError, match=f'upstream status {code}'):
        await llm_service.chat('System', 'Question')
    sdk.generate.assert_awaited_once()
    sdk.client.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_exhausted_retries_close_client(monkeypatch, sdk):
    sdk.generate.side_effect = upstream_error(503)
    sleep = AsyncMock()
    monkeypatch.setattr(llm_service.asyncio, 'sleep', sleep)
    with pytest.raises(RuntimeError, match='upstream status 503'):
        await llm_service.chat('System', 'Question')
    assert called_models(sdk) == ['primary', 'backup'] * llm_service.MAX_ATTEMPTS_PER_MODEL
    assert sleep.await_count == llm_service.MAX_ATTEMPTS_PER_MODEL - 1
    sdk.client.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_model_deadline_cancels_slow_primary_and_uses_backup(monkeypatch, sdk):
    monkeypatch.setattr(llm_service, 'MODEL_TIMEOUT_SECONDS', 0.01)
    monkeypatch.setattr(llm_service, 'REQUEST_TIMEOUT_SECONDS', 1)
    cancelled = asyncio.Event()

    async def generate(**kwargs):
        if kwargs['model'] == 'primary':
            try:
                await asyncio.Event().wait()
            finally:
                cancelled.set()
        return SimpleNamespace(text='Backup answer')

    sdk.generate.side_effect = generate
    assert await llm_service.chat('System', 'Question') == 'Backup answer'
    assert called_models(sdk) == ['primary', 'backup']
    assert cancelled.is_set()
    sdk.client.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_longer_configured_timeout_allows_slow_backup_to_complete(monkeypatch, sdk):
    monkeypatch.setattr(llm_service, 'MODEL_TIMEOUT_SECONDS', 0.005)
    monkeypatch.setattr(llm_service, 'REQUEST_TIMEOUT_SECONDS', 0.01)
    monkeypatch.setenv('LLM_MODEL_TIMEOUT_SECONDS', '0.2')
    monkeypatch.setenv('LLM_REQUEST_TIMEOUT_SECONDS', '0.5')

    async def generate(**kwargs):
        if kwargs['model'] == 'primary':
            raise upstream_error(429)
        await asyncio.sleep(0.02)
        return SimpleNamespace(text='Slow backup answer')

    sdk.generate.side_effect = generate
    assert await llm_service.chat('System', 'Question') == 'Slow backup answer'
    assert called_models(sdk) == ['primary', 'backup']
    assert sdk.factory.call_args.kwargs['http_options'].timeout == 200
    sdk.client.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_overall_deadline_cancels_request_and_closes_client(monkeypatch, sdk):
    monkeypatch.setattr(llm_service, 'MODEL_TIMEOUT_SECONDS', 1)
    monkeypatch.setattr(llm_service, 'REQUEST_TIMEOUT_SECONDS', 0.01)
    cancelled = asyncio.Event()

    async def generate(**kwargs):
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()

    sdk.generate.side_effect = generate
    with pytest.raises(asyncio.TimeoutError):
        await llm_service.chat('System', 'Question')
    sdk.generate.assert_awaited_once()
    assert cancelled.is_set()
    sdk.client.aclose.assert_awaited_once()
