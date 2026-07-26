# ANPI Phase 2 — Data Foundation Implementation

**日付:** 2026-07-26  
**正本:** [`docs/ANPI_PRD.md`](../docs/ANPI_PRD.md)  
**状態:** Implemented locally / not deployed / migration 未適用  
**対象:** DB schema · RLS · RPC · SQL test · repository verification  
**対象外:** UI · client JS · TALK / LINE · scheduler · 通知送信 · pricing

## 1. Git 開始状態

| 項目 | 値 |
| --- | --- |
| HEAD | `568e2bb9ac4ae6e58c7eca57f4e757e5a2def78f` |
| branch | `cf-pages-deploy` |
| staged | 0 |
| unstaged | 410 |
| untracked | 413 |

既存 dirty には `deploy/cloudflare/dist/anpi-*` と複数の無関係な
`supabase/migrations/*` があった。本 Phase はそれらを編集・削除・stage していない。
新 migration は既存最新 `20260727010000` と衝突しない
`20260727020000` を使用する。

## 2. Existing schema inventory

| Asset | 現在の責務 | Phase 2 判断 | 理由 |
| --- | --- | --- | --- |
| `anpi_user_contexts` | text の利用者/契約者 ID · LINE · legacy 通知設定 | legacy 維持 | `call_only`、JSON metadata、text ID に既存 UI が依存 |
| `anpi_check_sessions` | 旧未応答フロー 1 回 1 行 | legacy 維持 | `pending` 等の旧語彙 · 日次 unique なし · text ID |
| `anpi_notification_logs` | 利用者通知履歴 + LINE 配信状態 | legacy 履歴として維持 | delivery / history / provider state が混在 |
| `anpi_no_response_audit_log` | 旧 CTA / 未応答監査 | legacy 維持 | action 語彙が `talk_call` 等の旧フロー |
| `anpi-rls-production.sql` | legacy member ID RLS helper | 新 UUID RLS へ流用しない | `auth.uid()` UUID と legacy member text の境界が異なる |
| `anpi-no-response-phase2-rls.sql` | 旧 dev/prod policy | 新基盤へ流用しない | dev 全許可 policy と contract-holder status 更新を含む |

### Reuse decision

Frozen v1 の列/status を ALTER・UPDATE せず、Phase 2 正本用に UUID/auth 境界の
新テーブルを作成した。これは類似機能の無条件な重複ではなく、次の互換性リスクを
分離する移行レーンである。

- legacy は TASFUL 独自 text ID、新 Phase 2 は `auth.users.id` UUID
- legacy `anpi_check_sessions` は同一利用者 1 active のみで、日次キーを持たない
- legacy RLS は client に status 更新を許す設計
- legacy 通知ログは利用者履歴と provider delivery が混在
- 既存データの意味を推測して canonical status へ UPDATE できない

## 3. Data architecture

| Object | 責務 |
| --- | --- |
| `anpi_settings` | 時刻 · 曜日 · reminder · deadline · pause の正本 |
| `anpi_check_instances` | `subject_user_id + local_check_date` の当日確認 |
| `anpi_contacts` | 緊急連絡先関係と consent state |
| `anpi_contact_invitations` | hash-only · expiry · single-use 招待 |
| `anpi_notification_deliveries` | チャネル別 queue / delivery / failure |
| `anpi_audit_logs` | safe identifier/status の追記監査 |
| `anpi_legacy_check_status_mapping` | legacy→canonical の参照 view（変換はしない） |

### Settings

- `owner_user_id` と `subject_user_id` を分離
- Phase 2 client self-service は安全のため `owner = subject = auth.uid()` のみ
- 家族管理型 owner/subject 分離は、同意ワークフロー確定後の reviewed service
  workflow に限定
- `timezone = Asia/Tokyo`
- `schedule_type = daily | weekdays`
- 曜日は重複なしの 1〜7、reminder は 0〜2 回
- `deleted_at is null` の subject ごとに 1 setting
- disabled / paused / deleted を別列で保持

### Daily check

- 新 `anpi_check_instances` を採用し、legacy sessions は変更しない
- canonical status:
  `scheduled / notified / reminded / overdue / contact_notified /
  confirmed / confirmed_late / paused / cancelled`
