"""Migration ledger compatibility; no application or configured database is used."""
import hashlib
from unittest.mock import AsyncMock, MagicMock

import pytest

from database import run_migrations as runner


@pytest.fixture
def migration_setup(tmp_path, monkeypatch):
    old = tmp_path / '001_legacy.sql'
    old.write_text('CREATE TABLE legacy_example (id integer);\n')
    new = tmp_path / '002_current.sql'
    new.write_text('ALTER TABLE legacy_example ADD COLUMN label text;\n')
    monkeypatch.setattr(runner, 'migration_files', lambda: [old, new])
    connection = MagicMock()
    connection.fetchval = AsyncMock()
    connection.fetch = AsyncMock()
    connection.execute = AsyncMock()
    connection.close = AsyncMock()
    connection.transaction.return_value = MagicMock()
    connect = AsyncMock(return_value=connection)
    monkeypatch.setattr(runner.asyncpg, 'connect', connect)
    return connection, old, new


@pytest.mark.asyncio
async def test_check_reads_legacy_ledger_without_changes(migration_setup, capsys):
    connection, old, new = migration_setup
    connection.fetchval.side_effect = ['schema_migrations', False]
    connection.fetch.return_value = [{'version': old.name, 'checksum': None}]

    assert await runner.run_migrations('postgresql://test', check=True) == [new.name]

    connection.fetch.assert_awaited_once_with(
        'SELECT version, NULL::text AS checksum FROM public.schema_migrations')
    connection.execute.assert_not_awaited()
    connection.transaction.assert_not_called()
    connection.close.assert_awaited_once()
    output = capsys.readouterr().out
    assert 'Unverified legacy migrations' in output and old.name in output
    assert f'Pending: {new.name}' in output


@pytest.mark.asyncio
async def test_check_with_no_ledger_is_read_only(migration_setup):
    connection, old, new = migration_setup
    connection.fetchval.return_value = None

    assert await runner.run_migrations('postgresql://test', check=True) == [old.name, new.name]

    connection.fetchval.assert_awaited_once()
    connection.fetch.assert_not_awaited()
    connection.execute.assert_not_awaited()
    connection.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_apply_preserves_unverified_history_and_checksums_new_rows(migration_setup, capsys):
    connection, old, new = migration_setup
    connection.fetch.return_value = [{'version': old.name, 'checksum': None}]

    assert await runner.run_migrations('postgresql://test') == [new.name]

    statements = [call.args[0] for call in connection.execute.await_args_list]
    assert statements[0] == 'SELECT pg_advisory_lock($1)'
    assert 'ALTER TABLE public.schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT' in statements
    assert old.read_text() not in statements
    assert new.read_text() in statements
    assert not any(statement.startswith('UPDATE') for statement in statements)
    connection.execute.assert_any_await(
        'INSERT INTO public.schema_migrations(version,checksum) VALUES($1,$2)',
        new.name, hashlib.sha256(new.read_bytes()).hexdigest())
    assert statements[-1] == 'SELECT pg_advisory_unlock($1)'
    connection.transaction.assert_called_once()
    connection.close.assert_awaited_once()
    assert 'Unverified legacy migrations' in capsys.readouterr().out


@pytest.mark.asyncio
@pytest.mark.parametrize('check', [False, True])
@pytest.mark.parametrize('checksum', ['different-checksum', ''])
async def test_existing_non_null_checksum_must_match(migration_setup, check, checksum):
    connection, old, new = migration_setup
    connection.fetchval.side_effect = ['schema_migrations', True]
    connection.fetch.return_value = [
        {'version': old.name, 'checksum': None},
        {'version': new.name, 'checksum': checksum},
    ]

    with pytest.raises(RuntimeError, match=f'Previously applied migration changed: {new.name}'):
        await runner.run_migrations('postgresql://test', check=check)

    connection.transaction.assert_not_called()
    connection.close.assert_awaited_once()
    if check:
        connection.execute.assert_not_awaited()
    else:
        assert connection.execute.await_args_list[-1].args == (
            'SELECT pg_advisory_unlock($1)', runner.LOCK_ID)


@pytest.mark.asyncio
async def test_only_exact_known_filenames_mark_migrations_applied(migration_setup, capsys):
    connection, old, new = migration_setup
    connection.fetchval.side_effect = ['schema_migrations', False]
    connection.fetch.return_value = [
        {'version': old.stem, 'checksum': None},
        {'version': '002', 'checksum': None},
        {'version': '999_unrecognized.sql', 'checksum': None},
    ]

    assert await runner.run_migrations('postgresql://test', check=True) == [old.name, new.name]

    assert 'Unrecognized migration ledger versions' in capsys.readouterr().out
    connection.execute.assert_not_awaited()
    connection.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_connection_closes_if_lock_acquisition_fails(migration_setup):
    connection, _, _ = migration_setup
    connection.execute.side_effect = RuntimeError('lock unavailable')

    with pytest.raises(RuntimeError, match='lock unavailable'):
        await runner.run_migrations('postgresql://test')

    connection.execute.assert_awaited_once_with('SELECT pg_advisory_lock($1)', runner.LOCK_ID)
    connection.close.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize('check', [False, True])
async def test_connection_closes_if_reading_ledger_fails(migration_setup, check):
    connection, _, _ = migration_setup
    connection.fetchval.side_effect = ['schema_migrations', True]
    connection.fetch.side_effect = RuntimeError('ledger unreadable')

    with pytest.raises(RuntimeError, match='ledger unreadable'):
        await runner.run_migrations('postgresql://test', check=check)

    connection.close.assert_awaited_once()
    if check:
        connection.execute.assert_not_awaited()
    else:
        assert connection.execute.await_args_list[-1].args == (
            'SELECT pg_advisory_unlock($1)', runner.LOCK_ID)


@pytest.mark.asyncio
async def test_connection_closes_even_if_unlock_fails(migration_setup):
    connection, old, new = migration_setup
    connection.fetch.return_value = [
        {'version': path.name, 'checksum': hashlib.sha256(path.read_bytes()).hexdigest()}
        for path in (old, new)
    ]

    async def execute(statement, *args):
        if statement == 'SELECT pg_advisory_unlock($1)':
            raise RuntimeError('unlock failed')

    connection.execute.side_effect = execute

    with pytest.raises(RuntimeError, match='unlock failed'):
        await runner.run_migrations('postgresql://test')

    connection.close.assert_awaited_once()
