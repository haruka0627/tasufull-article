# STEP 10-EXEC-APPLY — AUTH-H-1 review_scores パッチ適用

**実施日:** 2026-06-18  
**対象 DB:** `https://ddojquacsyqesrjhcvmn.supabase.co`  
**スコープ:** AUTH-H-1 のみ（**legacy RLS 再適用なし** · Stripe / Connect / checkout 未着手）

---

# 実施内容

| # | 作業 | 結果 |
|---|------|------|
| ① | 適用前確認 | ✅ `review_scores_select_authenticated` 残存 · view 未作成 |
| ② | `auth-step10-review-scores-patch.sql` 適用 | ✅ exit 0 |
| ③ | probe | ✅ **PASS**（`verify-auth-step10-review-scores.mjs`） |
| ④ | `detail-trust-score.js` 切替 | ✅ `public_review_scores` |
| ④b | `chat-supabase.js` 最小追従 | ✅ fetch view 化 · upsert → trigger 委譲（二重加算防止） |
| ⑤ | 回帰 | ✅ auth / marketplace / legacy 8B |
| ⑥ | rollback 確認 | ✅ `auth-step10-rollback.sql` §A |

---

# 適用SQL

**ファイル:** [`sql/auth-step10-review-scores-patch.sql`](../sql/auth-step10-review-scores-patch.sql)

```bash
npx supabase db query --linked --yes -f sql/auth-step10-review-scores-patch.sql
```

| 内容 | 説明 |
|------|------|
| `public_review_scores` view | 集計列のみ · `GRANT SELECT` to anon/authenticated |
| `review_scores_select_authenticated` DROP | authenticated 全行 READ 廃止 |
| `review_scores_select_own` | 本人 + `talk_is_admin()` のみ base SELECT |
| INSERT/UPDATE ポリシー | なし（client direct upsert 拒否） |
| `review_scores_apply_review_row` trigger | `reviews` INSERT 後に SECURITY DEFINER で scores 更新 |

---

# 適用前状態

| 項目 | 状態 |
|------|------|
| inventory | [`auth-step10-prod-inventory.json`](auth-step10-prod-inventory.json) |
| policy snapshot | [`auth-step10-prod-policies-snapshot.json`](auth-step10-prod-policies-snapshot.json) |
| `review_scores_select_authenticated` | **存在** — `(user_id IS NOT NULL OR IS NULL)` |
| `public_review_scores` | **未作成** |
| legacy 8B | **適用済**（再適用なし） |

---

# 適用後状態

| 項目 | 状態 |
|------|------|
| post snapshot | [`auth-step10-post-policies-snapshot.json`](auth-step10-post-policies-snapshot.json) |
| `review_scores_select_authenticated` | **DROP 済** |
| `review_scores_select_own` | **存在** — `user_id = talk_current_user_id() OR talk_is_admin()` |
| `public_review_scores` | **作成済** |
| trigger | `review_scores_apply_review_row_trg` **有効** |
| legacy 5 テーブル anon READ | **0**（8B 維持） |

---

# probe結果

**実行:** `node scripts/verify-auth-step10-review-scores.mjs`  
**詳細:** [`auth-step10-review-scores-probe.json`](auth-step10-review-scores-probe.json)

| # | 確認 | 結果 |
|---|------|------|
| P-1 | tautology policy 撤去 | **PASS** |
| P-2 | anon `public_review_scores` READ | **PASS** |
| P-3 | authenticated `public_review_scores` 他人行 | **PASS** |
| P-4 | authenticated base 全行 READ 不可 | **PASS** |
| P-5 | authenticated base 他人行拒否 | **PASS** |
| P-6 | client direct upsert 拒否 | **PASS** |
| P-7 | anon base 直 READ 拒否 | **PASS** |

**legacy 8B 回帰:** `verify-auth-step8b-legacy-rls.mjs` **PASS**

### 総合 probe 判定: **PASS**

---

# detail-trust-score.js 切替結果

