"""Request access, public redaction, duplicate-safe submission and triage behavior."""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock
import pytest
from sqlalchemy import select
from app.main import app
from app.database import get_db
from app.models.guest_session import GuestSession
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
async def test_urgent_request_awaits_approval_and_is_idempotent(client):
    headers, _ = await register_verified(client)
    payload = {'message': 'Family trapped by flood water', 'client_request_id': str(uuid.uuid4())}
    first = await client.post('/api/requests', json=payload, headers=headers)
    assert first.status_code == 201, first.text
    assert first.json()['urgency_level'] == 5
    assert first.json()['verification_status'] == 'unverified'
    repeat = await client.post('/api/requests', json=payload, headers=headers)
    assert first.json()['request_id'] == repeat.json()['request_id']
    public = (await client.get('/api/requests/public')).json()
    assert public == []
    alerts = (await client.get('/api/alerts?status=all')).json()['alerts']
    assert alerts == []
    changed = await client.post('/api/requests', json={**payload, 'message': 'Different goods needed'}, headers=headers)
    assert changed.status_code == 409


@pytest.mark.asyncio
async def test_no_people_affected_is_saved_idempotently_and_awaits_verification(client):
    headers, _ = await register_verified(client)
    payload = {
        'message': 'Please check flood water near an empty road',
        'affected_people': 0, 'client_request_id': str(uuid.uuid4()),
    }
    first = await client.post('/api/requests', json=payload, headers=headers)
    assert first.status_code == 201, first.text
    assert first.json()['affected_people'] == 0
    assert first.json()['urgency_level'] == 2
    assert first.json()['verification_status'] == 'unverified'
    repeat = await client.post('/api/requests', json=payload, headers=headers)
    assert repeat.status_code == 201, repeat.text
    assert repeat.json()['request_id'] == first.json()['request_id']
    assert repeat.json()['affected_people'] == 0
    assert (await client.get('/api/requests/community')).json() == []
    assert (await client.get('/api/alerts')).json()['alerts'] == []
    changed = await client.post('/api/requests', json={**payload, 'affected_people': 2}, headers=headers)
    assert changed.status_code == 409


@pytest.mark.asyncio
@pytest.mark.parametrize('affected_people', [-1, 100001])
async def test_affected_people_outside_supported_range_is_rejected(client, affected_people):
    headers, _ = await register_verified(client)
    response = await client.post('/api/requests', headers=headers, json={
        'message': 'Please check the road', 'affected_people': affected_people,
    })
    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize('kind', ['help_rescue', 'donation'])
async def test_requests_require_a_session(client, kind):
    response = await client.post('/api/requests', json={
        'message': 'Need food parcels for family', 'request_type': kind,
        'requested_items': [{'item_name': 'Food parcels', 'quantity': 5, 'unit': 'parcels'}] if kind == 'donation' else [],
    })
    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize('kind', ['help_rescue', 'donation'])
