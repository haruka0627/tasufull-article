# STEP 10-EXEC — Auth 本番 GO 前 実行準備

**実施日:** 2026-06-18  
**最終再確認:** 2026-06-18（inventory / legacy probe 再実行 · DB 変更なし）  
**種別:** 準備のみ（**DB 変更未実施** · **tasful.jp smoke 未実施**）  
**対象 DB:** `https://ddojquacsyqesrjhcvmn.supabase.co`（linked = 本番 Supabase プロジェクト）  
**スコープ:** AUTH-RB-1 / AUTH-RB-2 解消準備 · AUTH-H-1 SQL 作成

---

# 実施内容

| # | 作業 | 状態 |
|---|------|------|
| ① | AUTH-H-1 `review_scores` 修正 SQL 作成 | ✅ `sql/auth-step10-review-scores-patch.sql` |
| ② | rollback SQL 作成 | ✅ `sql/auth-step10-rollback.sql` |
| ③ | 本番 inventory 再確認（読取のみ） | ✅ `reports/auth-step10-prod-inventory.json` |
| ④ | policy スナップショット | ✅ `reports/auth-step10-prod-policies-snapshot.json` |
| ⑤ | legacy RLS 本番適用要否判定 | ✅ **判定 A**（8B 適用済 · probe のみ） |
| ⑥ | probe 計画固定 | ✅ 本文 §probe |
| ⑦ | NB-1 後 tasful.jp smoke 手順 | ✅ 本文 §smoke |
| — | DB への SQL 適用 | ❌ **未実施**（次フェーズ STEP 10-EXEC-APPLY） |
| — | tasful.jp 実機 smoke | ❌ **未実施**（NB-1 待ち） |

---

# AUTH-H-1 修正方針

## 問題（現状 · 8B 適用後）

| 項目 | 状態 |
|------|------|
| ポリシー | `review_scores_select_authenticated` — `(user_id IS NOT NULL OR IS NULL)` |
| 効果 | **authenticated 全行 READ 可能**（集計のみだが横断閲覧可） |
| anon base 直 READ | **拒否**（ポリシーなし）→ 公開詳細でスコア非表示リスク |
| クライアント upsert | INSERT/UPDATE ポリシーなし → **既に拒否**（`chat-supabase.js` upsert 失敗） |

## 方針

| 要件 | 実装 |
|------|------|
| 公開詳細のスコア | `public_review_scores` view · `GRANT SELECT` to anon/authenticated |
| authenticated 全行 READ 禁止 | 旧ポリシー DROP · `review_scores_select_own`（本人 + admin のみ） |
| クライアント direct upsert 禁止 | base に INSERT/UPDATE ポリシーなし（維持） |
| スコア更新 | `reviews` **AFTER INSERT trigger** · `SECURITY DEFINER` · `computeReviewScoreUpdate` 同等 |

## フロント（EXEC-APPLY 時 · 最小 1 箇所）

[`detail-trust-score.js`](../detail-trust-score.js) の `.from("review_scores")` を `.from("public_review_scores")` に切替。  
[`chat-supabase.js`](../chat-supabase.js) の `upsertReviewScoresAfterReview` は trigger 導入後 **no-op 化または削除可**（reviews insert のみで十分）。

---

# 作成SQL

## 適用ファイル

| ファイル | 用途 |
|----------|------|
| [`sql/auth-step10-review-scores-patch.sql`](../sql/auth-step10-review-scores-patch.sql) | AUTH-H-1 本番適用 |
| [`sql/auth-step10-rollback.sql`](../sql/auth-step10-rollback.sql) | §A H-1 ロールバック · §B legacy 8B 緊急ロールバック |

## 適用前後の期待挙動

| 操作 | 適用前 | 適用後 |
|------|--------|--------|
| anon `review_scores` 直 SELECT | 0 行 / 拒否 | **拒否**（維持） |
| anon `public_review_scores` SELECT | 404 / 不存在 | **可**（任意 user_id の集計） |
| authenticated `review_scores` 他人行 | **可**（全行） | **拒否** |
| authenticated `public_review_scores` | 404 | **可** |
| authenticated `review_scores` upsert | 拒否 | **拒否**（維持） |
| reviews INSERT（当事者） | 可 | 可 + **trigger で scores 更新** |
| ops `talk_is_admin` base read | 全行（authenticated 経由） | **本人行 + admin のみ base** · 公開は view |

## 影響範囲

| 領域 | 影響 |
|------|------|
| 商品 / 店舗詳細の信頼スコア | view 切替後 **復旧・改善** |
| レビュー投稿フロー | trigger で scores 更新 · クライアント upsert 不要 |
| 市場 RLS P1–P3 | **影響なし** |
| TALK / 安否 / ops | **影響なし** |
| legacy 5 テーブル anon | **影響なし** |

