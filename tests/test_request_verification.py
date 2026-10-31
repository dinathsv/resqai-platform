"""Request access, public redaction, duplicate-safe submission and triage behavior."""
import uuid
from unittest.mock import AsyncMock
import pytest
from sqlalchemy import select
from app.main import app
from app.database import get_db
from app.models.help_request import HelpRequest
from app.models.user import User
from app.models.relief_mission import ReliefMission
from app.routers import auth


async def register_verified(client, email='owner@example.com'):
    signup = await client.post('/api/auth/register', json={
        'full_name': 'Test recipient', 'email': email, 'phone_number': '0771234567', 'password': 'password123',
    })
    user_id = signup.json()['user_id']
    redis = await anext(app.dependency_overrides[auth.get_redis]())
    otp = await redis.get(f'otp:{user_id}')
    response = await client.post('/api/auth/verify-otp', json={'user_id': user_id, 'otp': otp})
    return {'Authorization': 'Bearer ' + response.json()['access_token']}, user_id


@pytest.fixture(autouse=True)
def no_broadcast(monkeypatch):
    monkeypatch.setattr('app.routers.requests.notify_new_request', AsyncMock())


@pytest.mark.asyncio
async def test_anonymous_urgent_request_is_private_and_idempotent(client):
    payload = {'message': 'Family trapped by flood water', 'client_request_id': str(uuid.uuid4())}
    first = await client.post('/api/requests', json=payload)
    assert first.status_code == 201, first.text
    assert first.json()['urgency_level'] == 5
    assert first.json()['verification_status'] == 'unverified'
    repeat = await client.post('/api/requests', json=payload)
    assert first.json()['request_id'] == repeat.json()['request_id']
    assert (await client.get('/api/requests/public')).json() == []
    assert (await client.get('/api/alerts?status=all')).json()['alerts'] == []
    changed = await client.post('/api/requests', json={**payload, 'message': 'Different goods needed'})
    assert changed.status_code == 409


@pytest.mark.asyncio
async def test_anonymous_cannot_request_goods(client):
    response = await client.post('/api/requests', json={
        'message': 'Need food parcels for family', 'request_type': 'donation',
        'requested_items': [{'item_name': 'Food parcels', 'quantity': 5, 'unit': 'parcels'}],
    })
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_public_case_redacts_message_and_evidence(client):
    headers, user_id = await register_verified(client)
    response = await client.post('/api/requests', headers=headers, json={
        'message': 'Private phone and identity details', 'evidence_note': 'Private callback notes',
        'location_label': 'Kelaniya',
    })
    assert response.status_code == 201, response.text
    request_id = uuid.UUID(response.json()['request_id'])
    async for db in app.dependency_overrides[get_db]():
        row = await db.get(HelpRequest, request_id)
        row.verification_status = 'verified'
        await db.commit()
    public = (await client.get('/api/requests/community')).json()[0]
    assert public['message'] == 'Verified help request'
    assert 'evidence_note' not in public and 'lat' not in public and 'risk_flags' not in public
    assert 'Private' not in str(public)
    public_alerts = (await client.get('/api/alerts?status=all')).json()['alerts']
    assert len(public_alerts) == 1 and public_alerts[0]['work_plan'] == 'Verified help request'
    assert 'Private' not in str(public_alerts)
    other, _ = await register_verified(client, 'other@example.com')
    assert (await client.get(f'/api/requests/{request_id}', headers=other)).status_code == 403
    mine = (await client.get('/api/requests/my', headers=headers)).json()
    assert mine[0]['evidence_note'] == 'Private callback notes'
    async for db in app.dependency_overrides[get_db]():
        row = await db.get(HelpRequest, request_id)
        row.verification_status = 'rejected'
        await db.commit()
    assert (await client.get('/api/alerts?status=all')).json()['alerts'] == []


@pytest.mark.asyncio
async def test_deactivated_token_and_invalid_token_are_not_anonymous(client):
    headers, user_id = await register_verified(client)
    async for db in app.dependency_overrides[get_db]():
        user = await db.get(User, uuid.UUID(user_id))
        user.is_active = False
        await db.commit()
    assert (await client.post('/api/requests', headers=headers, json={'message': 'Need assistance'})).status_code == 403
    assert (await client.post('/api/requests', headers={'Authorization': 'Bearer invalid'}, json={'message': 'Need assistance'})).status_code == 401


@pytest.mark.asyncio
async def test_changed_phone_requires_new_verification(client):
    headers, _ = await register_verified(client)
    response = await client.patch('/api/auth/me', headers=headers, json={'phone_number': '0777654321'})
    assert response.status_code == 409
    assert (await client.get('/api/auth/me', headers=headers)).json()['phone_number'] == '+94771234567'


@pytest.mark.asyncio
async def test_request_validation_rejects_invented_half_location_and_money(client):
    assert (await client.post('/api/requests', json={'message': 'Need assistance', 'lat': 6.9})).status_code == 422
    assert (await client.post('/api/requests', json={'message': 'Need assistance', 'amount': 100})).status_code == 422
    assert (await client.post('/api/requests', json={'message': 'Need assistance', 'location_source': 'gps'})).status_code == 422


@pytest.mark.asyncio
async def test_alert_and_mission_feeds_never_leak_private_claims(client):
    headers, _ = await register_verified(client)
    response = await client.post('/api/requests', headers=headers, json={
        'message': 'Private callback phone and household details',
        'location_label': 'Private detailed address',
    })
    request_id = uuid.UUID(response.json()['request_id'])
    async for db in app.dependency_overrides[get_db]():
        record = await db.get(HelpRequest, request_id)
        record.verification_status = 'verified'
        db.add(ReliefMission(title='Help Mission', description=record.original_message,
                            mission_type='help', status='active', origin_request_id=request_id))
        await db.commit()
    for path in ('/api/alerts', '/api/missions?status=active', '/api/requests/community'):
        feed = await client.get(path)
        assert feed.status_code == 200, feed.text
        assert 'Private' not in feed.text, path
    async for db in app.dependency_overrides[get_db]():
        record = await db.get(HelpRequest, request_id)
        record.verification_status = 'rejected'
        await db.commit()
    assert (await client.get('/api/missions?status=active')).json() == []
    assert (await client.get('/api/alerts')).json()['alerts'] == []


@pytest.mark.asyncio
async def test_requester_evidence_update_preserves_location_and_returns_to_review(client):
    headers, _ = await register_verified(client)
    response = await client.post('/api/requests', headers=headers, json={
        'message': 'Need clean water for our household', 'request_type': 'donation',
        'requested_items': [{'item_name':'Clean water', 'quantity':10, 'unit':'bottles'}],
        'lat':6.9, 'lng':79.8, 'location_source':'gps',
    })
    request_id = uuid.UUID(response.json()['request_id'])
    async for db in app.dependency_overrides[get_db]():
        record = await db.get(HelpRequest, request_id)
        record.verification_status = 'needs_information'
        original_location = record.gps_location
        await db.commit()
    update = await client.patch(f'/api/requests/{request_id}/information', headers=headers,
                               json={'evidence_note':'Confirmed collection point with local coordinator'})
    assert update.status_code == 200, update.text
    assert update.json()['verification_status'] == 'unverified'
    assert update.json()['requested_items'][0]['quantity'] == 10
    async for db in app.dependency_overrides[get_db]():
        record = await db.get(HelpRequest, request_id)
        assert record.gps_location == original_location
        record.admin_status = 'in_progress'
        await db.commit()
    assert (await client.patch(f'/api/requests/{request_id}/information', headers=headers,
                              json={'message':'Edited while the response has started'})).status_code == 409
