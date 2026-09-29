"""
ResQAI — SMSlenz SMS Gateway Unit & Integration Tests.
Tests phone normalization, single SMS payload, bulk SMS, and account status check.
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from unittest.mock import AsyncMock, patch

from app.services.sms_service import normalize_phone_number, SMSlenzGateway
from app.services.otp_service import SMSlenzOTPSender, send_otp


def test_normalize_phone_number():
    # Sri Lankan standard formats
    assert normalize_phone_number("0771234567") == "+94771234567"
    assert normalize_phone_number("0712345678") == "+94712345678"
    assert normalize_phone_number("771234567") == "+94771234567"
    assert normalize_phone_number("94771234567") == "+94771234567"
    assert normalize_phone_number("+94771234567") == "+94771234567"

    # Formats with spaces, hyphens, parentheses
    assert normalize_phone_number("+94 77 123 4567") == "+94771234567"
    assert normalize_phone_number("077-123-4567") == "+94771234567"
    assert normalize_phone_number("(077) 123 4567") == "+94771234567"

    # Invalid cases
    assert normalize_phone_number(None) is None
    assert normalize_phone_number("") is None
    assert normalize_phone_number("   ") is None
    assert normalize_phone_number("invalid") is None
    assert normalize_phone_number("123") is None


@pytest.mark.asyncio
async def test_smslenz_is_configured():
    gw = SMSlenzGateway(
        user_id="2462",
        api_key="3ef7d7d9-1ae3-4615-b43c-b795f67375e7",
        sender_id="SMSlenzDEMO",
    )
    assert gw.is_configured is True

    gw_empty = SMSlenzGateway(user_id="", api_key="", sender_id="")
    assert gw_empty.is_configured is False


@pytest.mark.asyncio
async def test_smslenz_send_sms_mock():
    from unittest.mock import MagicMock

    gw = SMSlenzGateway(
        user_id="2462",
        api_key="3ef7d7d9-1ae3-4615-b43c-b795f67375e7",
        sender_id="SMSlenzDEMO",
    )

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {"content-type": "application/json"}
    mock_response.json.return_value = {
        "success": True,
        "message": "SMS sent successfully",
        "data": {"status": "success", "campaign_id": 42},
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        result = await gw.send_sms(contact="0771234567", message="Hello from ResQAI")
        assert result["success"] is True
        assert result["message"] == "SMS sent successfully"
        assert result["error"] is None


@pytest.mark.asyncio
async def test_smslenz_send_bulk_sms_mock():
    from unittest.mock import MagicMock

    gw = SMSlenzGateway(
        user_id="2462",
        api_key="3ef7d7d9-1ae3-4615-b43c-b795f67375e7",
        sender_id="SMSlenzDEMO",
    )

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {"content-type": "application/json"}
    mock_response.json.return_value = {
        "success": True,
        "message": "Bulk SMS sent successfully",
        "data": {"no_of_recipients": 2},
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        result = await gw.send_bulk_sms(
            contacts=["0771234567", "+94712345678", "0771234567"],  # includes duplicate
            message="Emergency alert",
        )
        assert result["success"] is True
        assert result["delivered_count"] == 2


@pytest.mark.asyncio
async def test_smslenz_otp_sender():
    mock_gateway = AsyncMock()
    mock_gateway.send_sms.return_value = {"success": True, "message": "Delivered"}

    sender = SMSlenzOTPSender(gateway=mock_gateway)
    res = await sender.send(recipient="0771234567", otp="123456")
    assert res is True
    mock_gateway.send_sms.assert_called_once()
    call_kwargs = mock_gateway.send_sms.call_args[1]
    assert call_kwargs["contact"] == "+94771234567"
    assert "123456" in call_kwargs["message"]


@pytest.mark.asyncio
async def test_smslenz_live_account_status():
    """Verify live connectivity and authentication with SMSlenz API."""
    gw = SMSlenzGateway()
    status = await gw.get_account_status()
    assert status.get("success") is True
    assert "sms_credit_balance" in status.get("data", {})
    assert status.get("data", {}).get("status") == "active"


if __name__ == "__main__":
    import asyncio

    print("Running SMSlenz tests...")
    test_normalize_phone_number()
    print("[PASS] test_normalize_phone_number passed")

    asyncio.run(test_smslenz_is_configured())
    print("[PASS] test_smslenz_is_configured passed")

    asyncio.run(test_smslenz_send_sms_mock())
    print("[PASS] test_smslenz_send_sms_mock passed")

    asyncio.run(test_smslenz_send_bulk_sms_mock())
    print("[PASS] test_smslenz_send_bulk_sms_mock passed")

    asyncio.run(test_smslenz_otp_sender())
    print("[PASS] test_smslenz_otp_sender passed")

    asyncio.run(test_smslenz_live_account_status())
    print("[PASS] test_smslenz_live_account_status passed (Live API connected!)")

    print("\nAll SMSlenz tests PASSED successfully!")


