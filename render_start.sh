#!/usr/bin/env bash
set -e
cd backend
echo "=== Running database migrations ==="
alembic upgrade head || true
echo "=== Starting Uvicorn ==="
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
