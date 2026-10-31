"""Focused migration checks on an empty, disposable localhost database.

Set TEST_ENUM_POSTGRES_URL to a database named resqai_enum_test. Every fixture
rolls back its own tables, types, and data; no application database is contacted.
"""
import os
from pathlib import Path
from urllib.parse import urlparse

import asyncpg
import pytest
import pytest_asyncio


MIGRATION = (Path(__file__).resolve().parents[2] / 'backend/migrations/013_legacy_status_enums.sql').read_text()
TARGETS = {
    'relief_missions': ('mission_status', ['planning', 'active', 'paused', 'completed', 'cancelled']),
    'volunteer_assignments': ('assignment_status', ['pending', 'accepted', 'active', 'completed', 'withdrawn']),
    'donations': ('donation_status', ['pending', 'completed', 'failed', 'refunded']),
}


@pytest_asyncio.fixture
async def legacy_database():
    url = os.environ.get('TEST_ENUM_POSTGRES_URL')
    if not url:
        pytest.skip('Set TEST_ENUM_POSTGRES_URL to an empty localhost resqai_enum_test database')
    parsed = urlparse(url)
    assert parsed.hostname in {'localhost', '127.0.0.1'} and parsed.path == '/resqai_enum_test'
    connection = await asyncpg.connect(url)
    transaction = connection.transaction()
    await transaction.start()
    try:
        for table, (enum_name, _) in TARGETS.items():
            assert await connection.fetchval('SELECT pg_catalog.to_regclass($1)', f'public.{table}') is None, 'Use an empty test database'
            assert await connection.fetchval('SELECT pg_catalog.to_regtype($1)', f'public.{enum_name}') is None, 'Use an empty test database'
            await connection.execute(f'CREATE TABLE public.{table} (id INTEGER PRIMARY KEY, status VARCHAR(30) NOT NULL, payload TEXT)')
        yield connection
    finally:
        await transaction.rollback()
        await connection.close()


async def apply_migration(connection):
    # A savepoint also lets failure tests inspect the untouched legacy fixtures.
    async with connection.transaction():
        await connection.execute(MIGRATION)


async def column_metadata(connection, table):
    return await connection.fetchrow('''
        SELECT t.typname, n.nspname, a.attnotnull,
               pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS default_expression
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = pg_catalog.to_regclass($1) AND a.attname = 'status'
    ''', f'public.{table}')


async def enum_labels(connection, enum_name):
    return await connection.fetchval('''
        SELECT pg_catalog.array_agg(e.enumlabel::TEXT ORDER BY e.enumsortorder)
        FROM pg_catalog.pg_enum e
        WHERE e.enumtypid = pg_catalog.to_regtype($1)
    ''', f'public.{enum_name}')


@pytest.mark.asyncio
@pytest.mark.parametrize('source_type', ['VARCHAR(30)', 'TEXT'])
async def test_converts_all_valid_rows_preserving_data_and_absent_defaults(legacy_database, source_type):
    connection = legacy_database
    for table, (_, labels) in TARGETS.items():
        await connection.execute(f'ALTER TABLE public.{table} ALTER COLUMN status TYPE {source_type}')
        await connection.executemany(f'INSERT INTO public.{table} VALUES ($1, $2, $3)',
                                     [(index, label, f'preserve-{label}') for index, label in enumerate(labels)])
    await apply_migration(connection)
    await apply_migration(connection)  # Canonical enum columns are already compatible.
    for table, (enum_name, labels) in TARGETS.items():
        metadata = await column_metadata(connection, table)
        assert tuple(metadata.values()) == (enum_name, 'public', True, None)
        assert await enum_labels(connection, enum_name) == labels
        assert [tuple(row.values()) for row in await connection.fetch(f'SELECT id, status::TEXT, payload FROM public.{table} ORDER BY id')] == [
            (index, label, f'preserve-{label}') for index, label in enumerate(labels)
        ]


@pytest.mark.asyncio
async def test_preserves_valid_existing_defaults(legacy_database):
    connection = legacy_database
    defaults = {'relief_missions': 'paused', 'volunteer_assignments': 'withdrawn', 'donations': 'refunded'}
    for table, value in defaults.items():
        await connection.execute(f"ALTER TABLE public.{table} ALTER COLUMN status SET DEFAULT '{value}'")
    await apply_migration(connection)
    for table, value in defaults.items():
        assert await connection.fetchval(f'INSERT INTO public.{table} (id) VALUES (1) RETURNING status::TEXT') == value


