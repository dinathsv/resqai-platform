"""Opt-in runner test against a dedicated disposable localhost database.

Set MIGRATION_TEST_POSTGRES_URL to a database named resqai_migration_test.
Only this test's ledger and example table are created, then removed.
"""
import asyncio
import hashlib
import os
from urllib.parse import urlparse

import asyncpg
import pytest

from database import run_migrations as runner


@pytest.mark.asyncio
async def test_legacy_ledger_check_apply_concurrency_and_checksum(tmp_path, monkeypatch, capsys):
    url = os.environ.get('MIGRATION_TEST_POSTGRES_URL')
    if not url:
        pytest.skip('Set MIGRATION_TEST_POSTGRES_URL to a disposable localhost resqai_migration_test database')
    parsed = urlparse(url)
    assert parsed.hostname in {'localhost', '127.0.0.1'} and parsed.path == '/resqai_migration_test'
    old = tmp_path / '001_legacy.sql'
    old.write_text('CREATE TABLE public.migration_runner_example (id integer PRIMARY KEY);\n')
    new = tmp_path / '002_current.sql'
    new.write_text('ALTER TABLE public.migration_runner_example ADD COLUMN label text;\n')
    monkeypatch.setattr(runner, 'migration_files', lambda: [old, new])

    connection = await asyncpg.connect(url)
    initialized = False
    try:
        assert await connection.fetchval("SELECT to_regclass('public.schema_migrations')") is None, 'Use a NEW test database'
        assert await connection.fetchval("SELECT to_regclass('public.migration_runner_example')") is None
        async with connection.transaction():
            await connection.execute('''CREATE TABLE public.schema_migrations (
                version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())''')
            await connection.execute(old.read_text())
            await connection.execute('INSERT INTO public.migration_runner_example(id) VALUES (42)')
            await connection.execute('''INSERT INTO public.schema_migrations(version, applied_at)
                VALUES ($1, '2025-01-02T03:04:05Z'::timestamptz)''', old.name)
        initialized = True
        original_applied_at = await connection.fetchval('SELECT applied_at FROM public.schema_migrations')

        assert await runner.run_migrations(url, check=True) == [new.name]
        assert not await connection.fetchval('''SELECT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
            AND table_name = 'schema_migrations' AND column_name = 'checksum')''')
        assert await connection.fetchval('SELECT applied_at FROM public.schema_migrations') == original_applied_at
        assert 'Unverified legacy migrations' in capsys.readouterr().out

        # Separate runner connections must serialize DDL and ledger insertion.
        applied = await asyncio.gather(runner.run_migrations(url), runner.run_migrations(url))
        assert sorted(applied, key=len) == [[], [new.name]]
        rows = await connection.fetch('SELECT version, checksum, applied_at FROM public.schema_migrations ORDER BY version')
        assert len(rows) == 2
        assert rows[0]['version'] == old.name and rows[0]['checksum'] is None
        assert rows[0]['applied_at'] == original_applied_at
        assert rows[1]['version'] == new.name
        assert rows[1]['checksum'] == hashlib.sha256(new.read_bytes()).hexdigest()
        assert await connection.fetchval('SELECT id FROM public.migration_runner_example') == 42
        await connection.execute("UPDATE public.migration_runner_example SET label = 'preserved'")
        assert await runner.run_migrations(url, check=True) == []
        assert await runner.run_migrations(url) == []

        new.write_text(new.read_text() + '-- changed after application\n')
        for check in (True, False):
            with pytest.raises(RuntimeError, match='Previously applied migration changed'):
                await runner.run_migrations(url, check=check)
        assert await connection.fetchval('SELECT label FROM public.migration_runner_example') == 'preserved'
        # The failing apply released its session lock on the same database.
        assert await connection.fetchval('SELECT pg_try_advisory_lock($1)', runner.LOCK_ID)
        assert await connection.fetchval('SELECT pg_advisory_unlock($1)', runner.LOCK_ID)
    finally:
        try:
            if initialized:
                await connection.execute('DROP TABLE public.migration_runner_example, public.schema_migrations')
        finally:
            await connection.close()
