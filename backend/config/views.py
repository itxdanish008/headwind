from django.conf import settings
from django.http import FileResponse, Http404


def spa_index(request, *args, **kwargs):
    index = settings.FRONTEND_DIST / "index.html"
    if not index.is_file():
        raise Http404("The frontend has not been built")
    return FileResponse(index.open("rb"), content_type="text/html")
