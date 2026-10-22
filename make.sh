#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
IMAGE="${IMAGE:-headwind}"
PORT="${PORT:-8000}"
PYTHON="${PYTHON:-python3.12}"

say() { printf '\n==> %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "$1 is required but was not found"; }

load_env() {
  if [ -f "$ROOT/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$ROOT/.env"
    set +a
  fi
}

check_key() {
  load_env
  if [ -z "${HERE_API_KEY:-}" ]; then
    printf 'warning: HERE_API_KEY is empty in .env, so routing and place search will fail.\n' >&2
  fi
}

setup() {
  need "$PYTHON"
  need node
  need npm
  if [ ! -f "$ROOT/.env" ]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    say "Created .env from .env.example. Put your HERE key in HERE_API_KEY."
  fi
  say "Installing backend dependencies"
  [ -d "$BACKEND/.venv" ] || "$PYTHON" -m venv "$BACKEND/.venv"
  "$BACKEND/.venv/bin/pip" install --quiet --upgrade pip
  "$BACKEND/.venv/bin/pip" install --quiet -r "$BACKEND/requirements-dev.txt"
  say "Installing frontend dependencies"
  (cd "$FRONTEND" && npm ci)
  say "Setup finished. Run ./make.sh start"
}

backend() {
  check_key
  cd "$BACKEND"
  exec .venv/bin/python manage.py runserver "$PORT"
}

frontend() {
  cd "$FRONTEND"
  exec npm run dev
}

start() {
  [ -x "$BACKEND/.venv/bin/python" ] && [ -d "$FRONTEND/node_modules" ] || setup
  check_key
  say "Backend on http://localhost:$PORT, frontend on http://localhost:5173"
  (cd "$BACKEND" && .venv/bin/python manage.py runserver "$PORT") &
  backend_pid=$!
  (cd "$FRONTEND" && npm run dev) &
  frontend_pid=$!
  trap 'kill "$backend_pid" "$frontend_pid" 2>/dev/null || true' EXIT INT TERM
  wait
}

lint() {
  say "Backend lint"
  (cd "$BACKEND" && .venv/bin/ruff check . && .venv/bin/ruff format --check . \
    && SECRET_KEY="${SECRET_KEY:-lint-only}" DEBUG=1 .venv/bin/mypy planner config)
  say "Frontend lint"
  (cd "$FRONTEND" && npx tsc -b && npm run lint && npx prettier --check .)
}

test_all() {
  say "Backend tests"
  (cd "$BACKEND" && .venv/bin/pytest -q)
  say "Frontend tests"
  (cd "$FRONTEND" && npm test)
}

build() {
  (cd "$FRONTEND" && npm run build)
}

clean() {
  find "$ROOT" \( -name node_modules -o -name .venv \) -prune -o \
    \( -name __pycache__ -o -name .pytest_cache -o -name .ruff_cache -o -name .DS_Store \) \
    -print0 | xargs -0 rm -rf
  rm -rf "$FRONTEND/dist"
  say "Removed caches and build output. Dependencies (venv, node_modules) were kept."
}

package() {
  need zip
  need git
  local out="$ROOT/../headwind-submission.zip"
  rm -f "$out"
  (cd "$ROOT" && git ls-files --cached --others --exclude-standard -z | xargs -0 zip -q "$out")
  say "Wrote $(cd "$ROOT/.." && pwd)/headwind-submission.zip ($(unzip -Z1 "$out" | wc -l | tr -d ' ') files)"
  say "Contains only files git would track; .env, CLAUDE.md, design handoff and the brief are excluded."
}

docker_build() {
  need docker
  docker build -t "$IMAGE" "$ROOT"
}

docker_run() {
  need docker
  [ -f "$ROOT/.env" ] || die "create .env first (./make.sh setup)"
  docker image inspect "$IMAGE" >/dev/null 2>&1 || docker_build
  docker rm -f "$IMAGE" >/dev/null 2>&1 || true
  say "Serving the app at http://localhost:$PORT"
  local secret="${SECRET_KEY:-}"
  if [ -z "$secret" ] || [ "$secret" = "change-me" ]; then
    secret="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
  fi
  docker run --rm --name "$IMAGE" -p "$PORT:8000" \
    --env-file "$ROOT/.env" -e DEBUG=0 -e SECRET_KEY="$secret" "$IMAGE"
}

docker_stop() {
  need docker
  docker rm -f "$IMAGE" >/dev/null 2>&1 || true
}

usage() {
  cat <<USAGE
Usage: ./make.sh <command>

  setup         create .env, install backend and frontend dependencies
  start         run the API (port $PORT) and the web app (port 5173) together
  backend       run only the API
  frontend      run only the web app
  test          run backend and frontend tests
  lint          run ruff, mypy, tsc, eslint and prettier checks
  check         lint, then test
  build         build the frontend for production
  clean         remove caches and build output
  package       write a clean submission zip next to the project folder
  docker-build  build the Docker image ($IMAGE)
  docker-run    build if needed, then serve the app from the image on port $PORT
  docker-stop   stop the container
USAGE
}

case "${1:-help}" in
  setup) setup ;;
  start | dev) start ;;
  backend) backend ;;
  frontend) frontend ;;
  test) test_all ;;
  lint) lint ;;
  check) lint && test_all ;;
  build) build ;;
  clean) clean ;;
  package) package ;;
  docker-build) docker_build ;;
  docker-run) docker_run ;;
  docker-stop) docker_stop ;;
  help | -h | --help) usage ;;
  *) usage; exit 1 ;;
esac