- `delivery_failed` は含めない
- `UNIQUE (subject_user_id, local_check_date)`
- 各進行状態に対応する timestamp を CHECK
- terminal: `confirmed / confirmed_late / cancelled`
- trigger が不正遷移と初回 `confirmed_at` の改変を拒否
- setting/check/contact/invitation/delivery の識別・冪等キーは更新不可

### Contacts / invitations

通知可能条件:

```text
status = active
AND accepted_at IS NOT NULL
AND revoked_at IS NULL
AND deleted_at IS NULL
```

- 複数連絡先: `priority 1..10`
- 平文氏名・メール・電話は新規保存しない
- 表示ラベルが必要な場合のみ `display_name_enc`
- invitation は SHA-256 hex `token_hash` のみ保存
- expiration · single result · one open invitation per contact
- invitee 本人だけが accept / decline
- owner または contact 本人が revoke

### Deliveries

- statuses: `queued / sent / delivered / failed / skipped / cancelled`
- kinds: `initial / reminder / contact_unconfirmed / late_confirmation / system_notice`
- channels: `talk / line / push / email / sms`
- unique: `(check_id, recipient_user_id, channel, kind)`
- contact delivery trigger が active consent を DB 側でも検証
- Phase 2 は記録基盤のみで、実送信は行わない

## 4. Legacy status mapping

| Legacy | Canonical | Treatment |
| --- | --- | --- |
| `pending` | `scheduled` | safe mapping 候補 |
| `sent_to_user` | `notified` | timestamp review |
| `answered` | `confirmed` | `responded_at` 必須 |
| `no_response` | `overdue` | 自動変換禁止 · manual review |
| `family_notified` | `contact_notified` | 実 delivery evidence 必須 |
| `handled` | `cancelled` | manual review |
| `escalated` | `contact_notified` | 自動変換禁止 |
| `expired` | `cancelled` | manual review |

Migration は legacy 行を UPDATE しない。mapping view も `service_role` read のみ。

## 5. State transition protection

許可:

```text
scheduled -> notified | confirmed | paused | cancelled
notified -> reminded | confirmed | cancelled
reminded -> overdue | confirmed | cancelled
overdue -> contact_notified | confirmed | cancelled
contact_notified -> confirmed_late | cancelled
paused -> scheduled | cancelled
same state -> same state
```

`confirmed` / `confirmed_late` / `cancelled` からの遷移はない。
`contact_notified -> confirmed` は拒否し、`confirmed_late` のみ許可する。

## 6. Idempotency

### Confirm

`anpi_confirm_check(check_id, source)`:

- `SECURITY DEFINER` + fixed `search_path`
- raw user ID を引数で受けず `auth.uid()` を使用
- subject 本人のみ
- source は `anpi_ui | talk`
- 初回だけ timestamp / status / audit を記録
- 再実行は既存 result + `duplicate=true`
- `contact_notified` 後は `confirmed_late`
- paused / cancelled は拒否

### Scheduler foundation

`anpi_create_daily_check(setting_id, local_date, scheduled_at)`:

- `service_role` のみ EXECUTE
- enabled / not deleted / pause window を検査
- natural unique + `ON CONFLICT` により二重 Cron は同じ ID を返す
- scheduler / cron 自体は未実装

## 7. RLS and grants

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| settings | owner / subject | self owner=subject | self owner=subject | なし（soft delete） |
| checks | owner / subject | client なし | client なし | なし |
| contacts | owner / subject / contact | self pending | RPC のみ | なし |
| invitations | safe summary RPC（hash 非公開） | self inviter | response RPC のみ | なし |
| deliveries | recipient のみ | client なし | client なし | なし |
| audit | client なし | client なし | なし | なし |

Active contact の安否参照は全 row SELECT ではなく、最小列だけを返す
`anpi_contact_check_summary()` を使用する。
招待一覧も table SELECT を許可せず、`token_hash` を除外した
`anpi_contact_invitation_summaries()` を使用する。

`FORCE ROW LEVEL SECURITY` は意図的に使用しない。理由は、固定 `search_path`、
明示 revoke/grant、内部認可を持つ限定 `SECURITY DEFINER` RPC が owner bypass を
必要とするため。一般 client の table grants/policies は最小化した。

## 8. Security