| ファイル | 変更 |
|----------|------|
| [`detail-trust-score.js`](../detail-trust-score.js) | `.from("review_scores")` → `.from("public_review_scores")` |
| UI / レイアウト | **変更なし**（`formatTrustDisplay` / `mountAll` 維持） |

**期待:** 公開詳細で anon / authenticated とも view 経由でスコア表示。base 全行 READ に戻していない。

### 付随（二重加算防止 · 最小）

| ファイル | 変更 |
|----------|------|
| [`chat-supabase.js`](../chat-supabase.js) | `fetchReviewScore` → `public_review_scores` |
| [`chat-supabase.js`](../chat-supabase.js) | `upsertReviewScoresAfterReview` → DB trigger 委譲（fetch のみ返却） |

---

# 回帰結果

| テスト | 結果 |
|--------|------|
| `test-auth-current-user.mjs` | **ALL PASS** |
| `test-auth-ops-guard.mjs` | **ALL PASS** |
| `test-auth-step7-fallback-lockdown.mjs` | **ALL PASS** |
| `verify-marketplace-rls.mjs` | **PASS** P1+P2+P3 |
| `verify-auth-step8b-legacy-rls.mjs` | **PASS** |
| reviews 表示 / detail trust UI 専用 E2E | 未実施（ブラウザ）— view 列同一のため退行リスク低 |

---

# rollback手順

**ファイル:** [`sql/auth-step10-rollback.sql`](../sql/auth-step10-rollback.sql) **§A のみ**（H-1 パッチ戻し）

| 段階 | 操作 |
|------|------|
| 1 | trigger / function DROP |
| 2 | `review_scores_select_own` DROP |
| 3 | `review_scores_select_authenticated` 復元（セキュリティ後退） |
| 4 | `public_review_scores` view DROP |
| 5 | フロント `detail-trust-score.js` / `chat-supabase.js` revert |

| 項目 | 見積 |
|------|------|
| **所要時間** | 5〜10 分 |
| **影響** | 公開詳細スコアが anon 不可に戻る · authenticated 全行 READ 再発 · client upsert 再試行可 |
| **legacy 8B** | §B は**今回未使用**（触らない） |

---

# 残リスク

| 重要度 | 内容 | 対応 |
|--------|------|------|
| MEDIUM | `tasful.jp` 実機 smoke 未実施（NB-1） | NB-1 後 9 シナリオ |
| LOW | ブラウザ detail trust 表示未撮影 | NB-1 後 or ステージング手動確認 |
| LOW | view owner 経由の公開 read（Postgres バージョン依存） | probe P-2/P-3 で実 DB 確認済 |
| INFO | 既存 reviews 行に対する trigger は **新規 INSERT のみ** | 過去データは既存 scores を維持 |

---

# STEP10-EXEC-APPLY判定

# **PASS**

## PASS 条件チェック

| 条件 | 状態 |
|------|------|
| review_scores authenticated 全行 READ 解消 | ✅ |
| `public_review_scores` で公開表示可能 | ✅ probe |
| client direct upsert 拒否 | ✅ |
| detail trust score 表示維持（view 切替） | ✅ コード反映 |
| rollback 手順確認済み | ✅ §A |
| NB-1 後 tasful.jp smoke へ進行可 | ✅ |

## 次ステップ

1. **NB-1** 完了後 · [`auth-step10-exec-prep.md`](auth-step10-exec-prep.md) §smoke 9 シナリオ実施  
2. 全 PASS → **Auth 本番 GO** 最終判定（`auth-step10-production-go-exec.md` 予定）

**今回未実施（意図的）:** legacy RLS 再適用 · Stripe Live · Connect onboarding · 市場 checkout 本格実装 · tasful.jp 実機 smoke

---

## 参照

| ファイル | 用途 |
|----------|------|
| [`auth-step10-exec-prep.md`](auth-step10-exec-prep.md) | 適用前準備 |
| [`auth-step10-production-go.md`](auth-step10-production-go.md) | GO 計画 |
| `scripts/verify-auth-step10-review-scores.mjs` | H-1 probe |
