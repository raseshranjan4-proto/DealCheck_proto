#!/usr/bin/env bash
# Dry run: fetch feeds + run extraction, log what WOULD be written, no DB changes.
#
#   PIPELINE_TRIGGER_SECRET=... ./scripts/dry-run.sh
#
set -euo pipefail

REF="${1:-nggfbjwpdggrezhtasys}"

if [ -z "${PIPELINE_TRIGGER_SECRET:-}" ]; then
  echo "Set PIPELINE_TRIGGER_SECRET first (same value as the Supabase secret)." >&2
  exit 1
fi

URL="https://${REF}.supabase.co/functions/v1/daily-pipeline?dry_run=1"
echo "POST ${URL}"

curl -sS -X POST "${URL}" \
  -H "Content-Type: application/json" \
  -H "x-trigger-key: ${PIPELINE_TRIGGER_SECRET}" \
  -d '{}'
