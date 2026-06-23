# TASFUL MATCH — ローカル Edge Smoke 実行結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実行日 | 2026-06-21 |
| 前提計画 | `reports/match-staging-edge-smoke-plan.md` |
| 判定入力 | `READY_FOR_STAGING_EDGE_SMOKE_EXECUTION` |
| **最終判定** | **LOCAL_EDGE_SMOKE_PASS** |

---

## 1. 実行環境

| 項目 | 値 |
|------|-----|
| OS | Windows 10 (win32 10.0.26200) |
| リポジトリ | `c:\Users\rubih\tasufull-article` |
| Supabase CLI | 2.101.0（`npx supabase`） |
| Deno | 2.8.3（`npx deno` · 既存 Edge テストと同じ） |
| Node | v24.15.0 |
| Docker Desktop | **未インストール / 未起動** |
| Cloudflare Pages dev | `http://127.0.0.1:8788`（回帰テスト用 · 実行時起動済み） |

### 実行方式（重要）

| 計画 | 実際 |
|------|------|
| `supabase functions serve` @ `:54321` | **不可** — Docker 前提エラー |
| 代替 | **`scripts/match-local-edge-smoke-server.ts`** — Deno ルーターが **同一 URL パス** `http://127.0.0.1:54321/functions/v1/{name}` で 7 handler を実行 |
| リモート deploy | **未実施** |
| DB / RLS / Auth 本接続 | **未実施** |
| UI `edge_stub` 切替 | **未実施** |

代替ルーターは各 `match-*/index.ts` の **export 済み `handler`** を直接呼び出す。ビジネスロジック・`match-auth.ts` は本番 Function と同一。

---

## 2. 実行コマンド

```bash
# 一括 smoke + 回帰（本実行で使用）
node scripts/test-match-local-edge-smoke.mjs

# 内訳: Deno smoke server 起動 → HTTP 検証 → server 停止 → 既存 7 スイート
```

手動 server 起動（参考）:

```bash
npx deno run --allow-net --allow-read scripts/match-local-edge-smoke-server.ts
```

計画どおりの `supabase functions serve`（Docker 必要 · **今回未実行**）:

```bash
npx supabase functions serve match-record-swipe match-ensure-talk-room \
  match-submit-report match-block-user match-submit-verification \
  match-admin-review match-moderation-log --no-verify-jwt
```

---

## 3. 対象 Function

| Function | smoke |
|----------|-------|
| `match-record-swipe` | ✓ |
| `match-ensure-talk-room` | ✓ |
| `match-submit-report` | ✓ |
| `match-block-user` | ✓ |
| `match-submit-verification` | ✓ |
| `match-admin-review` | ✓ |
| `match-moderation-log` | ✓ |

---

## 4. Bearer なし結果

| 項目 | 結果 |
|------|------|
| リクエスト | `POST /match-record-swipe` · body `{ target_user_id, action: like }` · Authorization **なし** |
| HTTP | **401** |
| body.code | `unauthorized` |
| 判定 | **PASS** |

---

## 5. stub-match-token 結果

| Function | HTTP | ok | mode |
|----------|------|-----|------|
| `match-record-swipe` | 200 | true | stub |
| `match-ensure-talk-room` | 200 | true | stub |
| `match-submit-report` | 200 | true | stub |
| `match-block-user` | 200 | true | stub |
| `match-submit-verification` | 200 | true | stub |
| `match-moderation-log` | 200 | true | stub |

Token: `Authorization: Bearer stub-match-token`  
Edge 解決 `matchUserId`: `stub-user-current`

---

## 6. dummy JWT 結果

**Token 生成（staging stub · 署名検証なし）**

```json
{
  "app_metadata": {
    "talk_user_id": "stub-user-current",
    "role": "match_admin"
  }
}
```

| テスト | HTTP | 判定 |
|--------|------|------|
| `match-record-swipe` + dummy JWT | 200 · `ok:true` | **PASS** |
| `match-admin-review` + dummy JWT（match_admin） | 200 · `reviewed:true` | **PASS** |

> **本番注意:** dummy JWT は `decodeJwtPayloadStub` の stub 専用。**本番では Supabase 署名検証必須。**

---

## 7. super_like 結果

| 項目 | 値 |
|------|-----|
| payload | `{ "target_user_id": "stub-user-yui", "action": "super_like" }` |
| HTTP | **422** |
| code | `phase_not_enabled` |
| 判定 | **PASS** |

---

## 8. admin review 結果

| ケース | 条件 | HTTP | code | 判定 |
|--------|------|------|------|------|
| JWT admin | dummy JWT · `role: match_admin` | 200 | — | PASS |
| dev fallback | `stub-match-token` + `x-match-admin: true` | 200 | — | PASS |
| 拒否 | `stub-match-token` のみ | 403 | `forbidden` | PASS |

---

## 9. CORS / OPTIONS 結果

```http
OPTIONS /functions/v1/match-record-swipe
Origin: http://127.0.0.1:8788
Access-Control-Request-Method: POST
```

