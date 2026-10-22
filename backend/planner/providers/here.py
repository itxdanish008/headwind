from typing import Any

from django.conf import settings

from ..exceptions import UpstreamServiceError
from . import http


def here_get(url: str, **params: str | int) -> Any:
    if not settings.HERE_API_KEY:
        raise UpstreamServiceError("HERE_API_KEY is not configured")
    return http.get_json(url, params={**params, "apiKey": settings.HERE_API_KEY})
