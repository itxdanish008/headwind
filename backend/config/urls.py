from django.urls import include, path, re_path

from planner.api.views import health, not_found

from .views import spa_index

urlpatterns = [
    path("api/health", health),
    path("api/v1/", include("planner.api.urls")),
    re_path(r"^api/.*$", not_found),
    re_path(r"^(?!api/).*$", spa_index),
]
