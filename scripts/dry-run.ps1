# Dry run: fetch feeds + run extraction, log what WOULD be written, make no DB changes.
#
# Usage (Windows PowerShell 5.1):
#   $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
#   powershell -ExecutionPolicy Bypass -File .\scripts\dry-run.ps1

param([string]$Ref = "nggfbjwpdggrezhtasys")

$key = $env:SUPABASE_SERVICE_ROLE_KEY
if (-not $key) { Write-Error 'Set $env:SUPABASE_SERVICE_ROLE_KEY first (service_role secret from Dashboard > Settings > API Keys).'; exit 1 }

$uri = "https://$Ref.supabase.co/functions/v1/daily-pipeline?dry_run=1"
Write-Host "POST $uri"

& curl.exe -sS -X POST $uri -H "Authorization: Bearer $key" -H "Content-Type: application/json" -d "{}"