---

# rollback

| 段階 | 操作 | ファイル |
|------|------|----------|
| H-1 のみ戻す | trigger/function/view DROP · `review_scores_select_authenticated` 復元 | `auth-step10-rollback.sql` **§A** |
| legacy 全面戻す（最終手段） | 8B ポリシー DROP · Allow all 復元 | **§B** |
| 所要 | 5〜15 分 + inventory 再取得 | — |

**適用前必須:** `reports/auth-step10-prod-policies-snapshot.json` を更新保存済みであること。

---

# inventory結果

**保存先:** [`reports/auth-step10-prod-inventory.json`](auth-step10-prod-inventory.json)  
**取得:** `node scripts/verify-auth-step8-rls-inventory.mjs`（2026-06-18 再実行）

## legacy 対象テーブル — anon READ

| テーブル | 件数 | Allow all | using(true) |
|----------|------|-----------|-------------|
| transaction_rooms | **0** | 0 | 0 |
| transaction_messages | **0** | 0 | 0 |
| chats | **0** | 0 | 0 |
| reviews | **0** | 0 | 0 |
| favorites | **0** | 0 | 0 |
| review_scores | **0**（base 直） | 0 | 0 |

## review_scores · authenticated 全行 READ

| 項目 | 結果 |
|------|------|
| `review_scores_select_authenticated` | **存在** · qual = tautology → **AUTH-H-1 未解消** |
| `public_review_scores` view | **未作成** |

## その他 permissive

| ポリシー | 意図 |
|----------|------|
| `moderation_logs_insert_anon` | 通報 INSERT |
| `reports_insert_anon` | 通報 INSERT |

## 本番 vs ステージング差分

| 項目 | 判定 |
|------|------|
| Supabase プロジェクト | **同一** `ddojquacsyqesrjhcvmn`（[`release-blocker-roadmap.md`](release-blocker-roadmap.md)） |
| STEP 8B legacy RLS | **適用済**（2026-06-18 · [`auth-step8b-legacy-rls-fix.md`](auth-step8b-legacy-rls-fix.md)） |
| 適用前（8B 前）inventory | `auth-step8b-pre-inventory.json` — transaction_rooms anon **3 件** |
| 現 inventory | legacy anon **0 件** → **8B 効果確認済** |
| 差分 | **AUTH-H-1 パッチのみ未適用** |

## STEP 8B 適用済みか

**はい。** 根拠:

- `verify-auth-step8b-legacy-rls.mjs` **PASS**
- `pg_policies` に `transaction_rooms_select_participant` 等 · `Allow all` **0**
- `chats` / `ai_messages` — RLS 有効 · ポリシー **0**

---

# legacy RLS 適用要否

## 判定: **A — 既に適用済み → probe のみ**

| 選択肢 | 条件 | 本件 |
|--------|------|------|
| **A** | 8B 適用済 | ✅ **採用** |
| B | 未適用 | ❌ 該当せず |
| C | スキーマ差分 | ❌ `partner_id` 無し版 SQL が既に適用済 |

## 本番適用が必要か

| SQL | 要否 |
|-----|------|
| `auth-step8-legacy-chat-rls-proposal.sql` | **不要**（再適用しない） |
| `auth-step10-review-scores-patch.sql` | **必要**（未適用） |

## EXEC-APPLY 実行順（DB 変更時）

```
[1] inventory 保存（本ファイル時点で済）
[2] policy snapshot 保存（済）
[3] auth-step10-review-scores-patch.sql 適用
[4] probe 一式（§probe）
[5] detail-trust-score.js view 切替デプロイ（フロント）
[6] NB-1 後 tasful.jp smoke
```

## リスク · 所要時間

| 項目 | 内容 |
|------|------|
| リスク | view 未デプロイ時は詳細スコア一時非表示 · trigger 重複時は scores 二重加算（upsert 残置時） |
| 緩和 | フロント view 切替を同時デプロイ · client upsert 無効化 |
| 所要 | SQL **5 分** · probe **15 分** · 合計 **~30 分** |
| rollback | `auth-step10-rollback.sql` §A |

**legacy 8B 再適用は実施しない。**

---

# probe計画

## 実行タイミング

`auth-step10-review-scores-patch.sql` 適用 **直後**（NB-1 前でも可）

## コマンド

```bash
# 既存 legacy + ops
node scripts/verify-auth-step8b-legacy-rls.mjs
node scripts/verify-auth-step8-rls-inventory.mjs

# 回帰
node scripts/verify-talk-rls-staging.mjs
node scripts/verify-marketplace-rls.mjs
node scripts/verify-anpi-rls-real-db.mjs
```

## チェック一覧

