#!/bin/sh

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
compose_file="${script_dir}/docker-compose.yml"

: "${APP_IMAGE:?Set APP_IMAGE to an immutable production image reference}"

docker compose -f "${compose_file}" pull
docker compose -f "${compose_file}" run --rm --no-deps migration
docker compose -f "${compose_file}" up -d --no-deps app
