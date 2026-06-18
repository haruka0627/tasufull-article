# NB-3 STEP 8: RLS 再検証レポート

**作成日:** 2026-06-18  
**前提:** STEP 2〜7（JWT helper + 本番 fallback 遮断）完了  
**対象 DB:** linked Supabase `ddojquacsyqesrjhcvmn`  
**種別:** 監査・検証のみ（**本番 DB へのポリシー適用・破壊的変更なし**）

---

# 実施内容

1. リポジトリ内 RLS SQL / helper / policy 定義の静的レビュー
2. リンク DB への読取専用 SQL（`pg_policies` 棚卸し · P0 残存確認）
3. REST ライブプローブ（anon / authenticated A/B / ops admin）
4. 既存検証スクリプト再実行 + STEP 8 棚卸しスクリプト新規追加
5. 不足分の **修正 SQL 案** 作成（適用は別 STEP）

| 検証 | コマンド | 結果 |
|------|----------|------|
| TALK 本番 RLS | `node scripts/verify-talk-rls-staging.mjs` | **PASS** |
| Marketplace P1–P3 | `node scripts/verify-marketplace-rls.mjs` | **PASS** |
| 安否 Phase1 | `node scripts/verify-anpi-rls-real-db.mjs` | **17/17 PASS** |
| 安否 Phase2 | `node scripts/verify-anpi-no-response-rls-p0.mjs` | **PASS** |
| P0 dev 残存 | `npx supabase db query -f sql/dev-rls-p0-post-check.sql` | **`*_dev` 0 · staging 0** |
| STEP 8 棚卸し | `node scripts/verify-auth-step8-rls-inventory.mjs` | **レガシー穴検出** |
| フロント回帰 | `node scripts/test-auth-step7-fallback-lockdown.mjs` 等 | **PASS** |

---

# 対象テーブル一覧

リンク DB で RLS 有効・ポリシー確認済み（**37+ テーブル**）。主要ドメイン:

| ドメイン | テーブル（代表） | STEP 8 判定 |
|----------|------------------|-------------|
| TALK 通知/下書き | `talk_notifications`, `talk_ai_drafts`, `talk_broadcast_drafts`, `talk_follow_subscriptions` | ✅ prod のみ |
| TALK 通話 | `talk_call_sessions`, `talk_call_signals`, `talk_call_push_*` | ✅ 参加者分離 |
| 安否 | `anpi_user_contexts`, `anpi_notification_logs`, `anpi_check_sessions`, `anpi_no_response_audit_log` | ✅ prod のみ |
| 運営/AI秘書 | `support_*`, `ai_ops_*`, `connect_issues`, `talk_ops_messages`, `builder_partner_*` | ✅ `tasu_can_manage_ops()` |
| 市場 | `listings`, `business_listings`, `profiles`, `members` + safe views | ✅ owner/public 分離 |
| **レガシー TALK/取引** | `transaction_rooms`, `transaction_messages`, `transaction_reads`, `chats`, `ai_messages` | ❌ **Allow all public** |
| レビュー | `reviews`, `review_scores`, `company_reviews` | ❌ **Allow all public**（reviews） |
| お気に入り | `favorites` | ❌ **public 全 CRUD** |
| GenAI | `gen_ai_subscriptions`（deny all）, `gen_ai_3d_*`（using false） | ✅ Edge 前提 |
| 注文 | `shop_orders` | ⚠️ **テーブル未デプロイ**（404） |
| Builder コア | `builder_projects` 等 | ⚠️ **DB 未作成**（設計のみ） |

---

# RLS helper 確認結果

