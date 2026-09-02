# Upload frontend/deal-check.html to a public Supabase Storage bucket.
# The bucket must already exist and be public (Dashboard > Storage > New bucket > "site", Public).
#
# Usage (Windows PowerShell 5.1):
#   $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
#   powershell -ExecutionPolicy Bypass -File .\scripts\deploy-frontend.ps1

param(
  [string]$Ref        = "nggfbjwpdggrezhtasys",
  [string]$Bucket     = "site",
  [string]$File       = "$PSScriptRoot\..\frontend\deal-check.html",
  [string]$ObjectPath = "deal-check.html"
)

$key = $env:SUPABASE_SERVICE_ROLE_KEY
if (-not $key) { Write-Error 'Set $env:SUPABASE_SERVICE_ROLE_KEY first (service_role secret from Dashboard > Settings > API Keys).'; exit 1 }
if (-not (Test-Path $File)) { Write-Error "Not found: $File"; exit 1 }

$uri = "https://$Ref.supabase.co/storage/v1/object/$Bucket/$ObjectPath"
Write-Host "Uploading $File -> $Bucket/$ObjectPath"

$curlArgs = @(
  "-sS", "-X", "POST", $uri,
  "-H", "Authorization: Bearer $key",
  "-H", "Content-Type: text/html",
  "-H", "x-upsert: true",
  "-H", "Cache-Control: max-age=300",
  "--data-binary", "@$File"
)
& curl.exe @curlArgs

Write-Host ""
Write-Host "Public URL: https://$Ref.supabase.co/storage/v1/object/public/$Bucket/$ObjectPath"
