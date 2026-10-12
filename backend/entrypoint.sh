#!/bin/sh
set -e

APPS="accounts schools students academics attendance assessments billing payments notifications communications audit"

if [ -n "$POSTGRES_HOST" ]; then
  echo "Waiting for Postgres at $POSTGRES_HOST:${POSTGRES_PORT:-5432}..."
  while ! nc -z "$POSTGRES_HOST" "${POSTGRES_PORT:-5432}"; do sleep 1; done
fi

# Only the web service migrates; worker/beat containers set RUN_MIGRATIONS=0.
if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  if [ "${AUTO_MAKEMIGRATIONS:-0}" = "1" ]; then
    # Dev only: generate missing migrations into the bind-mounted source tree. Commit them.
    python manage.py makemigrations $APPS
  else
    for app in $APPS; do
      ls "apps/$app/migrations/"0001_*.py >/dev/null 2>&1 || {
        echo "FATAL: no migrations committed for '$app'. Run scripts/generate_migrations.sh, commit the files, rebuild." >&2
        exit 1
      }
    done
  fi
  python manage.py migrate --noinput
fi

exec "$@"