| helper | 参照 JWT claim | 領域 | 期待 | 不足/危険 |
|--------|----------------|------|------|-----------|
| `talk_current_user_id()` | `talk_user_id`, `member_id`, `sub`, `auth.uid()` | TALK · 市場 owner | 本人 ID text | ✅ 定義済み。`sub` フォールバックは Auth UUID と legacy text ID 混在時に要注意 |
| `talk_is_admin()` | `role`, `app_metadata.role`, `tasu_admin` | TALK admin fanout · call | `tasu_admin` のみ昇格 | ✅ JWT 改ざん前提は RLS + Auth 管理 |
| `anpi_current_member_id()` | `member_id`, `sub` | 安否 | 契約者/本人 | ✅ |
| `anpi_is_admin()` | 同上 talk 系 | 安否 admin | ops 相当 | ✅ |
| `anpi_can_read/write_*` | 行の member/holder/user id | 安否 context/logs | 本人・契約者・admin | ✅ Phase1/2 と整合 |
| `tasu_current_member_id()` | `member_id`, `sub` | ops | 会員 ID | ✅ |
| `tasu_is_admin()` / `tasu_is_ops_admin()` / `tasu_can_manage_ops()` | role + ops フラグ | 運営全表 | admin JWT のみ | ✅ 一般 member は 0 行（ライブ確認） |
| `marketplace_is_owner(user_id)` | `talk_current_user_id()` | listings | 本人 CRUD | ✅ |
| `marketplace_listing_is_public()` | 行の publish_status | 公開掲載 | anon SELECT 可 | ✅ draft は anon 不可（verify PASS） |
| `marketplace_profile_is_public()` | 公開 listing 存在 | profiles/members | 公開出品者のみ anon | ✅ |
| `builder_*`（設計） | `actor_id`, `actor_type`, `partner_id` | Builder | 参加者 DB 照合 | ⚠️ **未デプロイ**（`sql/builder-rls-policies.sql` は DESIGN ONLY） |

**フロント STEP 7 との整合:** `is_ops` / `talk_user_id` は app_metadata 基準。SQL helper も `app_metadata` を参照しており **方針一致**。

---

# policy 棚卸し（リンク DB · 2026-06-18）

## P0 クリーンアップ後

```
all_dev_count = 0
staging_count = 0
select_public_count (marketplace base 退行) = 0
```

→ STEP 6-17 の `*_dev` OR 結合による **本番 RLS 無効化は解消済み**。

## 本番ポリシー（抜粋 · 正常）

| テーブル | ポリシー | cmd | role | 要点 |
|----------|----------|-----|------|------|
| `talk_notifications` | `*_select_own` 等 | CRUD | authenticated | `user_id = talk_current_user_id()` |
| `talk_call_sessions` | `*_participant` | R/U/I | authenticated | caller/callee/admin |
| `anpi_user_contexts` | `*_prod` | CRUD | authenticated | `anpi_can_*` |
| `anpi_check_sessions` | `*_prod` | R/I/U | authenticated | 契約者/利用者/admin |
| `listings` | `*_owner` / safe view | CRUD/SELECT | authenticated/anon | 公開のみ anon |
| `support_tickets` | `ops_*_admin` | R/I/U | authenticated | `tasu_can_manage_ops()` |

## 危険ポリシー残存（`using (true)` · public）

| テーブル | ポリシー | anon 影響 | 本番許容 |
|----------|----------|-----------|----------|
| `transaction_rooms` | Allow all | **READ 可能（3行確認）** | ❌ |
| `transaction_messages` | Allow all | **READ 可能** | ❌ |
| `transaction_reads` | Allow all | READ/WRITE 可能 | ❌ |
| `chats` | Allow all | **READ 可能** | ❌ |
| `ai_messages` | Allow all | READ/WRITE 可能 | ❌ |
| `reviews` | Allow all | **READ 可能** | ❌ |
| `review_scores` | Allow all | READ 可能 | ⚠️ 集計公開は要設計 |
| `favorites` | `favorites_*` public | 全 CRUD 許可ポリシー | ❌ |
| `blocked_users` | Allow all | 全操作可能 | ❌ |
| `monthly_usage` | Allow all | 全操作可能 | ❌ |
| `moderation_logs` | anon INSERT のみ | 通報用途 | ✅（SELECT なし） |
| `reports` | anon INSERT のみ | 通報用途 | ✅（SELECT なし） |

---

# anon アクセス検証

| 対象 | 結果 | 備考 |
|------|------|------|
| `talk_notifications` SELECT | **PASS**（0 行） | INSERT 401 |
| `anpi_user_contexts` INSERT | **PASS**（拒否） | |
| `anpi_check_sessions` INSERT | **PASS**（拒否） | |
| `support_tickets` / `ai_ops_cases` | **PASS**（0 行 · INSERT 401） | |
| `listings` base SELECT | **PASS**（401 · safe view 経由のみ） | |
| `transaction_rooms` SELECT | **FAIL** | anon が 3 行 READ |
| `transaction_messages` / `chats` | **FAIL** | anon READ |
| `reviews` SELECT | **FAIL** | anon が 1 行 READ |
| `shop_orders` | N/A | テーブル未存在 |

