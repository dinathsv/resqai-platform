import pytest
from app.models.help_request import HelpRequest
from app.models.relief_mission import ReliefMission
from conftest import TestingSessionLocal
from test_goods_relief import setup_goods, auth


@pytest.mark.asyncio
async def test_public_help_mission_join_requires_confirmed_need(client):
    ids = await setup_goods(verified=False)
    async with TestingSessionLocal() as db:
        mission = await db.get(ReliefMission, ids['mission'])
        mission.mission_type = 'help'
        request = await db.get(HelpRequest, ids['request'])
        request.emergency_type = 'help_rescue'
        await db.commit()
    path = '/api/volunteer-assignments'
    payload = {'mission_id': str(ids['mission'])}
    for verification in ['unverified', 'needs_information', 'rejected']:
        async with TestingSessionLocal() as db:
            request = await db.get(HelpRequest, ids['request'])
            request.verification_status = verification
            await db.commit()
        assert (await client.post(path, json=payload, headers=auth(ids['donor']))).status_code == 409
    async with TestingSessionLocal() as db:
        request = await db.get(HelpRequest, ids['request'])
        request.verification_status = 'verified'
        await db.commit()
    assert (await client.post(path, json=payload, headers=auth(ids['donor']))).status_code == 201
