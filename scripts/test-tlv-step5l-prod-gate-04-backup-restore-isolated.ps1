param(
  [string]$Image = 'postgres:17.6-alpine'
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$name = 'tlv-step5l-gate04-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

function Invoke-DockerChecked {
  & docker @args
  if ($LASTEXITCODE -ne 0) { throw "docker failed: $($args -join ' ')" }
}

function Invoke-PsqlFile {
  param([string]$Database, [string]$File)
  Invoke-DockerChecked exec $name psql -q -v ON_ERROR_STOP=1 -U postgres -d $Database -f $File
}

try {
  Invoke-DockerChecked run -d --rm --network none --name $name -e POSTGRES_PASSWORD=gate04 -v "${repo}:/repo:ro" $Image
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
    '/repo/supabase/migrations/20260628160000_tlv_payment_chargeback_clawback.sql',
    '/repo/scripts/sql/tlv-step5k-isolated-exact-seven-fixture.sql'
  )) { Invoke-PsqlFile postgres $file }

  Invoke-DockerChecked exec $name psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres -c "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations(version text primary key)"
  Invoke-PsqlFile postgres '/repo/reports/sql/tlv-step5l-prod-gate-04-production-readonly-preflight.sql'

  Invoke-DockerChecked exec $name pg_dump -U postgres -d postgres -Fc --no-owner -f /tmp/gate04-pre.full.dump
  Invoke-DockerChecked exec $name pg_dump -U postgres -d postgres -s --no-owner -f /tmp/gate04-pre.schema.sql
  Invoke-DockerChecked exec $name psql -U postgres -d postgres -c "copy (select rl.* from tlv.revenue_ledger rl join tlv.tips t on t.id=rl.tip_id where t.idempotency_key in ('tlv-staging-tip-01','tlv-staging-tip-02','tlv-staging-tip-03-1','tlv-staging-tip-03-2','tlv-staging-tip-03-3','tlv-staging-tip-08a','tlv-staging-tip-08b') order by rl.id) to '/tmp/gate04-source-seven.csv' with (format csv, header true)"
  Invoke-DockerChecked exec $name chmod 600 /tmp/gate04-pre.full.dump /tmp/gate04-pre.schema.sql /tmp/gate04-source-seven.csv
  Invoke-DockerChecked exec $name stat -c '%a %s %n' /tmp/gate04-pre.full.dump /tmp/gate04-pre.schema.sql /tmp/gate04-source-seven.csv
  Invoke-DockerChecked exec $name sha256sum /tmp/gate04-pre.full.dump /tmp/gate04-pre.schema.sql /tmp/gate04-source-seven.csv
  Invoke-DockerChecked exec $name pg_restore --list /tmp/gate04-pre.full.dump

  Invoke-DockerChecked exec $name createdb -U postgres gate04_restored
  Invoke-DockerChecked exec $name pg_restore -U postgres -d gate04_restored --no-owner /tmp/gate04-pre.full.dump
  Invoke-PsqlFile gate04_restored '/repo/reports/sql/tlv-step5l-prod-gate-04-production-readonly-preflight.sql'
  Invoke-DockerChecked exec $name psql -U postgres -d gate04_restored -At -c "select count(*)=7 and sum(rl.gross_amount_jpy)=145000 and sum(rl.creator_payout_jpy)=0 from tlv.revenue_ledger rl join tlv.tips t on t.id=rl.tip_id where t.idempotency_key in ('tlv-staging-tip-01','tlv-staging-tip-02','tlv-staging-tip-03-1','tlv-staging-tip-03-2','tlv-staging-tip-03-3','tlv-staging-tip-08a','tlv-staging-tip-08b')"

  Invoke-DockerChecked inspect $name --format 'network={{.HostConfig.NetworkMode}} autoremove={{.HostConfig.AutoRemove}} image={{.Config.Image}}'
  Write-Output 'TLV_STEP5L_PROD_GATE_04_BACKUP_RESTORE_ISOLATED: PASS'
  Write-Output 'BACKUP_FILE_MODE: 600'
  Write-Output 'RESTORE_TARGET: SEPARATE_DATABASE'
  Write-Output 'PRODUCTION_ACCESSED: NO'
  Write-Output 'SHARED_STAGING_ACCESSED: NO'
  Write-Output 'REAL_FINANCIAL_TRANSACTION_EXECUTED: NO'
}
finally {
  $existing = & docker ps -aq --filter "name=^/$name$"
  if ($existing) { & docker stop $name *> $null }
}