| # | 確認 | 方法 | PASS |
|---|------|------|------|
| P-1 | anon READ legacy 5 テーブル = 0 | `verify-auth-step8b-legacy-rls.mjs` | 0 行 |
| P-2 | using(true) / Allow all legacy = 0 | 同上 + pg_policies | 0 件 |
| P-3 | authenticated A/B 他人アクセス不可 | 同上 transaction/favorites | bRows=0 |
| P-4 | tasu_admin support_tickets 参照可 | 同上 ops probe | rows≥1 |
| P-5 | anon `review_scores` base 直 READ | REST anon `GET /review_scores?limit=1` | **0 行 or 403** |
| P-6 | anon `public_review_scores` READ | REST anon `GET /public_review_scores?user_id=eq.u_me` | **200 + 行 or 空** |
| P-7 | auth A `review_scores` 他人行 | JWT A `GET /review_scores?user_id=eq.<B>` | **0 行** |
| P-8 | auth A `public_review_scores` 他人行 | JWT A `GET /public_review_scores?user_id=eq.<B>` | **200 可** |
| P-9 | client direct upsert 拒否 | JWT `POST /review_scores` upsert | **403 / RLS** |
| P-10 | reviews INSERT → scores 更新 | service_role seed review · scores 件数+1 | trigger 動作 |

### P-5〜P-10 手動 REST 例（EXEC 時）

```bash
# anon public view
curl -s "${SUPABASE_URL}/rest/v1/public_review_scores?user_id=eq.u_me&select=*" \
  -H "apikey: ${ANON_KEY}" -H "Authorization: Bearer ${ANON_KEY}"

# authenticated 他人 base 拒否
curl -s "${SUPABASE_URL}/rest/v1/review_scores?user_id=eq.u_store&select=*" \
  -H "apikey: ${ANON_KEY}" -H "Authorization: Bearer ${JWT_A}"
```

**推奨:** EXEC 時に `scripts/verify-auth-step10-review-scores.mjs` を新規化（P-5〜P-10 自動化）。

---

# tasful.jp smoke手順

**前提:** NB-1 完了（`https://tasful.jp` 到達 · auth スタック配信 · `talkDev` 無効）  
**実施時期:** DB パッチ + フロント view 切替デプロイ **後**  
**除外:** Stripe Live · 本番決済 · Connect 本番 onboarding

## 共通 PASS 条件

- `?userId=` / `?talkAdmin=` / LS による権限昇格 **不可**
- `getCurrentUser().talkUserId` が JWT `app_metadata` と一致
- 本番 host で `canUseLocalStorageFallback() === false`

## FAIL 時の切り戻し

| 症状 | 切り戻し |
|------|----------|
| 信頼スコア全滅 | `rollback.sql` §A + フロント view 切替 revert |
| 取引チャット不通 | `rollback.sql` §B（緊急）· ただし 8B は現状維持が原則 |
| fallback 漏洩 | **フロント hotfix 最優先** · DB rollback は不要な場合あり |

---

## シナリオ 1 — 未ログイン

| 項目 | 内容 |
|------|------|
| **URL** | `https://tasful.jp/` · 公開 `detail-*.html` · `chat-detail.html` |
| **操作** | `?userId=u_me` 付与 · 商品詳細を開く · chat-detail 直打ち |
| **期待** | URL 無視 · 公開 listing 閲覧可 · 信頼スコア **view から表示** · チャット本文不可 · ops 画面不可 |
| **PASS** | fallback 0 · 公開詳細スコア表示 or 「新規ユーザー」 · chat RLS 拒否 |

---

## シナリオ 2 — 一般会員

| 項目 | 内容 |
|------|------|
| **URL** | `https://tasful.jp/talk-home.html` · `chat-detail.html?thread=<own>` |
| **操作** | 実 Auth ログイン · 自分の通知 · 当事者 room |
| **期待** | 自分の通知のみ · 当事者 room READ/WRITE · 他人 room 不可 |
| **PASS** | A/B 分離 · JWT identity 一致 |

---

## シナリオ 3 — ops

| 項目 | 内容 |
|------|------|
| **URL** | `https://tasful.jp/admin-operations-dashboard.html` |
| **操作** | `is_ops` / `tasu_admin` JWT でログイン · `?talkAdmin=1` のみ試行 |
| **期待** | 司令塔表示 · support 集計可 · URL のみでは昇格不可 |
| **PASS** | ops JWT のみ · member は拒否 |

---

## シナリオ 4 — Connect 未完了

| 項目 | 内容 |
|------|------|
| **URL** | `https://tasful.jp/payment-settings.html` |
| **操作** | DB payout 未 ready ユーザーでログイン · LS に ready 書込試行 |
| **期待** | step ≠ ready · LS 無視 · payout CTA 非表示 or ガード |
| **PASS** | `connect-state.js` が DB のみ参照 |

