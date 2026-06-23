# TASFUL — MATCH post-auth final smoke 結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`** |
| 前提 | L0–L12 適用済み · L12 判定 `READY_FOR_MATCH_POST_AUTH_FINAL_SMOKE` |
| L11 確認 | `tasful-auth-linked-ref-l11-rls-d2.md` **PASS** 前提を満たす状態 |
| Hook | **ON** · **EXCEPTION**（U-7 P2） |
| RLS | **8/8** · policies **20** |

---

## 1. 最終判定

**`READY_FOR_MATCH_UI_PROD_URL_REVIEW`**

本 smoke は **本番 URL（tasful.jp）レビュー前の最終ゲート** として PASS。linked ref 上の Auth / RLS / Edge / schema 回帰と、ローカル UI 主要導線（mock + wiring）を確認した。

---

## 2. 実施サマリ

| # | 確認項目 | 結果 |
|---|----------|------|
| 1 | T1–T5 login / refresh 全員成功 | **PASS**（§4） |
| 2 | 欠落ユーザー token 発行不可 | **PASS** · `t6@tasful.invalid`（§5） |
| 3 | TasuAuthCurrentUser `source=jwt`（T1–T5） | **PASS**（§4） |
| 4 | MATCH Edge 7 functions ACTIVE | **PASS**（§6） |
| 5 | user-facing functions 200 系 | **PASS**（§6） |
| 6 | admin-review 一般ユーザー 403 | **PASS**（§6） |
| 7 | RLS regression | **PASS**（§7） |
| 8 | metadata diff なし（legacy 7 · T1–T5） | **PASS**（§8） |
| 9 | schema/RLS（tables 8 · RLS 8/8 · policies 20） | **PASS**（§3） |
| 10 | auth/rest/edge health 5xx なし | **PASS**（§9） |
| 11 | UI MATCH 主要導線 | **PASS**（§10） |
| 12 | 最終判定記録 | **本レポート §1** |

**実行**

```bash
node scripts/verify-match-post-auth-final-smoke.mjs
node scripts/verify-match-post-auth-final-smoke.mjs --skip-ui
```

**自動検証:** `Final smoke result: PASS (8 checks)`

---

## 3. SQL gates（schema / RLS / Hook / metadata）

`sql/match-post-auth-final-smoke-readonly.sql` combined row:

| 指標 | 期待 | 実測 |
|------|------|------|
| `core_table_count` | 8 | **8** |
| `rls_enabled_count` | 8 | **8** |
| `policy_count` | 20 | **20** |
| `hook_func_count` | 1 | **1** |
| `hook_exception_mode` | 1 | **1** |
| `legacy_user_count` | 7 | **7** |
| `allowlist_backfill_count` | 5 | **5** |
| `t6_user_count` | 0 | **0** |

---

## 4. Auth · JWT · TasuAuthCurrentUser（T1–T5）

| Slot | login | refresh | talk | member | TasuAuth `source` |
|------|-------|---------|------|--------|-------------------|
| T1 | 200 | 200 | `t1` | `t1` | **jwt** |
| T2 | 200 | 200 | `t2` | `t2` | **jwt** |
| T3 | 200 | 200 | `t3` | `t3` | **jwt** |
| T4 | 200 | 200 | `t4` | `t4` | **jwt** |
| T5 | 200 | 200 | `t5` | `t5` | **jwt** |

**Hook merge 維持:** `role=authenticated` · `platform_role=member` · `is_ops=false` · `provider`/`providers` 維持

**検証環境:** `talkProductionMode=true`（`tasful.jp` 相当）で localStorage fallback **不使用**

---

## 5. 欠落ユーザー拒否（t6）

| 操作 | 結果 |
|------|------|
| `t6@tasful.invalid` 作成（talk/member なし） | service_role · 一時のみ |
| password login | **拒否**（access_token なし） |
| 検証後 delete | **`t6_user_count=0`** |

**既存 7 件:** login/refresh **未実施**（L12 方針継続）· metadata SQL diff なし

---

## 6. Remote Edge smoke（linked ref）

