# TASFUL — Auth Hook linked ref L9 remote Edge smoke 結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`** |
| 前提 | `tasful-auth-linked-ref-l8-edge-prep.md` · L8 判定 `READY_FOR_LINKED_REF_L9_EDGE_SMOKE` |
| Hook | **ON**（L6 設定維持） |
| Edge | **remote** `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/` |

---

## 1. 実施サマリ

| # | L9 完了条件 | 結果 |
|---|-------------|------|
| 1 | match-* 7 件 deploy 一覧 · 適用 | **PASS**（§2） |
| 2 | T1–T5 実 JWT remote smoke | **PASS**（§4） |
| 3 | invalid token 401 / sub-only 403 | **PASS**（§5） |
| 4 | self-swipe 422 · bad input 400/422 | **PASS**（§5） |
| 5 | auth/rest/edge 5xx なし | **PASS**（§6） |
| 6 | legacy 7 / allowlist metadata 不変 | **PASS**（§7） |
| 7 | MATCH migration 未適用 | **PASS**（§7） |

**実行**

```bash
node scripts/verify-auth-hook-l9-remote-edge-smoke.mjs
node scripts/verify-auth-hook-l9-remote-edge-smoke.mjs --skip-deploy
```

**自動検証:** `L9 result: PASS (7 checks)`

**判定:** **`READY_FOR_LINKED_REF_L10_MATCH_SCHEMA`**

---

## 2. Deploy 対象 · 実施

### 2.1 match-* Edge functions（7 件）

| # | Function | Guard | slug |
|---|----------|-------|------|
| 1 | `match-record-swipe` | `requireUser` | match-record-swipe |
| 2 | `match-ensure-talk-room` | `requireUser` | match-ensure-talk-room |
| 3 | `match-submit-report` | `requireUser` | match-submit-report |
| 4 | `match-block-user` | `requireUser` | match-block-user |
| 5 | `match-submit-verification` | `requireUser` | match-submit-verification |
| 6 | `match-admin-review` | `requireAdmin` | match-admin-review |
| 7 | `match-moderation-log` | `requireUser` | match-moderation-log |

### 2.2 Deploy コマンド

```bash
npx supabase functions deploy \
  match-record-swipe match-ensure-talk-room match-submit-report \
  match-block-user match-submit-verification match-admin-review match-moderation-log \
  --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes
```

| 設定 | 値 | 理由 |
|------|-----|------|
| `--no-verify-jwt` | **有効** | auth は `match-auth.ts` `requireUser` が担当（L8 と同型 · sub-only **403** を function 内で返す） |
| `--use-api` | **有効** | server-side bundle（ローカル Docker 非依存） |

**確認:** `supabase functions list --project-ref ddojquacsyqesrjhcvmn` → **7 件 ACTIVE**（version **1** · 初回 deploy）

**未 deploy / 未変更:** Stripe · GenAI · TALK 等の既存 Edge functions

---

## 3. Auth claim 経路（remote · `match-auth.ts` stub）

| 優先 | ソース | remote 確認 |
|------|--------|-------------|
| 1 | `app_metadata.talk_user_id` | **PASS**（T1–T5） |
| 2 | root `talk_user_id` | L8 unit 済 · remote は allowlist JWT |
| 3 | `app_metadata.member_id` | **PASS**（JWT decode · slot ID 一致） |
| — | `sub` UUID | **403**（talk 無し unsigned JWT） |
| — | demo `u_me` / `u_hiro` | **非接続** |

**Hook merge claims（JWT · 全 slot）:** `role=authenticated` · `platform_role=member` · `is_ops=false`

---

## 4. T1–T5 remote smoke（`match-record-swipe`）

**方法:** password grant → Supabase **署名付き** access_token（本文非掲載）→ remote POST

| Slot | login | swipe → 他 slot | 解決 talk/member | self-swipe |
|------|-------|-----------------|------------------|------------|
| T1 | 200 | **200** | **t1** | **422** |
| T2 | 200 | **200** | **t2** | **422** |
| T3 | 200 | **200** | **t3** | **422** |
| T4 | 200 | **200** | **t4** | **422** |
| T5 | 200 | **200** | **t5** | **422** |

### 4.1 追加 user-facing functions（T1 token · 代表）

| Function | HTTP | 備考 |
|----------|------|------|
| match-ensure-talk-room | **200** | stub mode |
| match-submit-report | **200** | |
| match-block-user | **200** | |
| match-submit-verification | **200** | |
| match-moderation-log | **200** | |
| match-admin-review | **403** | T1 は admin claim 無し · 期待どおり |

---

## 5. invalid / bad input smoke

| ケース | HTTP | code |
|--------|------|------|
| Bearer なし | **401** | `unauthorized` |
| 不正 JWT | **401** | `unauthorized` |
| sub-only unsigned JWT | **403** | `forbidden` |
| 不正 JSON body `{` | **400** | `invalid_json` |
| 不正 action enum | **422** | `validation_error` |
| self-swipe | **422** | `validation_error` |

**demo fallback:** **なし**（allowlist JWT のみで talk ID 解決）

**注:** deploy 直後の cold start で一時 **502** が出る場合あり · script は warmup + 502 retry を実施。

---

## 6. API 健全性（5xx なし）

| 経路 | 結果 |
|------|------|
| `GET /auth/v1/health` | **200** |
| `GET /rest/v1/` | **401**（gateway 正常） |
| `OPTIONS /functions/v1/match-record-swipe` | **< 500** |
| remote Edge POST（全 smoke） | **5xx なし**（warmup 後） |

---

## 7. DB · metadata 不変

| 確認 | 結果 |
|------|------|
| T1–T5 talk/member | **t1–t5** · **変更なし** |
| legacy 7 `@tasful-dev.test` | **7 件** · L1 baseline **diff なし** |
| `custom_access_token_hook` | **1 件** · **未変更** |
| `match_*` テーブル | **0**（migration **未適用**） |
| Hook / Dashboard / RLS / UI | **変更なし** |

---

## 8. 禁止事項の遵守

| 禁止 | 遵守 |
|------|------|
| MATCH migration / RLS | ✓ |
| metadata 変更 | ✓ |
| Hook / Dashboard / UI | ✓ |
| legacy 7 JWT 刷新 | ✓ |

---

## 9. rollback 参照

| 段階 | 手順 |
|------|------|
| Edge のみ | Dashboard / CLI で match-* functions **delete** または旧 revision |
| Auth | Hook OFF（L6 §11） |
| DB hook | L5 DROP FUNCTION（通常 L10 前不要） |

---

## 10. 成果物

| ファイル | 用途 |
|----------|------|
| `scripts/verify-auth-hook-l9-remote-edge-smoke.mjs` | deploy + remote smoke |
| `sql/auth-hook-l9-verify-readonly.sql` | READ 監査 |
| `sql/auth-hook-l9-verify-gates.sql` | CLI gates |

---

## 11. 判定

| 判定 | 理由 |
|------|------|
| **`READY_FOR_LINKED_REF_L10_MATCH_SCHEMA`** | match-* 7 件 remote deploy · T1–T5 実 JWT smoke PASS · invalid/validation PASS · DB/MATCH 不変 |

---

## 12. 次ステップ（L10）

| 順 | 作業 |
|----|------|
| 1 | `20260621120000_match_schema_draft.sql` migration **適用**（linked ref · 別フェーズ承認） |
| 2 | RLS draft migration（L10+ · 別 gate） |
| 3 | Edge `verifyJwt` 本実装（署名検証 · 別 PR） |
| 4 | legacy 7 件は引き続き **非接触** |
