param(
  [string]$Image = 'postgres:17.6-alpine'
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$name = 'tlv-step5l-gate03-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

function Invoke-DockerChecked {
  & docker @args
  if ($LASTEXITCODE -ne 0) { throw "docker failed: $($args -join ' ')" }
}

function Invoke-PsqlFile {
  param([string]$File)
  Invoke-DockerChecked exec $name psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres -f $File
}

try {
  Invoke-DockerChecked run -d --rm --network none --name $name -e POSTGRES_PASSWORD=gate03 -v "${repo}:/repo:ro" $Image
  for ($i = 0; $i -lt 30; $i++) {
    & docker exec $name pg_isready -U postgres *> $null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Milliseconds 500
  }
  if ($LASTEXITCODE -ne 0) { throw 'isolated postgres did not become ready' }

  foreach ($file in @(
    '/repo/scripts/sql/tlv-step5-isolated-auth-shim.sql',
    '/repo/db/tlv_schema.sql',
    '/repo/supabase/migrations/20260628120000_tlv_payment_phase2_rpc.sql',
    '/repo/supabase/migrations/20260628130000_tlv_payer_user_uuid.sql',
    '/repo/supabase/migrations/20260628140000_tlv_create_tip_transaction_rpc.sql',
    '/repo/supabase/migrations/20260628150000_tlv_payment_rls.sql',
    '/repo/supabase/migrations/20260628160000_tlv_payment_chargeback_clawback.sql'
  )) { Invoke-PsqlFile $file }

  Invoke-DockerChecked exec $name psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres -c "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations(version text primary key)"
  Invoke-PsqlFile '/repo/reports/sql/tlv-step5l-prod-gate-03-shared-staging-readonly-preflight.sql'
  Invoke-DockerChecked inspect $name --format 'network={{.HostConfig.NetworkMode}} autoremove={{.HostConfig.AutoRemove}} image={{.Config.Image}}'

  Write-Output 'TLV_STEP5L_PROD_GATE_03_READONLY_PREFLIGHT_ISOLATED: PASS'
  Write-Output 'PRODUCTION_ACCESSED: NO'
  Write-Output 'SHARED_STAGING_ACCESSED: NO'
  Write-Output 'DB_MUTATION_OUTSIDE_DISPOSABLE_CONTAINER: NO'
}
finally {
  $existing = & docker ps -aq --filter "name=^/$name$"
  if ($existing) { & docker stop $name *> $null }
}
