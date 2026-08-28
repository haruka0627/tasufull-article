param(
  [string]$Image = 'postgres:17.6-alpine'
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$name = 'tlv-gate04-control-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

function Invoke-DockerChecked {
  & docker @args
  if ($LASTEXITCODE -ne 0) { throw "docker failed: $($args -join ' ')" }
}

function Wait-ForFreeze {
  param([string]$ApplicationName)
  for ($i = 0; $i -lt 40; $i++) {
    $pidValue = & docker exec $name psql -U postgres -d postgres -At -c "select pid from pg_stat_activity where application_name='$ApplicationName' and state='idle in transaction' limit 1"
    if ($LASTEXITCODE -eq 0 -and $pidValue) { return $pidValue.Trim() }
    Start-Sleep -Milliseconds 250
  }
  throw "freeze session did not become ready: $ApplicationName"
}

function Start-FreezeSession {
  param([string]$ApplicationName, [int]$HoldSeconds)
  $shell = "mkfifo /tmp/$ApplicationName.pipe; psql -U postgres -d postgres < /tmp/$ApplicationName.pipe > /tmp/$ApplicationName.out 2>&1 & exec 3>/tmp/$ApplicationName.pipe; sed 's/tlv_gate04_writer_freeze_v1/$ApplicationName/' /repo/reports/sql/tlv-step5l-prod-gate-04-writer-freeze-control.sql >&3; sleep $HoldSeconds; printf 'rollback;\n' >&3; exec 3>&-; wait"
  Invoke-DockerChecked exec -d $name sh -c $shell
}

try {
  Invoke-DockerChecked run -d --rm --network none --name $name -e POSTGRES_PASSWORD=gate04 -v "${repo}:/repo:ro" $Image
  for ($i = 0; $i -lt 30; $i++) {
    & docker exec $name pg_isready -U postgres *> $null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Milliseconds 500
  }
  if ($LASTEXITCODE -ne 0) { throw 'isolated postgres did not become ready' }

  Invoke-DockerChecked exec $name psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres -f /repo/scripts/sql/tlv-step5l-gate04-freeze-fixture.sql

  Start-FreezeSession 'gate04_normal_freeze' 5
  $normalPid = Wait-ForFreeze 'gate04_normal_freeze'

  $lockCount = & docker exec $name psql -U postgres -d postgres -At -c "select count(*) from pg_locks where pid=$normalPid and locktype='relation' and mode='ShareLock' and granted"
  if ($LASTEXITCODE -ne 0 -or [int]$lockCount -ne 25) { throw "expected 25 granted ShareLocks, got $lockCount" }

  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & docker exec $name psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "set lock_timeout='500ms'; insert into tlv.tips default values" *> $null
  $insertBlocked = $LASTEXITCODE
  & docker exec $name psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "set lock_timeout='500ms'; update tlv.tips set id=id where id=1" *> $null
  $updateBlocked = $LASTEXITCODE
  & docker exec $name psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "set lock_timeout='500ms'; delete from tlv.tips where id=1" *> $null
  $deleteBlocked = $LASTEXITCODE
  & docker exec $name psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "set lock_timeout='500ms'; select tlv.gate04_synthetic_tip_rpc()" *> $null
  $rpcBlocked = $LASTEXITCODE
  & docker exec $name psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "set lock_timeout='500ms'; begin; insert into public.gate04_unlocked_probe default values; insert into tlv.tips default values; commit" *> $null
  $partialTransactionBlocked = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorAction
  foreach ($result in @($insertBlocked, $updateBlocked, $deleteBlocked, $rpcBlocked, $partialTransactionBlocked)) {
    if ($result -eq 0) { throw 'a writer unexpectedly succeeded while freeze was active' }
  }

  $readCount = & docker exec $name psql -U postgres -d postgres -At -c "select count(*) from tlv.tips"
  if ($LASTEXITCODE -ne 0 -or [int]$readCount -ne 1) { throw 'SELECT did not remain available during freeze' }
  $partialCount = & docker exec $name psql -U postgres -d postgres -At -c "select count(*) from public.gate04_unlocked_probe"
  if ($LASTEXITCODE -ne 0 -or [int]$partialCount -ne 0) { throw 'multi-table writer exposed a partial committed side effect' }

  Invoke-DockerChecked exec $name pg_dump -U postgres -d postgres -Fc --no-owner -f /tmp/gate04-lock-compatible.dump
  Invoke-DockerChecked exec $name pg_restore --list /tmp/gate04-lock-compatible.dump

  for ($i = 0; $i -lt 40; $i++) {
    $remaining = & docker exec $name psql -U postgres -d postgres -At -c "select count(*) from pg_stat_activity where pid=$normalPid"
    if ($LASTEXITCODE -eq 0 -and [int]$remaining -eq 0) { break }
    Start-Sleep -Milliseconds 250
  }
  if ([int]$remaining -ne 0) { throw 'normal rollback did not release freeze session' }

  Invoke-DockerChecked exec $name psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres -c "select tlv.gate04_synthetic_tip_rpc(); insert into public.live_tips(broadcast_id) values (1)"
  $rpcLedgerCount = & docker exec $name psql -U postgres -d postgres -At -c "select count(*) from tlv.revenue_ledger"
  $triggerCount = & docker exec $name psql -U postgres -d postgres -At -c "select tip_count from public.live_broadcasts where id=1"
  if ($LASTEXITCODE -ne 0 -or [int]$rpcLedgerCount -ne 1 -or [int]$triggerCount -ne 1) { throw 'RPC/trigger post-unfreeze health failed' }

  Start-FreezeSession 'gate04_emergency_freeze' 30
  $emergencyPid = Wait-ForFreeze 'gate04_emergency_freeze'
  $terminated = & docker exec $name psql -U postgres -d postgres -At -c "select pg_terminate_backend($emergencyPid)"
  if ($LASTEXITCODE -ne 0 -or $terminated.Trim() -ne 't') { throw 'emergency backend termination failed' }

  Start-Sleep -Milliseconds 500
  $emergencyLocks = & docker exec $name psql -U postgres -d postgres -At -c "select count(*) from pg_locks where pid=$emergencyPid"
  if ($LASTEXITCODE -ne 0 -or [int]$emergencyLocks -ne 0) { throw 'emergency unfreeze left locks behind' }

  Invoke-DockerChecked exec $name psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres -c "insert into tlv.tips default values"
  $tipCount = & docker exec $name psql -U postgres -d postgres -At -c "select count(*) from tlv.tips"
  if ($LASTEXITCODE -ne 0 -or [int]$tipCount -ne 3) { throw "post-unfreeze DML health failed: $tipCount" }

  Invoke-DockerChecked inspect $name --format 'network={{.HostConfig.NetworkMode}} autoremove={{.HostConfig.AutoRemove}} image={{.Config.Image}}'
  Write-Output 'TLV_GATE04_OPERATIONAL_CONTROL_ISOLATED: PASS'
  Write-Output 'REQUIRED_AND_AUXILIARY_LOCKS: PASS (25/25)'
  Write-Output 'DML_BLOCKED_DURING_FREEZE: PASS'
  Write-Output 'INSERT_UPDATE_DELETE_BLOCKED: PASS'
  Write-Output 'SELECT_DURING_FREEZE: PASS'
  Write-Output 'RPC_TRIGGER_TRANSACTION_COVERAGE: PASS'
  Write-Output 'PARTIAL_WRITE_RISK: NONE'
  Write-Output 'PG_DUMP_COMPATIBLE_DURING_FREEZE: PASS'
  Write-Output 'NORMAL_UNFREEZE: PASS'
  Write-Output 'EMERGENCY_UNFREEZE: PASS'
  Write-Output 'POST_UNFREEZE_HEALTH: PASS'
  Write-Output 'PRODUCTION_ACCESSED: NO'
  Write-Output 'SHARED_STAGING_ACCESSED: NO'
}
finally {
  $existing = & docker ps -aq --filter "name=^/$name$"
  if ($existing) { & docker stop $name *> $null }
}
