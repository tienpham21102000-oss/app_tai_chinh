$ErrorActionPreference = "Stop"

function Read-EnvFile($Path) {
  $values = @{}
  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim()
    if ($trimmed.Length -eq 0 -or $trimmed.StartsWith("#") -or !$trimmed.Contains("=")) {
      continue
    }
    $parts = $trimmed.Split("=", 2)
    $values[$parts[0]] = $parts[1]
  }
  return $values
}

$envValues = Read-EnvFile ".env"
$url = $envValues["EXPO_PUBLIC_SUPABASE_URL"]
$anonKey = $envValues["EXPO_PUBLIC_SUPABASE_ANON_KEY"]

if (!$url -or !$anonKey) {
  throw "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env"
}

$settingsUrl = "$url/auth/v1/settings"
$settings = Invoke-RestMethod -Uri $settingsUrl -Headers @{ apikey = $anonKey }

Write-Host "Supabase Auth provider status:"
Write-Host "  email:  $($settings.external.email)"
Write-Host "  google: $($settings.external.google)"

if ($settings.external.google -ne $true) {
  throw "Google provider is disabled in Supabase. Enable Authentication > Providers > Google, then save."
}

Write-Host "Google provider is enabled." -ForegroundColor Green
