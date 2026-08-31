# Upload the frontend to Supabase Storage (bucket must already exist and be public).
#
#   $env:SUPABASE_SERVICE_ROLE_KEY = "..."; pwsh ./scripts/deploy-frontend.ps1
#
# One-time bucket setup (Dashboard > Storage > New bucket > name "site" > Public), or:
#   curl.exe -sS -X POST "https://<ref>.supabase.co/storage/v1/bucket" `
#     -H "Authorization: Bearer $env:SUPABASE_SERVICE_ROLE_KEY" `
#     -H "Content-Type: application/json" `
#     -d '{"name":"site","id":"site","public":true}'
param(
  [string]$Ref        = "nggfbjwpdggrezhtasys",
  [string]$Bucket     = "site",
  [string]$File       = "$PSScriptRoot/../frontend/deal-check.html",
  [string]$ObjectPath = "deal-check.html"
)

$key = $env:SUPABASE_SERVICE_ROLE_KEY
if (-not $key) {
  Write-Error "Set `$env:SUPABASE_SERVICE_ROLE_KEY first (service_role key from Dashboard > Project Settings > API)."
  exit 1
}
if (-not (Test-Path $File)) {
  Write-Error "File not found: $File  — copy deal-check.html into frontend/ first."
  exit 1
}

$uri = "https://$Ref.supabase.co/storage/v1/object/$Bucket/$ObjectPath"
Write-Host "Uploading $File  ->  $Bucket/$ObjectPath" -ForegroundColor Cyan

curl.exe -sS -X POST $uri `
  -H "Authorization: Bearer $key" `
  -H "Content-Type: text/html" `
  -H "x-upsert: true" `
  -H "Cache-Control: max-age=300" `
  --data-binary "@$File"

Write-Host "`nPublic URL:" -ForegroundColor Green
Write-Host "https://$Ref.supabase.co/storage/v1/object/public/$Bucket/$ObjectPath"
