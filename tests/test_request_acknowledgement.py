import unittest
import uuid
from unittest.mock import AsyncMock, MagicMock

from fastapi import HTTPException
from app.routers.alerts import acknowledge_request_alert


def result(row):
    value = MagicMock()
    value.first.return_value = row
    value.mappings.return_value.first.return_value = row
    return value


class RequestAcknowledgementTests(unittest.IsolatedAsyncioTestCase):
    async def test_help_and_donation_create_active_mission_and_accepted_user(self):
        for kind in ('help_rescue', 'donation'):
            with self.subTest(kind=kind):
                db = AsyncMock()
                db.execute.side_effect = [result({'user_id': uuid.uuid4()}), result({
                    'user_id': uuid.uuid4(), 'status': 'pending', 'admin_status': 'pending',
                    'emergency_type': kind, 'original_message': 'Please help',
                }), result(None), result(None), result(None), result(None), result(None)]
                response = await acknowledge_request_alert(uuid.uuid4(), {'sub': str(uuid.uuid4())}, db)
                self.assertTrue(response['acknowledged'])
                statements = [str(call.args[0]) for call in db.execute.call_args_list]
                self.assertTrue(any('FOR UPDATE' in sql for sql in statements))
                self.assertTrue(any('INSERT INTO relief_missions' in sql for sql in statements))
                self.assertTrue(any("admin_status='in_progress'" in sql for sql in statements))
                self.assertTrue(any('WHERE NOT EXISTS' in sql for sql in statements))
                db.commit.assert_awaited_once()

    async def test_retry_reuses_mission(self):
        db = AsyncMock()
        mission_id = uuid.uuid4()
        db.execute.side_effect = [result({'user_id': uuid.uuid4()}), result({
            'user_id': uuid.uuid4(), 'status': 'in_progress', 'admin_status': 'in_progress',
            'emergency_type': 'donation', 'original_message': 'Please help',
        }), result({'mission_id': mission_id, 'status': 'active'}), result(None), result(None)]
        response = await acknowledge_request_alert(uuid.uuid4(), {'sub': str(uuid.uuid4())}, db)
        self.assertEqual(response['mission_id'], str(mission_id))
        self.assertFalse(any('INSERT INTO relief_missions' in str(c.args[0]) for c in db.execute.call_args_list))

    async def test_closed_request_cannot_be_accepted(self):
        db = AsyncMock()
        db.execute.side_effect = [result({'user_id': uuid.uuid4()}), result({
            'user_id': uuid.uuid4(), 'status': 'resolved', 'admin_status': 'finished',
        })]
        with self.assertRaises(HTTPException) as raised:
            await acknowledge_request_alert(uuid.uuid4(), {'sub': str(uuid.uuid4())}, db)
        self.assertEqual(raised.exception.status_code, 409)
        db.commit.assert_not_awaited()
