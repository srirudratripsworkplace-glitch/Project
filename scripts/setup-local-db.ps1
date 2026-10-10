$ErrorActionPreference = "Stop"

$databaseUrl = $env:DATABASE_URL
if (-not $databaseUrl) {
  if (Test-Path ".env.local") {
    $line = Get-Content ".env.local" | Where-Object { $_ -match "^DATABASE_URL=" } | Select-Object -First 1
    if ($line) {
      $databaseUrl = $line -replace "^DATABASE_URL=", ""
    }
  }
}

if (-not $databaseUrl) {
  throw "DATABASE_URL was not found. Add it to .env.local first."
}

$uri = [System.Uri]$databaseUrl
$userInfo = $uri.UserInfo.Split(":", 2)
$user = [System.Uri]::UnescapeDataString($userInfo[0])
$password = if ($userInfo.Length -gt 1) { [System.Uri]::UnescapeDataString($userInfo[1]) } else { "" }
$database = $uri.AbsolutePath.TrimStart("/")
$hostName = $uri.Host
$port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }

$env:PGPASSWORD = $password

$exists = psql -h $hostName -p $port -U $user -d postgres -tAc "select 1 from pg_database where datname = '$database'"
if ($exists.Trim() -ne "1") {
  createdb -h $hostName -p $port -U $user $database
}

psql -h $hostName -p $port -U $user -d $database -f "supabase/local-postgres.sql"
