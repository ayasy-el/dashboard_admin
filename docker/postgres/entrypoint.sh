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

POSTGRES_USER="$(read_secret postgres_user)"
POSTGRES_DB="$(read_secret postgres_db)"
POSTGRES_PASSWORD="$(read_secret postgres_password)"

export POSTGRES_USER POSTGRES_DB POSTGRES_PASSWORD

exec /usr/local/bin/docker-entrypoint.sh "$@"
