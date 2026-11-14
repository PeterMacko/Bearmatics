#!/usr/bin/env bash
# Local server for the account browser tests: built app + /api + a fresh, migrated local D1,
# plus a fake Google (scripts/fake-google.mjs) on localhost:PORT+1 (another site, like Google) so the Google flow runs in real browsers.
# Usage: scripts/accounts-server.sh <port>. Needs a built dist/ (npm run build).
set -euo pipefail
PORT=${1:-4187}
GOOGLE_PORT=$((PORT + 1))
DIR=$(mktemp -d "${TMPDIR:-/tmp}/bearmatics-accounts-XXXXXX")
CLIENT=$(node -e "import('wrangler').then((w) => console.log(w.unstable_readConfig({ config: 'wrangler.jsonc' }).vars.GOOGLE_CLIENT_ID))")
CI=1 npx wrangler d1 migrations apply DB --local --persist-to "$DIR" >/dev/null
GOOGLE_CLIENT_ID="$CLIENT" node scripts/fake-google.mjs "$GOOGLE_PORT" &
FAKE=$!
trap 'kill $FAKE 2>/dev/null || true' EXIT
npx wrangler dev --port "$PORT" --ip 127.0.0.1 --persist-to "$DIR" \
  --var GOOGLE_CLIENT_SECRET:local-test-secret --var "GOOGLE_TEST_URL:http://localhost:$GOOGLE_PORT" \
  --show-interactive-dev-session=false --log-level warn
