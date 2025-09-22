#!/usr/bin/env bash
set -euo pipefail

echo "[Phase3] Python checks"
python manage.py check

echo "[Phase3] NPM install and build"
npm ci
npm run build

echo "[Phase3] Collect static"
python manage.py collectstatic --noinput

echo "[Phase3] Run tests"
pytest -q || python -m django test -v 2

echo "[Phase3] Start dev server (background)"
python manage.py runserver 0.0.0.0:8000 &
SRV_PID=$!
trap 'kill ${SRV_PID} || true' EXIT
sleep 3

echo "[Phase3] Curl headers check (FEATURE_SECURITY_HEADERS=true expected)"
set +e
curl -s -D - http://127.0.0.1:8000/Super-Admin/auth/login/ -o /dev/null | grep -Ei "(content-security-policy|x-frame-options|x-content-type-options|referrer-policy)"
set -e

echo "[Phase3] Done"
