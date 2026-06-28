-- Cleanup orphan tips from RLS RPC smoke (non-integration prefix)
DELETE FROM tlv.tip_coin_lot_allocations
WHERE tip_id IN (SELECT id FROM tlv.tips WHERE idempotency_key LIKE 'tlv-rls-rpc-deny-%');

DELETE FROM tlv.wallet_ledger
WHERE tip_id IN (SELECT id FROM tlv.tips WHERE idempotency_key LIKE 'tlv-rls-rpc-deny-%');

DELETE FROM tlv.revenue_ledger
WHERE tip_id IN (SELECT id FROM tlv.tips WHERE idempotency_key LIKE 'tlv-rls-rpc-deny-%');

DELETE FROM tlv.creator_score_events
WHERE source_id IN (SELECT id FROM tlv.tips WHERE idempotency_key LIKE 'tlv-rls-rpc-deny-%');

DELETE FROM tlv.tips WHERE idempotency_key LIKE 'tlv-rls-rpc-deny-%';