| Function | T1 代表 | HTTP |
|----------|---------|------|
| `match-record-swipe` | like → t2 | **200** |
| `match-record-swipe` | self | **422** |
| `match-submit-report` | harassment | **200** |
| `match-block-user` | block t3 | **200** |
| `match-submit-verification` | phone | **200** |
| `match-admin-review` | T1 | **403** |

**Deploy 状態:** 7 件 **ACTIVE**（`supabase functions list`）

---

## 7. RLS regression

| ケース | 結果 |
|--------|------|
| T1 own `match_profiles` INSERT | **PASS** |
| T1 PATCH T2 profile | **拒否** |
| T1 SELECT `match_pairs`（t1/t2） | **可** |
| T3 SELECT 同上 | **拒否** |
| anon SELECT | **拒否** |
| invalid JWT | **401/403** |
| sub-only JWT | **401/403** |

---

## 8. metadata 不変

| コホート | 方法 | 結果 |
|----------|------|------|
| legacy 7 `@tasful-dev.test` | SQL count + L1 照合 | **7 件 · diff なし** |
| allowlist T1–T5 | SQL `talk_user_id`/`member_id` = t1–t5 | **5/5** |

---

## 9. API health

| エンドポイント | 5xx |
|----------------|-----|
| `/auth/v1/health` | **なし** |
| `/rest/v1/` | **なし** |
| Edge `OPTIONS match-record-swipe` | **なし** |

---

## 10. UI 主要導線（ローカル · `http://127.0.0.1:8788`）

**方法:** Playwright · `deploy/cloudflare/dist/match/`（wrangler pages dev または既存 dev サーバー）

| 導線 | ページ | 確認内容 |
|------|--------|----------|
| profile create | `match-profile-create.html` | `[data-match-profile-wizard]` · step next |
| swipe | `match-swipe.html` | like/skip UI · `MatchWiring` · skip→`recordSwipe` |
| list | `match-list.html` | `[data-match-pair-list]` · tabbar |
| talk bridge | `match-talk-bridge.html` | `[data-match-talk-cta]` · `ensureTalkRoom` |
| safety | `match-safety.html` | hero · verify リンク |

**注:** UI は **MOCK + client stub** 段階。本番 URL レビュー（次フェーズ）で tasful.jp 配下パス・本番 config を別途確認する。

---

## 11. L0–L12 適用状態（回帰確認）

| フェーズ | 内容 | 本 smoke で確認 |
|----------|------|-----------------|
| L5–L6 | Hook CREATE · ON | 関数存在 · merge 動作 |
| L7 | allowlist backfill | T1–T5 metadata |
| L9 | Edge deploy | 7 ACTIVE · remote smoke |
| L10 | MATCH schema | 8 tables |
| L11 | RLS D2 | 8/8 · 20 policies · REST |
| L12 | Hook EXCEPTION | missing-id 拒否 · allowlist OK |

---

## 12. 成果物

| ファイル | 用途 |
|----------|------|
| `reports/tasful-match-post-auth-final-smoke.md` | 本レポート |
| `scripts/verify-match-post-auth-final-smoke.mjs` | 自動 final smoke |
| `sql/match-post-auth-final-smoke-readonly.sql` | READ-ONLY SQL gates |

---

## 13. Rollback 参照（PITR 無効）

| 層 | 手順 |
|----|------|
| Hook | OFF → L5 WARN 関数復元（`reports/tasful-auth-linked-ref-l12-hook-exception.md`） |
| RLS | L11 migration 逆操作（policies disable） |
| Schema | L10 DROP（最終手段） |
| metadata | L1 baseline（`reports/tasful-auth-linked-ref-l1-backup-baseline.md`） |

---

## 14. 次フェーズ

| 項目 | 内容 |
|------|------|
| 次 | **MATCH UI prod URL review** |
| 前提 | 本判定 **`READY_FOR_MATCH_UI_PROD_URL_REVIEW`** |
| スコープ | tasful.jp 配下 MATCH URL · 本番 config · E2E（別ゲート） |
