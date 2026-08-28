param(
  [string]$Image = 'postgres:16-alpine'
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$name = 'tlv-step5l-gate02-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

function Invoke-DockerChecked {
  & docker @args
  if ($LASTEXITCODE -ne 0) { throw "docker failed: $($args -join ' ')" }
}

function Invoke-PsqlFile {
  param([string]$Database, [string]$File)
  Invoke-DockerChecked exec $name psql -q -v ON_ERROR_STOP=1 -U postgres -d $Database -f $File
}

try {
  Invoke-DockerChecked run -d --rm --network none --name $name -e POSTGRES_PASSWORD=step5l_gate02 -v "${repo}:/repo:ro" $Image
  for ($i = 0; $i -lt 30; $i++) {
    & docker exec $name pg_isready -U postgres *> $null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Milliseconds 500
  }
  if ($LASTEXITCODE -ne 0) { throw 'isolated postgres did not become ready' }

  $base = @(
    '/repo/scripts/sql/tlv-step5-isolated-auth-shim.sql',
    '/repo/db/tlv_schema.sql',
    '/repo/supabase/migrations/20260628120000_tlv_payment_phase2_rpc.sql',
    '/repo/supabase/migrations/20260628130000_tlv_payer_user_uuid.sql',
    '/repo/supabase/migrations/20260628140000_tlv_create_tip_transaction_rpc.sql',
    '/repo/supabase/migrations/20260628150000_tlv_payment_rls.sql',
    '/repo/supabase/migrations/20260628160000_tlv_payment_chargeback_clawback.sql',
    '/repo/supabase/migrations/20260813090000_tlv_payment_rls_production_ready_gate.sql',
    '/repo/scripts/sql/tlv-step5k-isolated-exact-seven-fixture.sql'
  )
  foreach ($file in $base) { Invoke-PsqlFile postgres $file }
  Invoke-DockerChecked exec $name psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres -c "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations(version text primary key)"
  Invoke-PsqlFile postgres '/repo/scripts/sql/tlv-step5l-isolated-prestate-validation.sql'
  Invoke-PsqlFile postgres '/repo/reports/sql/tlv-step5l-prod-gate-02-production-readonly-preflight.sql'

  Invoke-DockerChecked exec $name pg_dump -U postgres -d postgres -Fc --no-owner -f /tmp/gate02-pre.full.dump
  Invoke-DockerChecked exec $name pg_dump -U postgres -d postgres -s --no-owner -f /tmp/gate02-pre.schema.sql
  Invoke-DockerChecked exec $name psql -U postgres -d postgres -c "copy (select * from tlv.revenue_ledger where tip_id is not null order by id) to '/tmp/gate02-source-seven.csv' with (format csv, header true)"
  Invoke-DockerChecked exec $name sha256sum /tmp/gate02-pre.full.dump /tmp/gate02-pre.schema.sql /tmp/gate02-source-seven.csv

  # Independent progressive-boundary/RLS database. It is isolated from the
  # exact-seven OPTION_A chain so its synthetic payout fixtures cannot affect
  # the zero-legacy prerequisite.
  Invoke-DockerChecked exec $name createdb -U postgres gate02_progressive
  foreach ($file in $base[0..7]) { Invoke-PsqlFile gate02_progressive $file }
  Invoke-PsqlFile gate02_progressive '/repo/supabase/migrations/20260827210000_tlv_deterministic_monthly_settlement_v1.sql'
  Invoke-PsqlFile gate02_progressive '/repo/scripts/sql/tlv-step5-isolated-db-verify.sql'

  Invoke-PsqlFile postgres '/repo/supabase/migrations/20260827210000_tlv_deterministic_monthly_settlement_v1.sql'
  Invoke-PsqlFile postgres '/repo/scripts/sql/tlv-step5d-zero-legacy-baseline.sql'
  Invoke-PsqlFile postgres '/repo/supabase/migrations/20260827230000_tlv_option_a_zero_legacy_payout_cutover_v1.sql'
  Invoke-PsqlFile postgres '/repo/scripts/sql/tlv-step5l-progressive-option-a-payout-validation.sql'
  Invoke-PsqlFile postgres '/repo/supabase/migrations/20260828210000_tlv_synthetic_qa_disposition_v1.sql'
  Invoke-PsqlFile postgres '/repo/scripts/sql/tlv-step5k-isolated-validation.sql'
  Invoke-PsqlFile postgres '/repo/scripts/sql/tlv-step5l-prod-gate-02-full-chain-validation.sql'

  Invoke-PsqlFile postgres '/repo/supabase/migrations/20260827230000_tlv_option_a_zero_legacy_payout_cutover_v1.sql'
  Invoke-PsqlFile postgres '/repo/supabase/migrations/20260828210000_tlv_synthetic_qa_disposition_v1.sql'
  Invoke-PsqlFile postgres '/repo/scripts/sql/tlv-step5l-prod-gate-02-full-chain-validation.sql'

  Invoke-DockerChecked exec $name createdb -U postgres gate02_restored
  Invoke-DockerChecked exec $name pg_restore -U postgres -d gate02_restored --no-owner /tmp/gate02-pre.full.dump
  Invoke-PsqlFile gate02_restored '/repo/scripts/sql/tlv-step5l-isolated-prestate-validation.sql'

  Invoke-DockerChecked inspect $name --format 'network={{.HostConfig.NetworkMode}} autoremove={{.HostConfig.AutoRemove}} image={{.Config.Image}}'
  Write-Output 'TLV_STEP5L_PROD_GATE_02_ISOLATED_FULL_CHAIN: PASS'
  Write-Output 'TLV_PROGRESSIVE_BOUNDARY_DB_VALIDATION: PASS (12/12)'
  Write-Output 'PRODUCTION_ACCESSED: NO'
  Write-Output 'SHARED_STAGING_ACCESSED: NO'
  Write-Output 'REAL_FINANCIAL_TRANSACTION_EXECUTED: NO'
}
finally {
  $existing = & docker ps -aq --filter "name=^/$name$"
  if ($existing) { & docker stop $name *> $null }
}
