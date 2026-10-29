"""Run against a local PostgreSQL instance; all fixtures are temporary tables."""
import os
import uuid
from urllib.parse import urlparse

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.routers.alerts import acknowledge_request_alert


@pytest.mark.asyncio
@pytest.mark.parametrize('kind', ['help_rescue', 'donation'])
async def test_acknowledgement_without_database_defaults(kind):
    url = os.environ.get('TEST_POSTGRES_URL')
    if not url:
        pytest.skip('Set TEST_POSTGRES_URL to a local disposable PostgreSQL database')
    assert urlparse(url).hostname in {'localhost', '127.0.0.1'}
    engine = create_async_engine(url.replace('postgresql://', 'postgresql+asyncpg://', 1), pool_size=1)
    try:
        async with engine.connect() as connection:
            # Match ORM-created databases: Python defaults are absent from SQL DDL.
            for ddl in [
                'CREATE TEMP TABLE users (user_id uuid PRIMARY KEY, is_active boolean)',
                '''CREATE TEMP TABLE help_requests (request_id uuid PRIMARY KEY, user_id uuid,
                   status text, admin_status text, emergency_type text, original_message text,
                   updated_at timestamptz DEFAULT now())''',
                '''CREATE TEMP TABLE relief_missions (mission_id uuid PRIMARY KEY, admin_id uuid,
                   title text NOT NULL, description text, origin_request_id uuid, mission_type text,
                   status text NOT NULL, target numeric NOT NULL, funds_collected numeric NOT NULL,
                   created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())''',
                '''CREATE TEMP TABLE volunteer_assignments (assignment_id uuid PRIMARY KEY,
                   user_id uuid NOT NULL, mission_id uuid NOT NULL, status text NOT NULL,
                   hours_logged integer NOT NULL)''',
                '''CREATE TEMP TABLE request_status_history (request_id uuid, old_status text, new_status text)''',
            ]:
                await connection.execute(text(ddl))
            user_id, request_id = uuid.uuid4(), uuid.uuid4()
            await connection.execute(text('INSERT INTO users VALUES (:id, true)'), {'id': user_id})
            await connection.execute(text('''INSERT INTO help_requests
                (request_id, user_id, status, admin_status, emergency_type, original_message)
                VALUES (:id, :owner, 'pending', 'pending', :kind, 'Please help')'''),
                {'id': request_id, 'owner': uuid.uuid4(), 'kind': kind})
            await connection.commit()
            async with AsyncSession(bind=connection) as db:
                first = await acknowledge_request_alert(request_id, {'sub': str(user_id)}, db)
                retry = await acknowledge_request_alert(request_id, {'sub': str(user_id)}, db)
                assert first == retry and first['acknowledged']
                mission = (await db.execute(text('SELECT * FROM relief_missions'))).mappings().one()
                assert mission['target'] == mission['funds_collected'] == 0
                assert mission['mission_type'] == ('donation' if kind == 'donation' else 'help')
                assignment = (await db.execute(text('SELECT * FROM volunteer_assignments'))).mappings().one()
                assert assignment['assignment_id'] and assignment['hours_logged'] == 0
                assert assignment['status'] == 'accepted'
                assert (await db.execute(text('SELECT admin_status FROM help_requests'))).scalar_one() == 'in_progress'
                assert (await db.execute(text('SELECT count(*) FROM request_status_history'))).scalar_one() == 1
    finally:
        await engine.dispose()
