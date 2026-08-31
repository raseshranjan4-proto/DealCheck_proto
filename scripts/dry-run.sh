#!/usr/bin/env bash
# Invoke the deployed daily-pipeline with ?dry_run=1 — fetches feeds and runs extraction,
# logs what it WOULD write, makes no DB changes.
#
#   SUPABASE_SERVICE_ROLE_KEY=... ./scripts/dry-run.sh
#
set -euo pipefail

REF="${1:-nggfbjwpdggrezhtasys}"

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "Set SUPABASE_SERVICE_ROLE_KEY first (service_role key from Dashboard > Project Settings > API)." >&2
  exit 1
fi

URL="https://${REF}.supabase.co/functions/v1/daily-pipeline?dry_run=1"
echo "POST ${URL}"

curl -sS -X POST "${URL}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}'
