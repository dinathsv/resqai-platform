import pytest

@pytest.mark.asyncio
async def test_submit_as_people(client, people_token):
    r = await client.post('/api/requests',
        json={"message": "flood", "lat": 6.9, "lng": 79.8},
        headers={'Authorization': f'Bearer {people_token}'})
    assert r.status_code == 201

@pytest.mark.asyncio
async def test_submit_as_guest(client, guest_token):
    r = await client.post('/api/requests',
        json={"message": "flood", "lat": 6.9, "lng": 79.8},
        headers={'Authorization': f'Bearer {guest_token}'})
    assert r.status_code == 201

@pytest.mark.asyncio
async def test_submit_no_auth(client):
    r = await client.post('/api/requests',
        json={"message": "flood", "lat": 6.9, "lng": 79.8})
    assert r.status_code == 401

@pytest.mark.asyncio
async def test_locate_resources(client):

    r = await client.post('/api/ai/locate-resources', json={
        "lat": 6.9,
        "lng": 79.8,
        "emergency_type": "medical"
    })

    assert r.status_code == 200
    assert 'hospitals' in r.json()
