"""Business-rule tests using the isolated SQLite fixtures, never deployment services."""
import uuid
from decimal import Decimal
from jose import jwt
import pytest
from sqlalchemy import select, func
from app.config import settings
from app.models.user import User
from app.models.help_request import HelpRequest
from app.models.relief_mission import ReliefMission
from app.models.goods import MissionNeed, GoodsDelivery, GoodsEvent
from app.models.donation import Donation
from app.models.volunteer_assignment import VolunteerAssignment
from conftest import TestingSessionLocal


def auth(user_id):
    token = jwt.encode({"sub": str(user_id), "role": "people"}, settings.SECRET_KEY, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


async def setup_goods(verified=True):
    async with TestingSessionLocal() as db:
        recipient = User(full_name="Recipient", email=f"{uuid.uuid4()}@test.invalid", password_hash="test-only", is_verified=True)
        donor = User(full_name="Donor", email=f"{uuid.uuid4()}@test.invalid", password_hash="test-only", is_verified=True)
        stranger = User(full_name="Stranger", email=f"{uuid.uuid4()}@test.invalid", password_hash="test-only", is_verified=True)
        db.add_all([recipient, donor, stranger]); await db.flush()
        request = HelpRequest(user_id=recipient.user_id, original_message="Need rice", emergency_type="donation", verification_status="verified" if verified else "unverified")
        db.add(request); await db.flush()
        mission = ReliefMission(title="Rice for families", origin_request_id=request.request_id, mission_type="donation", status="active")
        db.add(mission); await db.flush()
        need = MissionNeed(mission_id=mission.mission_id, item_name="rice", unit="kg", required_quantity=10)
        db.add(need); await db.commit()
        return {"recipient": recipient.user_id, "donor": donor.user_id, "stranger": stranger.user_id, "need": need.need_id, "mission": mission.mission_id, "request": request.request_id}


def pledge_body(ids, amount=4):
    return {"need_id": str(ids["need"]), "quantity": amount, "condition": "new", "availability_note": "Available tomorrow morning", "client_pledge_id": str(uuid.uuid4())}


@pytest.mark.asyncio
async def test_pledges_require_verified_need_and_have_no_money_fields(client):
    ids = await setup_goods(verified=False)
    denied = await client.post('/api/donations', json=pledge_body(ids), headers=auth(ids['donor']))
    assert denied.status_code == 409
    missions = await client.get('/api/missions')
    assert missions.json() == []
    async with TestingSessionLocal() as db:
        request = await db.get(HelpRequest, ids['request']); request.verification_status = 'verified'; await db.commit()
    response = await client.post('/api/donations', json=pledge_body(ids), headers=auth(ids['donor']))
    assert response.status_code == 201, response.text
    assert response.json()['status'] == 'pledged'
    assert response.json()['received_quantity'] == 0
    assert not {'amount','funds_collected','transaction_ref'} & response.json().keys()
    missions = (await client.get('/api/missions')).json()
    assert missions[0]['needs'][0]['remaining_quantity'] == 6
    assert 'funds_collected' not in missions[0]


@pytest.mark.asyncio
async def test_duplicate_retries_overpledges_and_self_donation(client):
    ids = await setup_goods()
    body = pledge_body(ids, 7)
    first = await client.post('/api/donations', json=body, headers=auth(ids['donor']))
    repeated = await client.post('/api/donations', json=body, headers=auth(ids['donor']))
    assert first.status_code == repeated.status_code == 201
    assert first.json()['donation_id'] == repeated.json()['donation_id']
    changed = await client.post('/api/donations', json={**body, 'quantity': 6}, headers=auth(ids['donor']))
    assert changed.status_code == 409
    excess = await client.post('/api/donations', json=pledge_body(ids, 4), headers=auth(ids['stranger']))
    assert excess.status_code == 409
    self_pledge = await client.post('/api/donations', json=pledge_body(ids, 1), headers=auth(ids['recipient']))
    assert self_pledge.status_code == 400
    async with TestingSessionLocal() as db:
        assert await db.scalar(select(func.count()).select_from(Donation)) == 1
        assert await db.scalar(select(func.count()).select_from(GoodsEvent)) == 1
        assert (await db.get(ReliefMission, ids['mission'])).funds_collected == 0


@pytest.mark.asyncio
async def test_recipient_only_confirm_is_idempotent_and_disputes_do_not_count_delivered(client):
    ids = await setup_goods()
    response = await client.post('/api/donations', json=pledge_body(ids, 6), headers=auth(ids['donor']))
    donation_id = uuid.UUID(response.json()['donation_id'])
    async with TestingSessionLocal() as db:
        pledge = await db.get(Donation, donation_id)
        pledge.received_quantity = pledge.dispatched_quantity = Decimal(6)
        delivery = GoodsDelivery(donation_id=donation_id, recipient_id=ids['recipient'], quantity=4, dispatch_note='Packed and sent')
        disputed = GoodsDelivery(donation_id=donation_id, recipient_id=ids['recipient'], quantity=2, dispatch_note='Second batch sent')
        db.add_all([delivery, disputed]); await db.commit()
        delivery_id, disputed_id = delivery.delivery_id, disputed.delivery_id
    path = f'/api/donations/deliveries/{delivery_id}/confirm'
    assert (await client.patch(path, json={}, headers=auth(ids['stranger']))).status_code == 404
    assert (await client.patch(path, json={}, headers=auth(ids['donor']))).status_code == 404
    assert (await client.patch(path, json={}, headers=auth(ids['recipient']))).status_code == 200
    assert (await client.patch(path, json={}, headers=auth(ids['recipient']))).status_code == 200
    dispute_path = f'/api/donations/deliveries/{disputed_id}/dispute'
    assert (await client.patch(dispute_path, json={'reason':'Second package has not arrived'}, headers=auth(ids['recipient']))).status_code == 200
    assert (await client.patch(f'/api/donations/deliveries/{disputed_id}/confirm', json={}, headers=auth(ids['recipient']))).status_code == 409
    async with TestingSessionLocal() as db:
        pledge = await db.get(Donation, donation_id)
        assert pledge.delivered_quantity == 4 and pledge.goods_status == 'partially_delivered'
        assert await db.scalar(select(func.count()).select_from(GoodsEvent).where(GoodsEvent.event_type == 'recipient_confirmed')) == 1


@pytest.mark.asyncio
async def test_cancel_releases_reservation_and_legacy_money_is_not_goods(client):
    ids = await setup_goods()
    response = await client.post('/api/donations', json=pledge_body(ids, 10), headers=auth(ids['donor']))
    path = f"/api/donations/{response.json()['donation_id']}/cancel"
    assert (await client.patch(path, json={'reason':'Unable to supply goods now'}, headers=auth(ids['donor']))).status_code == 200
    assert (await client.post('/api/donations', json=pledge_body(ids, 10), headers=auth(ids['stranger']))).status_code == 201
    async with TestingSessionLocal() as db:
        db.add(Donation(donor_id=ids['donor'], mission_id=ids['mission'], amount=1000, status='pending'))
        await db.commit()
    items = (await client.get('/api/donations', headers=auth(ids['donor']))).json()
    assert len(items) == 1 and items[0]['status'] == 'cancelled'


@pytest.mark.asyncio
async def test_volunteer_completion_requires_recipient_and_cannot_self_complete(client):
    ids = await setup_goods()
    joined = await client.post('/api/volunteer-assignments', json={'mission_id': str(ids['mission'])}, headers=auth(ids['donor']))
    assert joined.status_code == 201, joined.text
    assignment_id = joined.json()['assignment_id']
    complete = await client.patch(f'/api/volunteer-assignments/{assignment_id}/complete', json={'note':'Delivered supplies and helped unpack'}, headers=auth(ids['donor']))
    assert complete.status_code == 200
    assert complete.json()['status'] == 'accepted' and complete.json()['completion_pending']
    assert (await client.patch(f'/api/volunteer-assignments/{assignment_id}/confirm', json={}, headers=auth(ids['donor']))).status_code == 403
    pending = (await client.get('/api/volunteer-assignments/confirmations', headers=auth(ids['recipient']))).json()
    assert pending[0]['assignment_id'] == assignment_id
    confirmed = await client.patch(f'/api/volunteer-assignments/{assignment_id}/confirm', json={}, headers=auth(ids['recipient']))
    assert confirmed.status_code == 200
    async with TestingSessionLocal() as db:
        assignment = await db.get(VolunteerAssignment, uuid.UUID(assignment_id))
        assert assignment.status == 'completed' and assignment.recipient_confirmed_at is not None
