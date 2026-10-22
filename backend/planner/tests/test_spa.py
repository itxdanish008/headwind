import pytest
from django.test import Client


@pytest.fixture
def built_frontend(tmp_path, settings):
    (tmp_path / "index.html").write_text("<!doctype html><title>Headwind</title>")
    settings.FRONTEND_DIST = tmp_path


@pytest.mark.parametrize(
    "path", ["/routes/dallas-tx/denver-co", "/routes/a/b/route-c", "/anything"]
)
def test_client_side_routes_get_the_app(built_frontend, path):
    response = Client().get(path)
    assert response.status_code == 200
    assert b"Headwind" in b"".join(response.streaming_content)


def test_unknown_api_paths_are_not_the_app(built_frontend):
    assert Client().get("/api/nope").status_code == 404


def test_missing_build_is_a_404(settings, tmp_path):
    settings.FRONTEND_DIST = tmp_path
    assert Client().get("/routes/a/b").status_code == 404