---

## シナリオ 5 — Connect 完了

| 項目 | 内容 |
|------|------|
| **URL** | `https://tasful.jp/payment-settings.html` |
| **操作** | DB payout active ユーザー |
| **期待** | ready 表示 · 売上導線表示（Stripe 実 API は別 BLOCKER） |
| **PASS** | DB 整合 · LS 偽装不可 |

---

## シナリオ 6 — Builder 当事者

| 項目 | 内容 |
|------|------|
| **URL** | `https://tasful.jp/builder/board-project-detail.html?view=applications&...` |
| **操作** | 案件 owner / applicant JWT |
| **期待** | `builder-actor-identity` で role 解決 · owner 操作可 |
| **PASS** | URL `role=` 単独では不可 |

---

## シナリオ 7 — Builder 非当事者

| 項目 | 内容 |
|------|------|
| **URL** | 他人案件の owner URL 直打ち |
| **操作** | 無関係 JWT |
| **期待** | 操作不可 · 空 / エラー |
| **PASS** | 非当事者拒否 |

---

## シナリオ 8 — 市場 buyer

| 項目 | 内容 |
|------|------|
| **URL** | `https://tasful.jp/index.html` · 公開商品詳細 |
| **操作** | buyer JWT · 他者 draft 参照試行 |
| **期待** | 公開品閲覧可 · draft 不可 · payment_url 非表示 |
| **PASS** | `market-identity.js` + safe view |

---

## シナリオ 9 — 市場 seller

| 項目 | 内容 |
|------|------|
| **URL** | `https://tasful.jp/my-listings.html` 等 |
| **操作** | seller JWT · 自出品 CRUD · 他人出品 UPDATE |
| **期待** | 自出品可 · 他人 UPDATE 拒否 |
| **PASS** | owner RLS + identity |

---

## smoke 実施コマンド（NB-1 後 · 計画）

```bash
# 補助（ローカルで prod host シミュレーション）
node scripts/test-auth-step7-fallback-lockdown.mjs

# 本番（EXEC 時にスクリプト化推奨）
# PROD_BASE=https://tasful.jp node scripts/test-auth-step10-production-smoke.mjs
```

**記録先（予定）:** `reports/auth-step10-prod-smoke-results.json`

---

# 残リスク

| 重要度 | 内容 | 対応 |
|--------|------|------|
| **HIGH** | AUTH-H-1 SQL **未適用** | EXEC-APPLY で patch 適用 |
| **HIGH** | `detail-trust-score.js` が base テーブル参照 | view 切替を同時デプロイ |
| **HIGH** | NB-1 未完了 · AUTH-RB-2 未解消 | DNS/ホスト後に smoke |
| MEDIUM | `chat-supabase.js` upsert 残置 | trigger 導入後 no-op 化 |
| MEDIUM | view + RLS の Postgres バージョン差異 | P-6 probe で実 DB 確認 |
| LOW | `chats`/`ai_messages` deny | 後追い監視（コード直参照なし） |
| **除外** | Stripe Live / 本番決済 / Connect onboarding | 本 STEP 対象外 |

---

# STEP10-EXEC-PREP判定

# **READY**

## READY 条件チェック

| 条件 | 状態 |
|------|------|
| review_scores 修正 SQL 完成 | ✅ `sql/auth-step10-review-scores-patch.sql` |
| rollback SQL 完成 | ✅ `sql/auth-step10-rollback.sql` |
| 本番 inventory 整理済 | ✅ `auth-step10-prod-inventory.json` + policy snapshot |
| legacy RLS 適用要否明確 | ✅ **判定 A** — 8B 済 · **H-1 のみ適用待ち** |
| NB-1 後 smoke 手順固定 | ✅ 9 シナリオ本文 |

## 次ステップ（STEP 10-EXEC-APPLY）

1. 運用承認後 · `auth-step10-review-scores-patch.sql` を linked DB に適用
2. probe P-1〜P-10 実行
3. `detail-trust-score.js` 最小切替 + デプロイ
4. NB-1 完了後 · tasful.jp 9 シナリオ smoke
5. 全 PASS → **Auth 本番 GO** 判定（`reports/auth-step10-production-go-exec.md`）

**本準備フェーズでは DB 変更・実機 smoke は意図的に未実施。**

---

## 参照

| ファイル | 用途 |
|----------|------|
| [`auth-step10-production-go.md`](auth-step10-production-go.md) | STEP 10 計画 |
| [`auth-step8b-legacy-rls-fix.md`](auth-step8b-legacy-rls-fix.md) | 8B 実績 |
| [`auth-step9-e2e-final.md`](auth-step9-e2e-final.md) | E2E 総検証 |