---

# authenticated A/B 検証

| 対象 | 結果 |
|------|------|
| `talk_notifications` A→B | **PASS**（0 行） |
| `talk_ai_drafts` A→B | **PASS**（verify-talk-rls） |
| `anpi_user_contexts` B→A | **PASS**（verify-anpi-rls） |
| `anpi_check_sessions` stranger | **PASS**（拒否） |
| `transaction_rooms` 参加者外 | **未検証**（現ポリシーが Allow all のため分離テスト無意味） |
| Builder 案件 | N/A（DB 未作成） |
| 市場 draft | **PASS**（B は A の draft 不可） |

---

# ops/admin 検証

| 確認 | 結果 |
|------|------|
| 一般 member → `support_tickets` | **PASS**（0 行） |
| 一般 member → `ai_ops_cases` / `connect_issues` | **PASS** |
| `tasu_admin` JWT → `support_tickets` | **PASS**（1 行以上 READ 可） |
| anon → ops テーブル | **PASS**（INSERT/SELECT 拒否 or 0 行） |
| DELETE on ops テーブル | **PASS**（ポリシーなし → deny） |

**過剰許可:** なし（本番 ops 系）。  
**不足許可:** なし（admin JWT で読取確認）。

---

# Connect / Stripe RLS

| 項目 | 結果 |
|------|------|
| `stripe_account_id` 等の anon 露出 | **PASS**（base listings anon 401 · P2 safe view + 列 REVOKE） |
| 他人の Connect 状態 READ | **PASS**（owner policy + 非公開列マスク） |
| seller 本人 UPDATE payout 列 | **PASS**（`marketplace_is_owner` のみ） |
| `connect_issues` | **PASS**（ops admin のみ） |
| JWT に `connect_account_id` | **PASS**（載せない設計 · SQL も DB 列参照） |
| Connect 状態の client 直接 UPDATE | **想定 deny**（Stripe 状態は Edge/webhook · service_role） |

**修正 SQL 案:** 追加不要（市場 P2/P3 維持）。`shop_orders` デプロイ時は下記参照。

---

# 市場 RLS

| 確認 | 結果 |
|------|------|
| anon 公開 listing のみ | **PASS** |
| anon draft 不可 | **PASS** |
| anon INSERT/UPDATE/DELETE | **PASS**（拒否） |
| 買い手/売り手注文 | N/A（`shop_orders` 未デプロイ） |
| Featured 申込 | Edge + `gen_ai`/`listings` owner 経由（RLS 整合） |

---

# Builder RLS

| 確認 | 結果 |
|------|------|
| DB テーブル | **未作成**（`builder_projects` 等なし） |
| リポジトリ設計 | `sql/builder-rls-policies.sql` — **DESIGN ONLY** |
| 参加者 ID 制御 | 設計上 `builder_can_read_project` / selected application 参照 |
| フロント | STEP 6 `TasuBuilderActorIdentity` — JWT + deal 参加者（URL/LS 非依存） |

**次 STEP:** Builder DB 移行時に `builder-rls-policies.sql` を JWT claim 実装と突合後に適用。

---

# 安否 RLS

| 確認 | 結果 |
|------|------|
| 本人/契約者のみ context | **PASS** |
| 他人 context/logs | **PASS** |
| Phase2 未応答 session | **PASS**（anon INSERT 拒否 · holder のみ INSERT） |
| audit log 改ざん | **PASS**（UPDATE/DELETE 拒否） |
| ops admin | **PASS**（admin select/update） |

---

# dev policy 残存