async def test_guest_uses_chatbot_and_needs_current_nic_approval_to_submit(client, monkeypatch, kind):
    guest_id = uuid.uuid4()
    lifetime = timedelta(minutes=15)
    async for db in app.dependency_overrides[get_db]():
        db.add(GuestSession(
            session_id=guest_id, admin_status='pending', phone_verified=True, nic_format_valid=True,
            temp_token='test', expires_at=datetime.now(timezone.utc) + lifetime,
        ))
        await db.commit()
    token = auth.create_access_token({'sub': str(guest_id), 'role': 'guest', 'identity_status': 'approved'}, lifetime)
    headers = {'Authorization': f'Bearer {token}'}
    payload = {
        'message': 'Need food parcels for family', 'request_type': kind, 'client_request_id': str(uuid.uuid4()),
        'requested_items': [{'item_name': 'Food parcels', 'quantity': 5, 'unit': 'parcels'}] if kind == 'donation' else [],
    }
    monkeypatch.setattr('app.routers.ai.call_llm', AsyncMock(return_value='First-aid guidance'))
    for decision in ('pending', 'approved', 'rejected'):
        async for db in app.dependency_overrides[get_db]():
            guest = await db.get(GuestSession, guest_id)
            guest.admin_status = decision
            guest.nic_verified = decision == 'approved'
            await db.commit()

        profile = await client.get('/api/auth/me', headers=headers)
        assert profile.status_code == 200 and profile.json()['identity_status'] == decision
        chat = await client.post('/api/ai/first-aid-chat', headers=headers, json={'message': 'How do I dress a wound?'})
        assert chat.status_code == 200
        response = await client.post('/api/requests', headers=headers, json=payload)
        requests = await client.get('/api/requests/my', headers=headers)
        if decision == 'approved':
            assert response.status_code == 201, response.text
            assert response.json()['verification_status'] == 'unverified'
            assert requests.json()[0]['request_id'] == response.json()['request_id']
        else:
            assert response.status_code == requests.status_code == 403
            assert response.json()['detail']['code'] == 'guest_approval_required'

    async for db in app.dependency_overrides[get_db]():
        record = (await db.scalars(select(HelpRequest))).one()
        assert record.guest_session_id == guest_id and record.emergency_type == kind


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
    assert (await client.get(f'/api/requests/{request_id}', headers=other)).status_code == 404
    mine = (await client.get('/api/requests/my', headers=headers)).json()
    assert mine[0]['evidence_note'] == 'Private callback notes'
    async for db in app.dependency_overrides[get_db]():
        row = await db.get(HelpRequest, request_id)
        row.verification_status = 'rejected'
        await db.commit()
    assert (await client.get('/api/alerts?status=all')).json()['alerts'] == []


@pytest.mark.asyncio
async def test_deactivated_and_invalid_tokens_cannot_submit(client):
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
    headers, _ = await register_verified(client)
    assert (await client.post('/api/requests', headers=headers, json={'message': 'Need assistance', 'lat': 6.9})).status_code == 422
    assert (await client.post('/api/requests', headers=headers, json={'message': 'Need assistance', 'amount': 100})).status_code == 422
    assert (await client.post('/api/requests', headers=headers, json={'message': 'Need assistance', 'location_source': 'gps'})).status_code == 422


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
async def test_requester_evidence_update_preserves_location_and_returns_to_review(client, monkeypatch):
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
    triage = AsyncMock()
    monkeypatch.setattr('app.routers.requests.triage_request', triage)
    update = await client.patch(f'/api/requests/{request_id}/information', headers=headers,
                               json={'evidence_note':'Confirmed collection point with local coordinator'})
    assert update.status_code == 200, update.text
    assert update.json()['verification_status'] == 'unverified'
    assert update.json()['requested_items'][0]['quantity'] == 10
    triage.assert_not_awaited()
    async for db in app.dependency_overrides[get_db]():
        record = await db.get(HelpRequest, request_id)
        assert record.gps_location == original_location
        record.admin_status = 'in_progress'
        await db.commit()
    assert (await client.patch(f'/api/requests/{request_id}/information', headers=headers,
                              json={'message':'Edited while the response has started'})).status_code == 409


@pytest.mark.asyncio
async def test_people_count_and_description_updates_recalculate_priority(client):
    headers, _ = await register_verified(client)
    created = await client.post('/api/requests', headers=headers, json={
        'message': 'Please check flood water near the road', 'affected_people': 2,
    })
    assert created.status_code == 201, created.text
    request_id = created.json()['request_id']
    assert created.json()['urgency_level'] == 3
    count_update = await client.patch(f'/api/requests/{request_id}/information', headers=headers,
                                      json={'affected_people': 0})
    assert count_update.status_code == 200, count_update.text
    assert count_update.json()['affected_people'] == 0
    assert count_update.json()['urgency_level'] == 2
    danger_update = await client.patch(f'/api/requests/{request_id}/information', headers=headers,
                                       json={'message': 'Someone is trapped by the flood water'})
    assert danger_update.status_code == 200, danger_update.text
    assert danger_update.json()['urgency_level'] == 5
    assert danger_update.json()['verification_status'] == 'unverified'
