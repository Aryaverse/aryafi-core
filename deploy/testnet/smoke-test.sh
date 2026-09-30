#!/usr/bin/env bash
# Copyright (c) 2026 Aryaverse. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Runs the AryaFi network smoke test (AryaFi.Test.Network.SmokeTest) against one
# Canton 3 participant, for example a Canton Network TestNet validator. See
# deploy/testnet/README.md.
#
# Required:
#   LEDGER_HOST, LEDGER_PORT   participant gRPC Ledger API
# Optional:
#   JSON_API_URL        participant JSON Ledger API, e.g. https://json-ledger-api.example.com.
#                       When set, only the production DAR is uploaded (recommended on
#                       shared networks); otherwise the test DAR is uploaded over gRPC.
#   ACCESS_TOKEN_FILE   file containing a JWT for USER_ID. The user needs ParticipantAdmin:
#                       it allocates the run's parties and grants itself CanActAs for them.
#   USER_ID             Ledger API user the token belongs to (default: daml-script)
#   TLS=true, CACRT     TLS for the gRPC Ledger API; CACRT is the trusted root CA file
#   RUN_ID              names this run's parties (default: current UTC time)
#   SKIP_UPLOAD=true    the production DAR is already on the participant

set -euo pipefail

: "${LEDGER_HOST:?set LEDGER_HOST to the participant's gRPC Ledger API host}"
: "${LEDGER_PORT:?set LEDGER_PORT to the participant's gRPC Ledger API port}"
USER_ID="${USER_ID:-daml-script}"
RUN_ID="${RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION="$(sed -n 's/^version: *//p' "$ROOT/daml.yaml")"
CORE_DAR="$ROOT/.daml/dist/aryafi-core-$VERSION.dar"
TEST_DAR="$ROOT/daml/test/.daml/dist/aryafi-core-test-$VERSION.dar"
for dar in "$CORE_DAR" "$TEST_DAR"; do
  [ -f "$dar" ] || { echo "Missing $dar: run 'dpm build --all' first." >&2; exit 1; }
done

AUTH_HEADER=()
SCRIPT_ARGS=(--ledger-host "$LEDGER_HOST" --ledger-port "$LEDGER_PORT" --user-id "$USER_ID")
if [ -n "${ACCESS_TOKEN_FILE:-}" ]; then
  AUTH_HEADER=(-H "Authorization: Bearer $(tr -d '\n' < "$ACCESS_TOKEN_FILE")")
  SCRIPT_ARGS+=(--access-token-file "$ACCESS_TOKEN_FILE")
fi
[ "${TLS:-false}" = true ] && SCRIPT_ARGS+=(--tls)
[ -n "${CACRT:-}" ] && SCRIPT_ARGS+=(--cacrt "$CACRT")

echo "AryaFi network smoke test"
echo "  participant: $LEDGER_HOST:$LEDGER_PORT   user: $USER_ID   run: $RUN_ID"
echo "  package:     aryafi-core $VERSION"

UPLOAD=yes
if [ "${SKIP_UPLOAD:-false}" = true ]; then
  UPLOAD=no
elif [ -n "${JSON_API_URL:-}" ]; then
  echo "  Canton:      $(curl -sf ${AUTH_HEADER[@]+"${AUTH_HEADER[@]}"} "$JSON_API_URL/v2/version" | sed -n 's/.*"version" *: *"\([^"]*\)".*/\1/p')"
  echo "Uploading the production DAR through the JSON Ledger API..."
  curl -sf ${AUTH_HEADER[@]+"${AUTH_HEADER[@]}"} -X POST "$JSON_API_URL/v2/dars?vetAllPackages=true" \
    -H "Content-Type: application/octet-stream" --data-binary @"$CORE_DAR" > /dev/null
  UPLOAD=no
else
  echo "JSON_API_URL not set: the script runner uploads the test DAR (it includes the production package)."
fi

INPUT="$(mktemp)"
trap 'rm -f "$INPUT"' EXIT
# With a token, the script grants USER_ID the right to act as the parties it allocates.
if [ -n "${ACCESS_TOKEN_FILE:-}" ]; then
  printf '{"runId": "%s", "userId": "%s"}' "$RUN_ID" "$USER_ID" > "$INPUT"
else
  printf '{"runId": "%s", "userId": null}' "$RUN_ID" > "$INPUT"
fi

dpm script --dar "$TEST_DAR" --upload-dar="$UPLOAD" \
  --script-name AryaFi.Test.Network.SmokeTest:runNetworkSmokeTest \
  --input-file "$INPUT" "${SCRIPT_ARGS[@]}"

echo "Smoke test passed (run $RUN_ID): five parties allocated, one DvP settled atomically."
