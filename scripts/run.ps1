# Real run: fetch feeds, extract, dedup, and write to the deals table.
#
# Usage (Windows PowerShell 5.1):
#   $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
#   powershell -ExecutionPolicy Bypass -File .\scripts\run.ps1

param([string]$Ref = "nggfbjwpdggrezhtasys")

$key = $env:SUPABASE_SERVICE_ROLE_KEY
if (-not $key) { Write-Error 'Set $env:SUPABASE_SERVICE_ROLE_KEY first (service_role secret from Dashboard > Settings > API Keys).'; exit 1 }

$uri = "https://$Ref.supabase.co/functions/v1/daily-pipeline"
Write-Host "POST $uri"

& curl.exe -sS -X POST $uri -H "Authorization: Bearer $key" -H "Content-Type: application/json" -d "{}"
