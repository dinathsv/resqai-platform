"""
ResQAI — SMSlenz SMS Gateway Client.
Integrates with SMSlenz Sri Lanka API for single SMS, bulk SMS, OTP delivery,
and disaster alert broadcasting.
"""

import logging
import re
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger("resqai.smslenz")


def normalize_phone_number(phone: str | None) -> str | None:
    """
    Normalize phone numbers into E.164 international format required by SMSlenz (+947XXXXXXXX).

    Handles formats:
    - '0771234567' -> '+94771234567'
    - '771234567'  -> '+94771234567'
    - '94771234567' -> '+94771234567'
    - '+94771234567' -> '+94771234567'
    - '+94 77 123 4567' -> '+94771234567'
    - '077-123-4567' -> '+94771234567'
    """
    if not phone:
        return None

    # Strip whitespace, dashes, parens, dots
    cleaned = re.sub(r"[\s\-\(\)\.]", "", str(phone).strip())
    if not cleaned:
        return None

    # If it starts with '+', verify and strip '+' for check
    if cleaned.startswith("+"):
        num = cleaned[1:]
        # Sri Lanka code 94 followed by 9 digits
        if num.startswith("94") and len(num) == 11 and num[2] == "7":
            return f"+{num}"
        # Other international number format
        if 10 <= len(num) <= 15 and num.isdigit():
            return f"+{num}"
        return f"+{num}"

    # Starts with 0 (e.g. 0771234567 -> 10 digits)
    if cleaned.startswith("0") and len(cleaned) == 10 and cleaned.isdigit():
        return f"+94{cleaned[1:]}"

    # Starts with 94 (e.g. 94771234567 -> 11 digits)
    if cleaned.startswith("94") and len(cleaned) == 11 and cleaned.isdigit():
        return f"+{cleaned}"

    # Starts with 7 (e.g. 771234567 -> 9 digits)
    if len(cleaned) == 9 and cleaned.startswith("7") and cleaned.isdigit():
        return f"+94{cleaned}"

    # If it looks like a valid digit sequence
    if cleaned.isdigit() and 9 <= len(cleaned) <= 15:
        if len(cleaned) == 9:
            return f"+94{cleaned}"
        return f"+{cleaned}"

    return None