| 項目 | 値 |
|------|-----|
| HTTP | **200** |
| Access-Control-Allow-Origin | `http://127.0.0.1:8788` |
| Access-Control-Allow-Methods | POST 含む |
| 判定 | **PASS** |

---

## 10. DB 未接続確認

| 方法 | 結果 |
|------|------|
| 静的 grep | `supabase/functions/match-*` + `_shared/match-auth.ts` — `createClient` / `.from(` **0 件** |
| 実行時 | stub 固定 ID のみ返却 · postgres エラーなし |
| service_role | client / smoke から **未使用** |

---

## 11. 追加確認（計画 10 項目）

| # | 確認 | 結果 |
|---|------|------|
| 4 | `x-match-user-id: fake-attacker-id` + stub token → 仍 200 | PASS |
| 5 | payload `swiper_user_id: fake-attacker-id` → 仍 200 | PASS |
| 6 | 本人スワイプ `target_user_id: stub-user-current` → 422 | PASS |
| 9 | `match-api.js` 正規化 | 既存 `test-match-api-fetch-draft.mjs` PASS（edge_stub mock） |
| 10 | client_stub 回帰 | 全スイート PASS（§12） |

---

## 12. 既存テスト結果

```text
node scripts/test-match-local-edge-smoke.mjs
→ 26 passed, 0 failed
```

| スイート | 結果 |
|----------|------|
| `test-match-auth-stub.mjs` | PASS |
| `test-match-data-stub.mjs` | PASS |
| `test-match-ui-wiring-stub.mjs` | PASS |
| `test-match-mock-ui.mjs` | PASS |
| `test-match-api-client-stub.mjs` | PASS |
| `test-match-api-fetch-draft.mjs` | PASS |
| `test-match-edge-jwt-stub.mjs` | PASS |

デフォルト UI / `client_stub` · fetch 無効 — **回帰なし**。

---

## 13. 問題点

| # | 問題 | 影響 | 対応 |
|---|------|------|------|
| P1 | **Docker 未導入** — `supabase functions serve` 不可 | 計画どおりの CLI serve は未検証 | Deno ルーターで **同一 URL・同一 handler** を代替実行済み |
| P2 | dummy JWT **署名検証なし** | staging stub のみ | 本番前に `verifyJwt` 必須（既知 · 設計書記載） |
| P3 | `x-match-admin` dev fallback 残存 | 本番リスク | 本番 Edge 実装時に削除 TODO 済み |

**smoke ブロッカー:** なし（P1 は代替でカバー）。

---

## 14. 修正した場合の内容

smoke 実行のための **最小インフラ変更**（新機能ではなく serve / 検証用）:

| 変更 | 内容 |
|------|------|
| `supabase/functions/match-*/index.ts` ×7 | `export async function handler` + `if (import.meta.main) Deno.serve(handler)` |
| `scripts/match-local-edge-smoke-server.ts` | **新規** — `:54321/functions/v1` Deno ルーター |
| `scripts/test-match-local-edge-smoke.mjs` | **新規** — HTTP smoke + 回帰ランチャー |

**未変更:** `match-api.js` デフォルト · UI HTML · SQL · Supabase remote · TALK/Builder/Marketplace

---

## 15. 次ステップ

| 優先 | 作業 | 備考 |
|------|------|------|
| 1 | **MATCH 機能凍結維持** — Auth Hook / RLS / DB 適用は別ゲート | 本 smoke では未着手 |
| 2 | Docker 導入後 **`supabase functions serve` 再 smoke**（任意） | CLI ゲートウェイ差分の確認 |
| 3 | staging 専用 Supabase ref への **remote deploy smoke**（任意 · infra 合意後） | 本番 ref 禁止 |
| 4 | `match-api.js` edge_stub + ローカル serve の **ブラウザ手動 smoke**（コンソールのみ） | UI 切替禁止のまま |
| 5 | JWT 本番 verify · `talk_user_id` backfill · RLS D2 適用 | Auth STEP 2 以降 |

---

## 16. 実行記録サマリ

| カテゴリ | PASS | FAIL |
|----------|------|------|
| HTTP smoke | 16 | 0 |
| DB 静的 | 1 | 0 |
| 回帰テスト | 7 | 0 |
| **合計** | **26** | **0** |

---

## 判定

### **LOCAL_EDGE_SMOKE_PASS**

**理由**

- 計画 10 項目を HTTP smoke で確認（Bearer · stub/JWT · admin · CORS · payload/header 非信頼 · super_like · DB なし）
- 7 Function すべて 200（正常系）
- 既存 client / UI 回帰 7 スイート PASS
- リモート deploy / DB / RLS / UI edge_stub / 本番ドメイン — **すべて未実施**（制約遵守）

**補足:** `supabase functions serve` は Docker 不足のため未実行。Deno ルーター代替は **同一 handler ソース** で同等 smoke を完了。

---

## 参照

| ファイル | 用途 |
|----------|------|
| `scripts/test-match-local-edge-smoke.mjs` | 実行ランチャー |
| `scripts/match-local-edge-smoke-server.ts` | ローカル `:54321` ルーター |
| `reports/match-staging-edge-smoke-plan.md` | 計画 |
