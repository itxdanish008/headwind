import hashlib
import logging
import time
from typing import Any

import httpx
from django.conf import settings

from ..exceptions import UpstreamServiceError

logger = logging.getLogger(__name__)

RETRYABLE_STATUS = {429, 500, 502, 503, 504}

client = httpx.Client(
    timeout=httpx.Timeout(settings.HTTP["TIMEOUT_S"], connect=settings.HTTP["CONNECT_TIMEOUT_S"])
)


def cache_key(prefix: str, *parts: object) -> str:
    digest = hashlib.sha1("|".join(map(str, parts)).encode()).hexdigest()
    return f"{prefix}:{digest}"


def get_json(url: str, *, params: dict[str, Any], headers: dict[str, str] | None = None) -> Any:
    retries = settings.HTTP["RETRIES"]
    request_headers = {"User-Agent": settings.USER_AGENT, **(headers or {})}
    for attempt in range(retries):
        if attempt:
            time.sleep(settings.HTTP["BACKOFF_S"] * 2 ** (attempt - 1))
        try:
            response = client.get(url, params=params, headers=request_headers)
        except httpx.TransportError as exc:
            logger.warning("GET %s failed (attempt %d): %s", url, attempt + 1, exc)
            continue
        if response.status_code in RETRYABLE_STATUS:
            logger.warning(
                "GET %s returned %d (attempt %d)", url, response.status_code, attempt + 1
            )
            continue
        if response.is_error:
            logger.error("GET %s returned %d: %s", url, response.status_code, response.text[:200])
            raise UpstreamServiceError
        return response.json()
    logger.error("GET %s unavailable after %d attempts", url, retries)
    raise UpstreamServiceError