- 全 6 table RLS enabled
- SECURITY DEFINER は `search_path = pg_catalog, public`
- user RPC は `public, anon` EXECUTE revoke
- scheduler RPC は `public, anon, authenticated` revoke + `service_role` grant
- confirm / invitation / revoke は `auth.uid()` を内部検証
- token は 64 hex hash のみ。raw token は DB に保存・監査しない
- audit payload は ID/status/channel/kind 等の safe fields のみ
- provider failure detail は 500 文字上限の safe text
- 新規 plaintext email / phone / name 列なし
- timezone / weekdays / reminder / priority / statuses を CHECK
- soft-deleted row は client policy と通知 eligibility から除外
- API rate limit は Phase 3 API 層の依存。DB migration 単体では実装しない

## 9. Migration

**File:** `supabase/migrations/20260727020000_anpi_phase2_data_foundation.sql`

- create: 6 tables · mapping view · helper/guard/RPC functions · triggers · policies
- alter: 新規テーブルの RLS enable のみ
- legacy object ALTER / DROP / UPDATE: なし
- destructive changes: なし
- Production apply: **未適用・未実施**
- Staging apply: **未適用・未実施**
- dist mirror: migration/docs に必須の dist 規則は確認できず、推測同期なし

## 10. Tests

### Repository static verification

```text
node scripts/test-anpi-phase2-data-foundation.mjs
→ 50 PASS / 0 FAIL
```

Static verification passed.
DB-backed SQL and real JWT runtime verification remain pending.

Migration object、canonical states、delivery failure 分離、unique、timezone、
token hash、RLS、fixed search_path、grant、legacy 非破壊、secret、scope、PRD
整合を検査する。

### DB-backed SQL

```text
supabase/tests/anpi_phase2_data_foundation.sql
```

30 assertions:

- settings / schedule constraints
- daily unique
- transition / terminal behavior
- confirm idempotency / auth
- invitation expiry / single-use / invitee auth
- consent delivery gate / revoke
- delivery failure separation
- audit safe fields
- RLS own/other / direct write denial
- Critical/High regressions (`notified→overdue`, overdue summary hidden, cross-subject delivery, check_id rebind, concrete sqlerrm)

ローカル環境には Supabase CLI はあるが Docker / `psql` がなく、DB-backed test は
この実装セッションでは実行不能。静的 PASS を DB-backed PASS として扱わない。

`supabase db lint --local --level error` も試行したが、ローカル PostgreSQL
`127.0.0.1:54322` が未起動のため接続拒否。migration は適用されていない。

## 11. Limitations and review gates

1. DB-backed SQL は disposable local Supabase で実行が必要
2. migration は Staging schema diff / review 後にのみ適用候補
3. legacy production row の mapping は実データを読まず自動変換しない
4. managed owner/subject の consent モデルは Phase 3 前に別レビュー
5. rate limit は将来 API 層で必須
6. delivery provider / scheduler / notification は未実装
7. v1 UI・LINE・TALK・FROZEN 状態は変更していない

## 12. Recommended commit split

1. `feat(anpi): add Phase 2 data foundation schema`
   - migration
2. `test(anpi): verify Phase 2 data foundation`
   - SQL test · repository verification
3. `docs(anpi): record Phase 2 data foundation`
   - PRD status · this report

Stage / commit は本タスクでは行わない。

## 13. Review / Security Critical-High closure

Sources:
- Review `c6b7bf62-f11e-4efb-b8e2-89efaf8f40b1`
- Security Review `fa8637f4-8fae-45cd-97e0-c89ef209f702`
- Audit `cbcb8477-ef9f-4a96-b37b-70a60939e2f9` — additive new-table path confirmed; no extra change

| Finding | Severity | Fix | Regression |
| --- | --- | --- | --- |
| Contact summary exposed `overdue` | Critical | Summary limited to `contact_notified` / `confirmed_late` | SQL 25 overdue hidden / active allow |
| `reminder_count=0` could not reach overdue | Critical | Allow `notified → overdue` | SQL 30 + static transition check |
| Auth denial tests false-pass on any 42501 | Critical | Assert `sqlerrm` + `request.jwt.claims` | SQL 12 / 17 |
| Delivery guard missing subject binding | High | Require `contact.subject_user_id = check.subject_user_id` | SQL 18 cross-subject |
| Delivery guard omitted `check_id` UPDATE | High | `UPDATE OF` includes `check_id` (+ identity immutable) | SQL 18 rebind |

Medium / Warning items from those reviews remain deferred by scope.

## 14. Next phase

Phase 2 の DB-backed 検証・レビュー・選別コミット完了後のみ:

```text
Phase 3 — Core Check-In
```

