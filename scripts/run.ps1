# Real run: fetch feeds, extract, dedup, and write to the deals table.
#
# Usage (Windows PowerShell 5.1):
#   $env:PIPELINE_TRIGGER_SECRET = "<the secret you set with: supabase secrets set PIPELINE_TRIGGER_SECRET=...>"
#   powershell -ExecutionPolicy Bypass -File .\scripts\run.ps1

param([string]$Ref = "nggfbjwpdggrezhtasys")

$key = $env:PIPELINE_TRIGGER_SECRET
if (-not $key) { Write-Error 'Set $env:PIPELINE_TRIGGER_SECRET first (same value as the PIPELINE_TRIGGER_SECRET Supabase secret).'; exit 1 }

$uri = "https://$Ref.supabase.co/functions/v1/daily-pipeline?wait=1"
Write-Host "POST $uri"

& curl.exe -sS -X POST $uri -H "Content-Type: application/json" -H "x-trigger-key: $key" -d "{}"