| 種別 | リンク DB | リポジトリ SQL ファイル |
|------|-----------|-------------------------|
| `*_dev` | **0 件** ✅ | `talk-sync-schema.sql`, `anpi-user-context.sql` 等（再適用禁止） |
| `*_staging_read` | **0 件** ✅ | `staging-phase2-ops-rls-dev.sql` |
| `Allow all` / `using(true)` | **15 件** ❌ | レガシー supabase/*.sql |
| Marketplace `*_select_public` on base | **0 件** ✅ | `setup_marketplace_listings.sql`（旧） |

**再適用禁止:** スキーマ bootstrap SQL を本番でそのまま流すと dev ポリシーが復活する。本番は `*-production.sql` + `*-drop-dev-policies.sql` のみ。

---

# 修正 SQL 案（適用は別 STEP）

| ファイル | 内容 |
|----------|------|
| **`sql/auth-step8-legacy-chat-rls-proposal.sql`** | レガシー `transaction_*` / `reviews` / `favorites` の Allow all 削除 + 参加者/本人ポリシー |
| 既存（適用済み確認） | `sql/talk-rls-drop-dev-policies.sql`, `sql/marketplace-rls-drop-dev-policies.sql`, `sql/anpi-no-response-phase2-drop-dev-policies.sql` |
| 新規デプロイ時 | `shop_orders` 用 RLS（buyer/seller/ops · payout UPDATE は service_role のみ）— `auth-step8-legacy-chat-rls-proposal.sql` 末尾コメント |
| Builder 移行時 | `sql/builder-rls-policies.sql` の本番化（JWT `actor_id` / `partner_id` claim 配線後） |

**適用手順（提案）:**

1. ステージングで `auth-step8-legacy-chat-rls-proposal.sql` 実行
2. `node scripts/verify-auth-step8-rls-inventory.mjs` で anon READ 0 確認
3. 取引チャット E2E（当事者のみメッセージ閲覧）
4. 本番適用

---

# 残リスク

1. **レガシー取引テーブル** — `transaction_*` / `chats` / `reviews` が anon/public 全許可のまま。実データがある環境では **メッセージ・レビュー漏洩**。
2. **`shop_orders` 未デプロイ** — checkout 本格化時に RLS なしで作らないこと。
3. **Builder DB 未移行** — 現状は localStorage MVP。DB 化時に RLS 必須。
4. **`talk_current_user_id()` の `sub` フォールバック** — legacy text ID と Auth UUID 混在時、意図しないマッチ/非マッチ。JWT `talk_user_id` 統一を継続。
5. **bootstrap SQL の誤実行** — dev ポリシー復活リスク。CI/デプロイチェックリストに DROP 確認を固定。

---

# STEP8判定

## **WARNING**

### 根拠

**PASS 要素（STEP 2〜7 保護領域）:**

- P0 `*_dev` / staging ポリシー **0 件**
- TALK 通知・下書き · 通話 · 安否 · 運営 · 市場（P1–P3）— **ライブ検証 PASS**
- anon による **ops / anpi / 通知の書込** — 拒否
- authenticated **他人データ**（通知・安否・市場 draft）— 分離 OK
- フロント fallback 遮断（STEP 7）— 回帰 PASS

**WARNING 理由（本番前に修正必要 · 範囲は限定的）:**

- レガシー **`Allow all public`** ポリシーが 15 本残存
- anon が `transaction_rooms` / `chats` / `reviews` を **READ 可能**（ライブ確認）
- 修正 SQL 案は作成済み · **未適用**（本 STEP では適用禁止遵守）

**FAIL にはしない理由:**

- STEP 7 で強化した **主要ドメイン（JWT 基準の新 RLS）** はリンク DB で機能している
- 穴は **旧スキーマ層** に限定 · 設計済み修正パスあり
- anon **書込** on 注文/ops/安否/通知はブロック済み

---

# 追加成果物

| ファイル | 説明 |
|----------|------|
| `scripts/verify-auth-step8-rls-inventory.mjs` | anon/A-B/ops プローブ + JSON 出力 |
| `sql/auth-step8-policy-inventory.sql` | policy 棚卸し SQL |
| `sql/auth-step8-policy-summary.sql` | 主要テーブル policy 一覧 |
| `sql/auth-step8-legacy-chat-rls-proposal.sql` | レガシー穴修正案（未適用） |
| `reports/auth-step8-rls-inventory.json` | プローブ生データ |

---

*次 STEP（提案）: `auth-step8-legacy-chat-rls-proposal.sql` のステージング適用 → 再検証 → `shop_orders` RLS 同梱デプロイ*
