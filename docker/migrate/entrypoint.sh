#!/bin/sh
set -eu

read_secret() {
  secret_name="$1"
  file="/run/secrets/$secret_name"

  if [ -f "$file" ]; then
    cat "$file"
    return 0
  fi

  return 1
}

if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="$(read_secret database_url || true)"
  export DATABASE_URL
fi

exec "$@"