@pytest.mark.asyncio
async def test_preserves_null_values_and_null_default(legacy_database):
    connection = legacy_database
    await connection.execute('ALTER TABLE public.donations ALTER COLUMN status DROP NOT NULL, ALTER COLUMN status SET DEFAULT NULL')
    await connection.execute('INSERT INTO public.donations (id) VALUES (1)')
    await apply_migration(connection)
    assert await connection.fetchval('SELECT status FROM public.donations WHERE id=1') is None
    assert await connection.fetchval('INSERT INTO public.donations (id) VALUES (2) RETURNING status') is None
    assert not (await column_metadata(connection, 'donations'))['attnotnull']


@pytest.mark.asyncio
async def test_rejects_unknown_values_without_partial_changes(legacy_database):
    connection = legacy_database
    await connection.execute("INSERT INTO public.donations VALUES (1, 'legacy_unknown', 'retain this row')")
    with pytest.raises(asyncpg.RaiseError, match='unsupported status values'):
        await apply_migration(connection)
    for table, (enum_name, _) in TARGETS.items():
        assert (await column_metadata(connection, table))['typname'] == 'varchar'
        assert await connection.fetchval('SELECT pg_catalog.to_regtype($1)', f'public.{enum_name}') is None
    assert tuple((await connection.fetchrow('SELECT * FROM public.donations')).values()) == (1, 'legacy_unknown', 'retain this row')


@pytest.mark.asyncio
@pytest.mark.parametrize('default_expression', ["'unknown'", "lower('PENDING')"])
async def test_rejects_invalid_or_dynamic_defaults_before_ddl(legacy_database, default_expression):
    connection = legacy_database
    await connection.execute(f'ALTER TABLE public.donations ALTER COLUMN status SET DEFAULT {default_expression}')
    before = (await column_metadata(connection, 'donations'))['default_expression']
    with pytest.raises(asyncpg.RaiseError, match='unsupported or invalid default'):
        await apply_migration(connection)
    for table, (enum_name, _) in TARGETS.items():
        assert (await column_metadata(connection, table))['typname'] == 'varchar'
        assert await connection.fetchval('SELECT pg_catalog.to_regtype($1)', f'public.{enum_name}') is None
    assert (await column_metadata(connection, 'donations'))['default_expression'] == before


@pytest.mark.asyncio
@pytest.mark.parametrize('type_ddl', [
    "CREATE TYPE public.mission_status AS ENUM ('planning', 'active')",
    'CREATE DOMAIN public.mission_status AS TEXT',
])
async def test_rejects_incompatible_named_types(legacy_database, type_ddl):
    connection = legacy_database
    await connection.execute(type_ddl)
    with pytest.raises(asyncpg.RaiseError, match='expected an enum containing all required lifecycle labels'):
        await apply_migration(connection)
    assert (await column_metadata(connection, 'relief_missions'))['typname'] == 'varchar'
    assert await connection.fetchval("SELECT pg_catalog.to_regtype('public.assignment_status')") is None


@pytest.mark.asyncio
async def test_preserves_existing_enum_supersets_and_their_valid_values(legacy_database):
    connection = legacy_database
    labels = TARGETS['relief_missions'][1] + ['archived']
    await connection.execute("CREATE TYPE public.mission_status AS ENUM ('planning', 'active', 'paused', 'completed', 'cancelled', 'archived')")
    await connection.execute("INSERT INTO public.relief_missions VALUES (1, 'archived', 'historical mission')")
    await apply_migration(connection)
    assert await enum_labels(connection, 'mission_status') == labels
    assert await connection.fetchval('SELECT status::TEXT FROM public.relief_missions') == 'archived'


@pytest.mark.asyncio
async def test_leaves_matching_enum_columns_and_defaults_intact(legacy_database):
    connection = legacy_database
    await connection.execute("CREATE TYPE public.mission_status AS ENUM ('planning', 'active', 'paused', 'completed', 'cancelled')")
    await connection.execute('ALTER TABLE public.relief_missions ALTER COLUMN status TYPE public.mission_status USING status::TEXT::public.mission_status')
    await connection.execute("ALTER TABLE public.relief_missions ALTER COLUMN status SET DEFAULT 'planning'")
    before = await column_metadata(connection, 'relief_missions')
    await apply_migration(connection)
    assert await column_metadata(connection, 'relief_missions') == before


@pytest.mark.asyncio
async def test_rejects_other_column_types(legacy_database):
    connection = legacy_database
    await connection.execute('ALTER TABLE public.donations ALTER COLUMN status TYPE INTEGER USING NULL')
    with pytest.raises(asyncpg.RaiseError, match='expected VARCHAR, TEXT, or the matching public enum'):
        await apply_migration(connection)
    assert (await column_metadata(connection, 'donations'))['typname'] == 'int4'
    assert await connection.fetchval("SELECT pg_catalog.to_regtype('public.mission_status')") is None
