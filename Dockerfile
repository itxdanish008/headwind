FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    FRONTEND_DIST=/app/frontend/dist \
    PORT=8000
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt
COPY backend/ ./
COPY --from=frontend /app/frontend/dist /app/frontend/dist
RUN python -m whitenoise.compress /app/frontend/dist
RUN useradd --system --create-home headwind
USER headwind
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/api/health')"
# One worker with threads, so the in-memory weather and route cache is shared by every request.
CMD ["sh", "-c", "exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT} --workers 1 --threads 8 --timeout 90"]
