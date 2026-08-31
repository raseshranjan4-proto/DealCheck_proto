#!/usr/bin/env bash
# Invoke the deployed daily-pipeline for real (writes to the DB).
#
#   SUPABASE_SERVICE_ROLE_KEY=... ./scripts/run.sh
#
set -euo pipefail

REF="${1:-nggfbjwpdggrezhtasys}"

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "Set SUPABASE_SERVICE_ROLE_KEY first (service_role key from Dashboard > Project Settings > API)." >&2
  exit 1
fi

URL="https://${REF}.supabase.co/functions/v1/daily-pipeline"
echo "POST ${URL}"

curl -sS -X POST "${URL}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}'