class SMSlenzGateway:
    """Gateway client for SMSlenz API (https://smslenz.lk/api)."""

    def __init__(
        self,
        user_id: str | None = None,
        api_key: str | None = None,
        sender_id: str | None = None,
        base_url: str | None = None,
    ):
        self.user_id = user_id if user_id is not None else settings.SMSLENZ_USER_ID
        self.api_key = api_key if api_key is not None else settings.SMSLENZ_API_KEY
        self.sender_id = sender_id if sender_id is not None else settings.SMSLENZ_SENDER_ID
        self.base_url = (base_url if base_url is not None else settings.SMSLENZ_BASE_URL).rstrip("/")

    @property
    def is_configured(self) -> bool:
        """Check if all required SMSlenz credentials are set."""
        return bool(
            self.user_id
            and self.api_key
            and self.sender_id
            and self.user_id.strip()
            and self.api_key.strip()
            and self.sender_id.strip()
        )

    async def send_sms(self, *, contact: str, message: str) -> dict[str, Any]:
        """
        Send a single SMS via POST /api/send-sms.

        Returns:
            dict with { 'success': bool, 'message': str, 'data': dict, 'error': str | None }
        """
        if not self.is_configured:
            logger.warning("SMSlenz is not configured (missing user_id or api_key)")
            return {
                "success": False,
                "error": "SMSlenz gateway credentials not configured",
                "message": "Gateway not configured",
            }

        normalized = normalize_phone_number(contact)
        if not normalized:
            logger.warning("Invalid recipient phone number: %s", contact)
            return {
                "success": False,
                "error": f"Invalid phone number format: {contact}",
                "message": "Invalid phone number",
            }

        url = f"{self.base_url}/send-sms"
        payload = {
            "user_id": self.user_id,
            "api_key": self.api_key,
            "sender_id": self.sender_id,
            "contact": normalized,
            "message": message[:1500],
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(url, json=payload)

            data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}

            if response.status_code == 200 and data.get("success") is True:
                logger.info("SMSlenz SMS sent successfully to %s", normalized)
                return {
                    "success": True,
                    "message": data.get("message", "SMS sent successfully"),
                    "data": data.get("data", {}),
                    "error": None,
                }
            else:
                err_msg = data.get("message") or response.text or f"HTTP {response.status_code}"
                logger.error("SMSlenz SMS delivery failed to %s: %s", normalized, err_msg)
                return {
                    "success": False,
                    "message": err_msg,
                    "error": err_msg,
                    "data": data.get("data", {}),
                }
        except httpx.RequestError as exc:
            logger.exception("Network error calling SMSlenz send-sms: %s", exc)
            return {
                "success": False,
                "error": f"Network error connecting to SMSlenz: {exc}",
                "message": "Network error",
            }
        except Exception as exc:
            logger.exception("Unexpected error sending SMS via SMSlenz: %s", exc)
            return {
                "success": False,
                "error": str(exc),
                "message": "Unexpected error",
            }

    async def send_bulk_sms(self, *, contacts: list[str], message: str) -> dict[str, Any]:
        """
        Send SMS to multiple contacts via POST /api/send-bulk-sms.

        Returns:
            dict with { 'success': bool, 'delivered_count': int, 'message': str, 'error': str | None }
        """
        if not self.is_configured:
            logger.warning("SMSlenz is not configured for bulk SMS")
            return {
                "success": False,
                "delivered_count": 0,
                "error": "SMSlenz gateway credentials not configured",
            }

        # Normalize and filter unique contacts
        normalized_contacts: list[str] = []
        for c in contacts:
            norm = normalize_phone_number(c)
            if norm and norm not in normalized_contacts:
                normalized_contacts.append(norm)

        if not normalized_contacts:
            logger.warning("No valid contacts found for bulk SMS out of %d candidates", len(contacts))
            return {
                "success": False,
                "delivered_count": 0,
                "error": "No valid phone numbers found",
            }

        url = f"{self.base_url}/send-bulk-sms"
        payload = {
            "user_id": self.user_id,
            "api_key": self.api_key,
            "sender_id": self.sender_id,
            "contacts": normalized_contacts,
            "message": message[:1500],
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload)

            data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}

            if response.status_code == 200 and data.get("success") is True:
                num_recipients = data.get("data", {}).get("no_of_recipients", len(normalized_contacts))
                logger.info("SMSlenz bulk SMS sent to %d recipients", num_recipients)
                return {
                    "success": True,
                    "delivered_count": num_recipients,
                    "message": data.get("message", "Bulk SMS sent successfully"),
                    "data": data.get("data", {}),
                    "error": None,
                }
            else:
                err_msg = data.get("message") or response.text or f"HTTP {response.status_code}"
                logger.error("SMSlenz bulk SMS failed: %s", err_msg)
                return {
                    "success": False,
                    "delivered_count": 0,
                    "message": err_msg,
                    "error": err_msg,
                }
        except httpx.RequestError as exc:
            logger.exception("Network error calling SMSlenz send-bulk-sms: %s", exc)
            return {
                "success": False,
                "delivered_count": 0,
                "error": f"Network error connecting to SMSlenz: {exc}",
            }
        except Exception as exc:
            logger.exception("Unexpected error sending bulk SMS via SMSlenz: %s", exc)
            return {
                "success": False,
                "delivered_count": 0,
                "error": str(exc),
            }

    async def get_account_status(self) -> dict[str, Any]:
        """
        Check SMSlenz account status and remaining credit balance.
        """
        url = f"{self.base_url}/account-status"
        payload = {
            "user_id": self.user_id,
            "api_key": self.api_key,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload)

            return response.json()
        except Exception as exc:
            logger.exception("Failed to retrieve SMSlenz account status: %s", exc)
            return {"success": False, "error": str(exc)}


sms_gateway = SMSlenzGateway()
