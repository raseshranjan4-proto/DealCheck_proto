# Invoke the deployed daily-pipeline for real (writes to the DB).
#
#   $env:SUPABASE_SERVICE_ROLE_KEY = "..."; pwsh ./scripts/run.ps1
#
param(
  [string]$Ref = "nggfbjwpdggrezhtasys"
)

$key = $env:SUPABASE_SERVICE_ROLE_KEY
if (-not $key) {
  Write-Error "Set `$env:SUPABASE_SERVICE_ROLE_KEY first (service_role key from Dashboard > Project Settings > API)."
  exit 1
}

$uri = "https://$Ref.supabase.co/functions/v1/daily-pipeline"
Write-Host "POST $uri" -ForegroundColor Cyan

curl.exe -sS -X POST $uri `
  -H "Authorization: Bearer $key" `
  -H "Content-Type: application/json" `
  -d "{}"
