"""Server UUID defaults for legacy tables used by Node writes."""
import os
from pathlib import Path
from urllib.parse import urlparse
import uuid

import asyncpg
import pytest


@pytest.mark.asyncio
async def test_legacy_uuid_defaults_preserve_rows_and_existing_defaults():
    url = os.environ.get('TEST_ENUM_POSTGRES_URL')
    if not url:
        pytest.skip('Set TEST_ENUM_POSTGRES_URL to an empty disposable localhost resqai_enum_test database')
    parsed = urlparse(url)
    assert parsed.hostname in {'localhost', '127.0.0.1'} and parsed.path == '/resqai_enum_test'
    connection = await asyncpg.connect(url)
    transaction = connection.transaction()
    await transaction.start()
    try:
        assert await connection.fetchval("SELECT to_regclass('public.audit_logs')") is None
        assert await connection.fetchval("SELECT to_regclass('public.agency_chat_messages')") is None
        await connection.execute('CREATE TABLE public.audit_logs(log_id uuid PRIMARY KEY, action text NOT NULL)')
        await connection.execute("CREATE TABLE public.agency_chat_messages(message_id uuid PRIMARY KEY DEFAULT '00000000-0000-4000-8000-000000000001'::uuid, message_text text NOT NULL)")
        existing_id = uuid.uuid4()
        await connection.execute("INSERT INTO public.audit_logs(log_id,action) VALUES($1,'preserved')", existing_id)
        original_default = await connection.fetchval("SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='agency_chat_messages' AND column_name='message_id'")
        migration = (Path(__file__).resolve().parents[2] / 'backend/migrations/014_backend_uuid_defaults.sql').read_text()
        for _ in range(2):
            await connection.execute(migration)
        generated = await connection.fetchval("INSERT INTO public.audit_logs(action) VALUES('new event') RETURNING log_id")
        assert isinstance(generated, uuid.UUID) and generated != existing_id
        assert await connection.fetchval('SELECT action FROM public.audit_logs WHERE log_id=$1', existing_id) == 'preserved'
        assert await connection.fetchval("SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='agency_chat_messages' AND column_name='message_id'") == original_default
        message_id = await connection.fetchval("INSERT INTO public.agency_chat_messages(message_text) VALUES('new message') RETURNING message_id")
        assert str(message_id) == '00000000-0000-4000-8000-000000000001'
    finally:
        await transaction.rollback()
        await connection.close()
