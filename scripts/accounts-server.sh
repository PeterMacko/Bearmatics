#!/usr/bin/env bash
# Local server for the account browser tests: built app + /api + a fresh, migrated local D1.
# Usage: scripts/accounts-server.sh <port>. Needs a built dist/ (npm run build).
set -euo pipefail
PORT=${1:-4187}
DIR=$(mktemp -d "${TMPDIR:-/tmp}/bearmatics-accounts-XXXXXX")
CI=1 npx wrangler d1 migrations apply DB --local --persist-to "$DIR" >/dev/null
exec npx wrangler dev --port "$PORT" --ip 127.0.0.1 --persist-to "$DIR" \
  --show-interactive-dev-session=false --log-level warn
