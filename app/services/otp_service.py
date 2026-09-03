import logging
from abc import ABC, abstractmethod
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class OTPSender(ABC):

    @abstractmethod
    async def send(self, *, recipient: str, otp: str) -> bool:
        ...


class MockOTPSender(OTPSender):

    async def send(self, *, recipient: str, otp: str) -> bool:
        logger.info("[MOCK OTP] OTP for %s: %s", recipient, otp)
        print(f"--- [MOCK OTP] OTP for {recipient}: {otp} ---")
        return True


class EmailOTPSender(OTPSender):

    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        from_email: str,
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.from_email = from_email

    async def send(self, *, recipient: str, otp: str) -> bool:
        try:
            import aiosmtplib

            msg = MIMEMultipart("alternative")
            msg["From"] = self.from_email
            msg["To"] = recipient
            msg["Subject"] = "Your ResQAI Verification Code"

            text_body = (
                f"Your ResQAI verification code is: {otp}\n\n"
                "This code expires in 5 minutes. Do not share it with anyone."
            )

            html_body = f"""\
<html>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
  <div style="max-width: 480px; margin: auto; background: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color: #1a1a1a; margin-bottom: 8px;">ResQAI Verification</h2>
    <p style="color: #555; font-size: 14px;">Use the code below to verify your account:</p>
    <div style="text-align: center; margin: 24px 0;">
      <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1a1a1a; background: #f0f0f0; padding: 12px 24px; border-radius: 8px; display: inline-block;">{otp}</span>
    </div>
    <p style="color: #888; font-size: 12px;">This code expires in 5 minutes. Do not share it with anyone.</p>
  </div>
</body>
</html>"""

            msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))

            await aiosmtplib.send(
                msg,
                hostname=self.host,
                port=self.port,
                username=self.username,
                password=self.password,
                start_tls=True,
            )

            logger.info("Email OTP sent to %s", recipient)
            return True

        except Exception:
            logger.exception("Failed to send email OTP to %s", recipient)
            return False


class TwilioSMSOTPSender(OTPSender):

    TWILIO_API_URL = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"

    def __init__(self, account_sid: str, auth_token: str, from_number: str):
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = from_number

    async def send(self, *, recipient: str, otp: str) -> bool:
        try:
            url = self.TWILIO_API_URL.format(sid=self.account_sid)
            body = f"Your ResQAI verification code is: {otp}. It expires in 5 minutes."

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    data={
                        "From": self.from_number,
                        "To": recipient,
                        "Body": body,
                    },
                    auth=(self.account_sid, self.auth_token),
                )

            if response.status_code in (200, 201):
                logger.info("Twilio SMS OTP sent to %s", recipient)
                return True
            else:
                logger.error(
                    "Twilio SMS failed for %s: %s %s",
                    recipient,
                    response.status_code,
                    response.text,
                )
                return False

        except Exception:
            logger.exception("Failed to send Twilio SMS OTP to %s", recipient)
            return False


def _is_configured(*values: str) -> bool:
    return all(v.strip() for v in values)


def build_otp_senders() -> list[OTPSender]:
    senders: list[OTPSender] = []

    if _is_configured(
        settings.SMTP_HOST,
        settings.SMTP_USER,
        settings.SMTP_PASSWORD,
        settings.SMTP_FROM_EMAIL,
    ):
        senders.append(
            EmailOTPSender(
                host=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USER,
                password=settings.SMTP_PASSWORD,
                from_email=settings.SMTP_FROM_EMAIL,
            )
        )
        logger.info("Email OTP sender configured (host=%s)", settings.SMTP_HOST)

    if _is_configured(
        settings.TWILIO_ACCOUNT_SID,
        settings.TWILIO_AUTH_TOKEN,
        settings.TWILIO_FROM_NUMBER,
    ):
        senders.append(
            TwilioSMSOTPSender(
                account_sid=settings.TWILIO_ACCOUNT_SID,
                auth_token=settings.TWILIO_AUTH_TOKEN,
                from_number=settings.TWILIO_FROM_NUMBER,
            )
        )
        logger.info("Twilio SMS OTP sender configured")

    if not senders:
        senders.append(MockOTPSender())
        logger.warning(
            "No OTP delivery providers configured — using MockOTPSender. "
            "Set SMTP_* or TWILIO_* env vars to enable real delivery."
        )

    return senders


async def send_otp(*, email: str, phone: str | None, otp: str) -> dict[str, bool]:
    senders = build_otp_senders()
    results: dict[str, bool] = {}

    for sender in senders:
        if isinstance(sender, EmailOTPSender):
            results["email"] = await sender.send(recipient=email, otp=otp)
        elif isinstance(sender, TwilioSMSOTPSender):
            if phone:
                results["sms"] = await sender.send(recipient=phone, otp=otp)
            else:
                logger.info("Skipping Twilio SMS — no phone number provided")
                results["sms"] = False
        elif isinstance(sender, MockOTPSender):
            results["mock"] = await sender.send(recipient=email, otp=otp)

    return results
