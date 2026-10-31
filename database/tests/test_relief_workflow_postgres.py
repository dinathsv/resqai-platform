"""Cross-service verification with real PostgreSQL constraints and row locks.

Requires a migrated disposable localhost database named resqai_test.
No SMS, AI, production service or application database is contacted.
"""
import asyncio
import os
from pathlib import Path
import subprocess
from datetime import timedelta
from unittest.mock import AsyncMock
from urllib.parse import urlparse
import uuid

import asyncpg
import fakeredis.aioredis
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker


@pytest.mark.asyncio
async def test_verified_goods_cross_service_and_concurrent_pledges(monkeypatch):
    url = os.environ.get('TEST_POSTGRES_URL')
    if not url:
        pytest.skip('Requires a migrated disposable localhost resqai_test database')
    parsed = urlparse(url)
    assert parsed.hostname in {'localhost', '127.0.0.1'} and parsed.path == '/resqai_test'
    secret = 'integration-test-only-key-over-32-characters'
    monkeypatch.setenv('SECRET_KEY', secret)
    monkeypatch.setenv('AI_API_KEY', '')
    monkeypatch.setenv('DATABASE_URL', url)
    from app.main import app
    from app.database import get_db
    from app.routers.auth import get_redis, create_access_token
    from app.schema_check import check_schema
    from app.config import settings
    monkeypatch.setattr(settings, 'SECRET_KEY', secret)
    monkeypatch.setattr(settings, 'AI_API_KEY', '')
    monkeypatch.setattr('app.routers.requests.notify_new_request', AsyncMock())

    connection = await asyncpg.connect(url)
    admin_id, other_admin, recipient, donor, other_donor = [uuid.uuid4() for _ in range(5)]
    tag = uuid.uuid4().hex
    for subject in (admin_id, other_admin):
        await connection.execute("INSERT INTO administrators(admin_id,full_name,email,password_hash,agency) VALUES($1,'Test coordinator',$2,'test-only','Test agency')", subject, f'{subject}@example.test')
    for subject in (recipient, donor, other_donor):
        await connection.execute("INSERT INTO users(user_id,full_name,email,phone_number,password_hash,is_verified,is_active) VALUES($1,'Test participant',$2,'+94771234567','test-only',TRUE,TRUE)", subject, f'{subject}@example.test')

    engine = create_async_engine(url.replace('postgresql://', 'postgresql+asyncpg://', 1))
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async def db_override():
        async with sessions() as session:
            yield session
    redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    async def redis_override():
        return redis
    app.dependency_overrides[get_db] = db_override
    app.dependency_overrides[get_redis] = redis_override
    def headers(subject, role='people'):
        return {'Authorization': 'Bearer ' + create_access_token({'sub': str(subject), 'role': role}, timedelta(minutes=15))}
    root = Path(__file__).resolve().parents[2]
    server = subprocess.Popen(['node', str(root / 'database/tests/support/node_server.cjs')],
        env={**os.environ, 'JWT_SECRET': secret, 'SECRET_KEY': secret, 'TEST_POSTGRES_URL': url},
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        port = await asyncio.wait_for(asyncio.to_thread(server.stdout.readline), timeout=10)
        assert port.strip().isdigit(), 'Integration Node server failed to start'
        async with engine.connect() as database:
            await check_schema(database)
        async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as api, AsyncClient(base_url=f'http://127.0.0.1:{port.strip()}') as node:
            submitted = await api.post('/api/requests', headers=headers(recipient), json={
                'message': f'Family needs food parcels after flood {tag}', 'request_type': 'donation',
                'location_label': 'Test district', 'affected_people': 4,
                'lat':6.9, 'lng':79.8, 'location_source':'gps',
                'requested_items': [{'item_name': 'food parcel', 'quantity': 10, 'unit': 'parcels'}],
                'client_request_id': str(uuid.uuid4()),
            })
            assert submitted.status_code == 201, submitted.text
            request_id = submitted.json()['request_id']
            assert not any(row['request_id'] == request_id for row in (await api.get('/api/requests/public')).json())
            denied = await node.patch(f'/api/requests/{request_id}/verification', headers=headers(donor), json={})
            assert denied.status_code == 403
            review = await node.patch(f'/api/requests/{request_id}/verification', headers=headers(admin_id, 'admin'), json={
                'decision': 'verified', 'expected_verification_status': 'unverified',
                'method': 'phone_callback', 'notes': 'Verified the listed food needs with the recipient during a callback.',
            })
            assert review.status_code == 200, review.text
            public = (await api.get('/api/requests/public')).json()
            assert any(row['request_id'] == request_id for row in public)
            assert all('phone' not in row and 'evidence_note' not in row for row in public)
            mission_id = await connection.fetchval('SELECT mission_id FROM relief_missions WHERE origin_request_id=$1', uuid.UUID(request_id))
            need_id = await connection.fetchval('SELECT need_id FROM mission_needs WHERE mission_id=$1', mission_id)
            public_missions = await api.get('/api/missions?status=active')
            assert public_missions.status_code == 200, public_missions.text
            assert 'funds_collected' not in public_missions.text and 'amount' not in public_missions.text
            # Two simultaneous reservations of six must not overbook a need of ten.
            async def pledge(who, quantity, key=None):
                return await api.post('/api/donations', headers=headers(who), json={
                    'need_id': str(need_id), 'quantity': quantity, 'condition': 'new',
                    'availability_note': 'Ready at the approved collection point tomorrow',
                    'client_pledge_id': key or str(uuid.uuid4()),
                })
            attempts = await asyncio.gather(pledge(donor, 6), pledge(other_donor, 6))
            assert sorted(response.status_code for response in attempts) == [201, 409], [r.text for r in attempts]
            winner = next(response.json() for response in attempts if response.status_code == 201)
            donation_id = winner['donation_id']
            denied = await node.post(f'/api/goods/pledges/{donation_id}/dispatch', headers=headers(admin_id, 'admin'), json={
                'quantity': 1, 'reason': 'Attempt to dispatch stock before receipt', 'operation_id': str(uuid.uuid4()),
            })
            assert denied.status_code == 409, denied.text
            operation = str(uuid.uuid4())
            receive_body = {'quantity': 6, 'reason': 'Six sealed parcels counted at the collection point', 'operation_id': operation}
            for _ in range(2):
                receipt = await node.post(f'/api/goods/pledges/{donation_id}/receive', headers=headers(admin_id, 'admin'), json=receive_body)
                assert receipt.status_code == 200, receipt.text
            assert await connection.fetchval('SELECT received_quantity FROM donations WHERE donation_id=$1', uuid.UUID(donation_id)) == 6
            dispatch = await node.post(f'/api/goods/pledges/{donation_id}/dispatch', headers=headers(admin_id, 'admin'), json={
                'quantity': 6, 'reason': 'Six parcels handed to the assigned delivery team', 'operation_id': str(uuid.uuid4()),
            })
            assert dispatch.status_code == 200, dispatch.text
            delivery_id = dispatch.json()['delivery_id']
            assert (await api.patch(f'/api/donations/deliveries/{delivery_id}/confirm', headers=headers(donor))).status_code == 404
            dispute = await api.patch(f'/api/donations/deliveries/{delivery_id}/dispute', headers=headers(recipient), json={'reason': 'The delivery has not arrived at our location'})
            assert dispute.status_code == 200, dispute.text
            self_review = await node.patch(f'/api/goods/deliveries/{delivery_id}/review', headers=headers(admin_id, 'admin'), json={'resolution': 'returned', 'reason': 'Parcels returned to the relief collection point'})
            assert self_review.status_code == 403
            returned = await node.patch(f'/api/goods/deliveries/{delivery_id}/review', headers=headers(other_admin, 'admin'), json={'resolution': 'returned', 'reason': 'Independently confirmed parcels returned to stock'})
            assert returned.status_code == 200, returned.text
            redispatch = await node.post(f'/api/goods/pledges/{donation_id}/dispatch', headers=headers(admin_id, 'admin'), json={
                'quantity': 6, 'reason': 'Redelivered to the confirmed recipient location', 'operation_id': str(uuid.uuid4()),
            })
            assert redispatch.status_code == 200, redispatch.text
            delivered_id = redispatch.json()['delivery_id']
            for _ in range(2):
                confirmed = await api.patch(f'/api/donations/deliveries/{delivered_id}/confirm', headers=headers(recipient))
                assert confirmed.status_code == 200, confirmed.text
            assert await connection.fetchval('SELECT delivered_quantity FROM donations WHERE donation_id=$1', uuid.UUID(donation_id)) == 6
            # The original need is ten, so six delivered does not complete the mission.
            close = await node.patch(f'/api/missions/{mission_id}/status', headers=headers(admin_id, 'admin'), json={'status':'completed','reason':'Attempt to close with remaining unmet quantities'})
            assert close.status_code == 409, close.text
            detail = await api.get(f'/api/requests/{request_id}', headers=headers(recipient))
            assert detail.status_code == 200 and detail.json()['history'][0]['status'] == 'verified', detail.text
            second = await pledge(other_donor, 4)
            assert second.status_code == 201, second.text
            second_id = second.json()['donation_id']
            received = await node.post(f'/api/goods/pledges/{second_id}/receive', headers=headers(admin_id,'admin'), json={
                'quantity':4, 'reason':'Remaining four parcels physically received', 'operation_id':str(uuid.uuid4()),
            })
            assert received.status_code == 200, received.text
            dispatched = await node.post(f'/api/goods/pledges/{second_id}/dispatch', headers=headers(admin_id,'admin'), json={
                'quantity':4, 'reason':'Remaining four parcels sent to the recipient', 'operation_id':str(uuid.uuid4()),
            })
            assert dispatched.status_code == 200, dispatched.text
            confirmed = await api.patch('/api/donations/deliveries/' + dispatched.json()['delivery_id'] + '/confirm', headers=headers(recipient))
            assert confirmed.status_code == 200, confirmed.text
            started = await node.patch(f'/api/requests/{request_id}/status', headers=headers(admin_id,'admin'), json={
                'status':'in_progress', 'reason':'Coordinator is supervising verified goods fulfillment',
            })
            assert started.status_code == 200, started.text
            complete = await node.patch(f'/api/missions/{mission_id}/status', headers=headers(admin_id,'admin'), json={
                'status':'completed', 'reason':'All ten parcels confirmed by the registered recipient',
            })
            assert complete.status_code == 200, complete.text
            closed = await node.patch(f'/api/requests/{request_id}/status', headers=headers(admin_id,'admin'), json={
                'status':'finished', 'reason':'Mission completed and every requested parcel delivered',
            })
            assert closed.status_code == 200, closed.text
            final = await api.get(f'/api/requests/{request_id}', headers=headers(recipient))
            assert final.json()['status'] == 'resolved', final.text
            assert final.json()['history'][0]['status'] == 'finished'
            assert all(case['request_id'] != request_id for case in (await api.get('/api/requests/community')).json())
            assert all(mission['mission_id'] != str(mission_id) for mission in (await api.get('/api/missions?status=active')).json())
            assert (await node.get('/test/stats')).status_code == 200
            chat = await node.post('/api/chat', headers=headers(admin_id,'admin'), json={'message_text':'Goods receipt verified by coordinator','channel_id':1})
            assert chat.status_code == 201, chat.text
            assert (await node.get('/api/chat', headers=headers(recipient))).status_code == 403
    finally:
        server.terminate()
        try:
            await asyncio.wait_for(asyncio.to_thread(server.wait), 5)
        except asyncio.TimeoutError:
            server.kill()
        diagnostics = server.stderr.read()
        if diagnostics:
            print(diagnostics)
        app.dependency_overrides.clear()
        await redis.aclose()
        await engine.dispose()
        await connection.close()
