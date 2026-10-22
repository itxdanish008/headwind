from django.urls import path, re_path

from . import views

urlpatterns = [
    path("geocode", views.geocode),
    path("place", views.place),
    path("plan", views.plan),
    path("corridor", views.corridor),
    re_path(r"^.*$", views.not_found),
]
