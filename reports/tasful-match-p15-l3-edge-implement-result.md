# TASFUL MATCH — P15-L3 Edge 実装結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`**（linked ref · Hook ON · RLS D2） |
| 前提 | P15-L1 **PASS** · 計画承認 **`READY_FOR_P15_L3_EDGE_IMPLEMENT`** |
| 判定 | **`PASS`** · **`READY_FOR_P15_L4_UI`** |
| 本番 URL | **`tasful.jp` 確認は 8 月まで保留** |

---

## 1. 実施サマリ

| 区分 | 結果 |
|------|------|
| Edge Functions（新規 11 本） | **実装・deploy 完了** |
| 共有モジュール | `_shared/match-db.ts` · `match-p15.ts` · `match-footprint.ts` |
| RPC GRANT migration | `20260622200000_match_p15_l3_rpc_grants.sql` **適用済** |
| smoke script | `scripts/smoke-match-p15-l3-edge.mjs` **PASS** |
| L9 回帰 | **PASS**（既存 7 本挙動不変） |
| UI | **未着手**（スコープ外） |
| TASFUL AI CTA | **未実装**（スコープ外） |

---

## 2. 成果物一覧

### 2.1 Edge Functions（11 本）

| Function | パス | service_role |
|----------|------|--------------|
| `match-favorite` | `supabase/functions/match-favorite/index.ts` | 不使用 |
| `match-unfavorite` | `supabase/functions/match-unfavorite/index.ts` | 不使用 |
| `match-list-favorites` | `supabase/functions/match-list-favorites/index.ts` | 不使用 |
| `match-record-profile-view` | `supabase/functions/match-record-profile-view/index.ts` | **UPSERT のみ** |
| `match-list-profile-views` | `supabase/functions/match-list-profile-views/index.ts` | 不使用 |
| `match-save-search` | `supabase/functions/match-save-search/index.ts` | 不使用 |
| `match-list-saved-searches` | `supabase/functions/match-list-saved-searches/index.ts` | 不使用 |
| `match-delete-saved-search` | `supabase/functions/match-delete-saved-search/index.ts` | 不使用 |
| `match-get-compatibility` | `supabase/functions/match-get-compatibility/index.ts` | 不使用 |
| `match-get-profile-completeness` | `supabase/functions/match-get-profile-completeness/index.ts` | 不使用 |
| `match-update-activity` | `supabase/functions/match-update-activity/index.ts` | 不使用 |

### 2.2 共有層

| ファイル | 役割 |
|----------|------|
| `_shared/match-db.ts` | `createUserClient(anon + bearer)` · footprint 専用 `createFootprintServiceClient()` |
| `_shared/match-p15.ts` | P15 共通レスポンス · block チェック · RPC ラッパ · `MATCH_P15_EDGE_DISABLED` |
| `_shared/match-footprint.ts` | `match_profile_views` UPSERT（service_role 限定） |

### 2.3 Migration

| ファイル | 内容 |
|----------|------|
| `supabase/migrations/20260622200000_match_p15_l3_rpc_grants.sql` | `authenticated` へ RPC EXECUTE GRANT（5 関数） |

### 2.4 検証

| ファイル | 内容 |
|----------|------|
| `scripts/smoke-match-p15-l3-edge.mjs` | post-gates · RPC grants · deploy · P15 smoke · L9 回帰 |

---

## 3. 設計遵守チェック

| 要件 | 状態 |
|------|------|
| POST only | ✅ 全 11 本 |
| JWT 必須（`requireUser`） | ✅ |
| anon 直叩き禁止（user client + RLS） | ✅ |
| service_role は footprint UPSERT のみ | ✅ `_shared/match-footprint.ts` のみ |
| raw `last_active_at` 非公開 | ✅ smoke で JSON 走査 |
| `activity_label` / `footprint_label` のみ | ✅ |
| 既存 7 本 Edge 未変更 | ✅ L9 回帰 PASS |
| Deno / 既存 MATCH Edge パターン準拠 | ✅ `match-auth.ts` 再利用 · `mode: live` · `auth_mode: jwt` |
| deploy 失敗時 smoke 不実行 | ✅ スクリプトで `process.exit(1)` |

---

## 4. linked ref デプロイ

**CLI:** `npx supabase functions deploy <name> --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes` × 11

| 結果 | 詳細 |
|------|------|
| deploy | **成功**（11 functions） |
| functions list | **11 P15 ACTIVE** |

---

## 5. Smoke 実行結果

```bash
node scripts/smoke-match-p15-l3-edge.mjs
```

| # | チェック | 結果 |
|---|----------|------|
| 1 | P15-L1 post-gates baseline（`p15_table_count=6` · `core_policy_count=20`） | **OK** |
| 2 | RPC GRANT migration | **OK** |
| 3 | Deploy P15 Edge（11 functions） | **OK** |
| 4 | Functions list（11 P15 ACTIVE） | **OK** |
| 5 | T1/T2 login（JWT） | **OK** |
| 6 | P15 remote smoke（11 functions · `last_active_at` 漏洩なし） | **OK** |
| 7 | L9 regression（swipe / report / block / verification / admin 403） | **OK** |

**Smoke result:** **PASS**（7 checks）  
**所要時間:** 約 49s

### 5.1 P15 smoke 内訳

- favorite → list-favorites → unfavorite
- record-profile-view（T1→T2）→ list-profile-views（T2 incoming ≥1）
- save-search → list-saved-searches → delete-saved-search
- get-profile-completeness（`percent` number）
- get-compatibility（200 または 404 · 5xx なし）
- update-activity（`activity_label` 必須 · `last_active_at` キーなし）

### 5.2 L9 回帰内訳

- `match-record-swipe` 正常 like · self-swipe 422
- `match-submit-report` · `match-block-user` · `match-submit-verification` → 200
- `match-admin-review`（非 admin T1）→ **403**

---

## 6. FAIL 記録

**該当なし** — deploy · smoke · L9 回帰すべて成功。

---

## 7. 次アクション

| 項目 | 状態 |
|------|------|
| P15-L3 Edge | **完了** |
| P15-L4 UI 配線 | **着手可**（`match-api.js` 等 · 別承認） |
| P15-L5 prod-parity UI | **未着手** |
| `tasful.jp` prod URL | **8 月まで保留** |

**判定:** **`READY_FOR_P15_L4_UI`**

---

## 8. 参照

| 文档 | 路径 |
|------|------|
| P15 機能計画 | `reports/tasful-match-p15-feature-plan.md` |
| L3 Edge 計画 | `reports/tasful-match-p15-l3-edge-plan.md` |
| L1 apply 結果 | `reports/tasful-match-p15-l1-apply-result.md` |
| Smoke script | `scripts/smoke-match-p15-l3-edge.mjs` |
| L9 smoke 参考 | `scripts/verify-auth-hook-l9-remote-edge-smoke.mjs`（import 禁止 · 別実行） |
