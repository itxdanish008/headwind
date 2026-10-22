import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / ".env")


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


def env_int(name: str, default: int) -> int:
    return int(os.environ.get(name, default))


def env_float(name: str, default: float) -> float:
    return float(os.environ.get(name, default))


DEBUG = os.environ.get("DEBUG", "0") == "1"
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-insecure-key" if DEBUG else "")
if not DEBUG and SECRET_KEY in ("", "change-me"):
    raise RuntimeError("Set a real SECRET_KEY when DEBUG is off")
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")

HERE_API_KEY = os.environ.get("HERE_API_KEY", "")
USER_AGENT = os.environ.get("USER_AGENT", "headwind-truck-routing/1.0")

HTTP: dict[str, Any] = {
    "TIMEOUT_S": env_float("HTTP_TIMEOUT_S", 10.0),
    "CONNECT_TIMEOUT_S": 5.0,
    "RETRIES": 3,
    "BACKOFF_S": 0.4,
}

ROUTING: dict[str, Any] = {
    "ROUTING_URL": os.environ.get("HERE_ROUTING_URL", "https://router.hereapi.com/v8/routes"),
    "GEOCODE_URL": os.environ.get(
        "HERE_GEOCODE_URL", "https://geocode.search.hereapi.com/v1/geocode"
    ),
    "AUTOCOMPLETE_URL": os.environ.get(
        "HERE_AUTOCOMPLETE_URL", "https://autocomplete.search.hereapi.com/v1/autocomplete"
    ),
    "ROUTES_WANTED": 3,
    "MAX_SHARED_FRACTION": 0.9,
    "VIA_FRACTIONS": (0.125, 0.15),
    "MAX_DETOUR_RATIO": 1.5,
    "MIN_QUERY_SCORE": 0.7,
    "SUGGESTIONS": 5,
    "ROUTE_TTL_S": 60 * 60,
    "GEOCODE_TTL_S": 24 * 60 * 60,
    "SUGGEST_TTL_S": 10 * 60,
}

VEHICLE: dict[str, Any] = {
    "TARE_LB": env_int("TRACTOR_TRAILER_TARE_LB", 33_000),
    "MAX_GROSS_LB": env_int("MAX_GROSS_LB", 80_000),
}

WEATHER: dict[str, Any] = {
    "URL": os.environ.get("OPEN_METEO_URL", "https://api.open-meteo.com/v1/forecast"),
    "FORECAST_DAYS": 16,
    "CHUNK_SIZE": 100,
    "MAX_WORKERS": 6,
    "TTL_S": 30 * 60,
    "SNAP_DEG": 0.05,
}

PLANNER: dict[str, Any] = {
    "MAX_DEPARTURE_DAYS": env_int("MAX_DEPARTURE_DAYS", 14),
    "DEPARTURE_GRACE_MIN": 15,
    "DISPLAY_TOLERANCE_MI": 0.05,
    "CORRIDOR_HOURS": 49,
}

INSTALLED_APPS = [
    "rest_framework",
    "planner",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.gzip.GZipMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

DATABASES: dict = {}
USE_TZ = True
TIME_ZONE = "UTC"

# LocMem evicts at 300 entries by default; one corridor alone caches about 400 forecasts.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "OPTIONS": {"MAX_ENTRIES": 3000},
    }
}

FRONTEND_DIST = Path(os.environ.get("FRONTEND_DIST", BASE_DIR.parent / "frontend" / "dist"))
WHITENOISE_ROOT = FRONTEND_DIST if FRONTEND_DIST.is_dir() else None
WHITENOISE_INDEX_FILE = True
WHITENOISE_IMMUTABLE_FILE_TEST = lambda path, url: url.startswith("/assets/")  # noqa: E731

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "UNAUTHENTICATED_USER": None,
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": os.environ.get("LOG_LEVEL", "INFO")},
    # httpx logs full request URLs, which would put the HERE key in the logs.
    "loggers": {"httpx": {"level": "WARNING"}},
}
