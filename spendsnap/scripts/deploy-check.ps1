param(
  [switch]$SkipExpoDoctor
)

$ErrorActionPreference = "Stop"

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Read-EnvFile($Path) {
  $values = @{}
  if (!(Test-Path $Path)) {
    return $values
  }

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

Write-Step "Checking required files"
$requiredFiles = @(
  ".env",
  ".env.example",
  "app.json",
  "eas.json",
  "supabase.sql",
  "supabase/functions/ai-expense/index.ts"
)

foreach ($file in $requiredFiles) {
  if (!(Test-Path $file)) {
    throw "Missing required file: $file"
  }
  Write-Host "OK $file"
}

Write-Step "Checking Expo env"
$envValues = Read-EnvFile ".env"
$requiredEnv = @("EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_SEED_DEMO_DATA", "EXPO_PUBLIC_ENABLE_GOOGLE_AUTH")
foreach ($key in $requiredEnv) {
  if (!$envValues.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envValues[$key])) {
    throw "Missing $key in .env"
  }
  Write-Host "OK $key"
}

if ($envValues["EXPO_PUBLIC_SUPABASE_URL"] -match "your-project|YOUR_PROJECT|example") {
  throw "EXPO_PUBLIC_SUPABASE_URL is still a placeholder. Put the real Supabase Project URL in .env."
}

if ($envValues["EXPO_PUBLIC_SUPABASE_ANON_KEY"] -match "your_supabase|YOUR_SUPABASE|anon_key_here") {
  throw "EXPO_PUBLIC_SUPABASE_ANON_KEY is still a placeholder. Put the real Supabase anon key in .env."
}

if ($envValues.ContainsKey("OPENAI_API_KEY")) {
  Write-Warning "OPENAI_API_KEY is present in .env. Remove it before production builds; set it as a Supabase secret instead."
}

Write-Step "Checking CLIs"
npx supabase --version
eas --version

Write-Step "TypeScript"
npx tsc --noEmit

if (!$SkipExpoDoctor) {
  Write-Step "Expo Doctor"
  npx expo-doctor
}

Write-Step "Done"
Write-Host "Deploy readiness checks passed. Next: link Supabase, set secrets, deploy the Edge Function, then run EAS build." -ForegroundColor Green
