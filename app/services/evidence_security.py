"""Bounded image decoding, metadata removal and authenticated encryption."""

import base64
import binascii
import io
import os
import warnings
import uuid

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings

MAX_IMAGE_BYTES = 3 * 1024 * 1024
MAX_IMAGE_STRING = ((MAX_IMAGE_BYTES + 2) // 3) * 4 + 100
MAX_BODY_BYTES = 2 * MAX_IMAGE_STRING + 2048
PRIVATE_HEADERS = {"Cache-Control": "no-store, private", "Pragma": "no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer"}


def evidence_key() -> bytes:
    try:
        key = base64.b64decode(settings.EVIDENCE_ENCRYPTION_KEY, altchars=b"-_", validate=True)
        if len(key) != 32:
            raise ValueError()
        return key
    except (ValueError, binascii.Error):
        raise HTTPException(503, "Private verification uploads are not configured. Your help request can still be submitted.") from None


def evidence_configured() -> bool:
    try:
        evidence_key()
        return True
    except HTTPException:
        return False


def normalize_image(data_url: str) -> bytes:
    """Accept real JPEG/PNG/WebP images only; discard EXIF and other metadata."""
    if len(data_url) > MAX_IMAGE_STRING:
        raise HTTPException(413, "Each verification image must be at most 3 MB.")
    try:
        header, payload = data_url.split(",", 1)
        formats = {"data:image/jpeg;base64": "JPEG", "data:image/png;base64": "PNG", "data:image/webp;base64": "WEBP"}
        if header not in formats:
            raise ValueError()
        raw = base64.b64decode(payload, validate=True)
        if len(raw) > MAX_IMAGE_BYTES:
            raise HTTPException(413, "Each verification image must be at most 3 MB.")
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw), formats=["JPEG", "PNG", "WEBP"]) as source:
                if (source.format != formats[header] or getattr(source, "n_frames", 1) != 1
                        or min(source.size) < 120 or source.width * source.height > 12_000_000):
                    raise ValueError()
                source.load()
                oriented = ImageOps.exif_transpose(source)
                oriented.thumbnail((1600, 1600))
                # A new RGB image has no source metadata to accidentally preserve.
                clean = Image.new("RGB", oriented.size, "white")
                if oriented.mode in {"RGBA", "LA"} or "transparency" in oriented.info:
                    rgba = oriented.convert("RGBA")
                    clean.paste(rgba, mask=rgba.getchannel("A"))
                else:
                    clean.paste(oriented.convert("RGB"))
                output = io.BytesIO()
                clean.save(output, format="JPEG", quality=85, optimize=True)
                return output.getvalue()
    except HTTPException:
        raise
    except (ValueError, binascii.Error, OSError, UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(422, "Use a clear, valid JPEG, PNG or WebP image of at least 120 by 120 pixels.") from None


def evidence_aad(request_id: uuid.UUID, evidence_id: uuid.UUID, kind: str) -> bytes:
    return f"resqai-evidence-v1:{request_id}:{evidence_id}:{kind}".encode()


def encrypt_image(image: bytes, request_id: uuid.UUID, evidence_id: uuid.UUID, kind: str) -> bytes:
    nonce = os.urandom(12)
    return nonce + AESGCM(evidence_key()).encrypt(nonce, image, evidence_aad(request_id, evidence_id, kind))


def decrypt_image(ciphertext: bytes, request_id: uuid.UUID, evidence_id: uuid.UUID, kind: str) -> bytes:
    return AESGCM(evidence_key()).decrypt(ciphertext[:12], ciphertext[12:], evidence_aad(request_id, evidence_id, kind))
