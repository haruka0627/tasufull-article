# TASFUL — Auth Hook linked ref L8 Edge prep 結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`** |
| 前提 | `tasful-auth-linked-ref-l7-backfill-expand.md` · L7 判定 `READY_FOR_LINKED_REF_L8_EDGE_PREP` |
| Hook | **ON**（L6 設定維持 · Dashboard 追加変更なし） |
| Edge 実行面 | **ローカル Deno smoke router**（`match-auth.ts` 実装 · MATCH **未 deploy**） |

---

## 1. 実施サマリ

| # | L8 確認項目 | 結果 |
|---|-------------|------|
| 1 | JWT claim 優先順位（Edge stub 相当） | **PASS**（§3） |
| 2 | T1–T5 実 JWT Edge smoke | **PASS**（§4） |
| 3 | missing / invalid token → 401/403 | **PASS**（§5） |
| 4 | demo `u_me` / `u_hiro` 誤接続なし | **PASS**（§6） |
| 5 | Hook ON · linked ref 5xx なし | **PASS**（§7） |
| 6 | 既存 7 件 L1 baseline | **PASS**（§8） |
| 7 | MATCH migration 未適用 | **PASS**（§8） |

**実行**

```bash
node scripts/verify-auth-hook-l8-edge-prep.mjs
```

**自動検証:** `L8 result: PASS (8 checks)`

**判定:** **`READY_FOR_LINKED_REF_L9_EDGE_SMOKE`**

---

## 2. スコープ · 未実施（意図）

| 項目 | L8 状態 |
|------|---------|
| MATCH Edge **deploy** to linked ref | **未実施**（`supabase functions list` に `match-*` **0 件**） |
| MATCH migration / RLS | **未適用** |
| Hook 関数変更 | **なし** |
| T1–T5 / legacy 7 metadata | **変更なし** |
| UI 変更 | **なし** |

**L8 の Edge smoke:** デプロイ済み remote ではなく、**本 repo の `match-auth.ts` + 7 stub handlers** を `scripts/match-local-edge-smoke-server.ts` 経由で実行。**Auth claim 経路の prep 確認**が目的。

**L9 へ:** linked ref への MATCH 7 functions deploy + remote smoke。

---

## 3. JWT claim 読取優先順位

**参照実装:** `supabase/functions/_shared/match-auth.ts` · `extractTalkUserIdFromClaims`

| 優先 | ソース | L8 確認 |
|------|--------|---------|
| 1 | `app_metadata.talk_user_id` | **PASS** |
| 2 | root `talk_user_id` | **PASS** |
| 3 | `app_metadata.member_id` | **PASS** |
| — | `sub`（UUID） | **使用しない** · sub-only → Edge **403** |
| — | `user_metadata.talk_user_id` | **信用しない** |
| dev のみ | `stub-match-token` → `stub-user-current` | stub 経路は **demo fallback ではない** · `u_me`/`u_hiro` と非一致 |

**Node mirror:** `scripts/lib/match-auth-claim-core.mjs`（unit テスト）  
**Deno regression:** `scripts/test-match-edge-jwt-stub.mjs` **PASS**

**member_id:** Edge は `matchUserId := talkUserId`（`requireUser`）。JWT 上は `app_metadata.member_id` を L8 で slot ID と一致確認。

---

## 4. T1–T5 実 JWT Edge smoke

**方法:** linked ref password grant → **Supabase 発行 access_token**（本文非掲載）→ ローカル `POST /functions/v1/match-record-swipe`

| Slot | login | swipe (他 slot target) | self-swipe | 解決 talk ID |
|------|-------|------------------------|------------|--------------|
| T1 | 200 | **200** stub ok | **422** | **`t1`** |
| T2 | 200 | **200** | **422** | **`t2`** |
| T3 | 200 | **200** | **422** | **`t3`** |
| T4 | 200 | **200** | **422** | **`t4`** |
| T5 | 200 | **200** | **422** | **`t5`** |

### 4.1 JWT app_metadata（Hook ON · 全 slot 共通パターン）

| claim | 値 |
|-------|-----|
| `talk_user_id` / `member_id` | slot ID（`t1`–`t5`） |
| `provider` / `providers` | `email` / `["email"]` |
| `role` | `authenticated`（hook merge） |
| `platform_role` | `member` |
| `is_ops` | `false` |

---

## 5. missing / invalid token

| ケース | HTTP | code | demo fallback |
|--------|------|------|---------------|
| Bearer なし | **401** | `unauthorized` | **なし** |
| 不正 JWT 文字列 | **401** | `unauthorized` | **なし** |
| sub-only unsigned JWT | **403** | `forbidden` | **なし**（`talk_user_id` 必須） |

---

## 6. demo ID 誤接続防止

| 確認 | 結果 |
|------|------|
| allowlist JWT → Edge 解決 ID | **`t1`–`t5` のみ** · **`u_me` / `u_hiro` なし** |
| `x-match-user-id: u_me` ヘッダ | JWT `talk_user_id` **優先** · ヘッダ **非信用**（200 でも本人 ID は slot ID） |
| payload `swiper_user_id` 等 | auth に **未使用**（既存 stub 設計どおり） |

---

## 7. Hook ON · API 健全性

| 監視 | 結果 |
|------|------|
| T1–T5 login（linked ref） | **200** |
| Edge smoke（local） | **5xx なし** |
| `GET /auth/v1/health` | **200** |
| `GET /rest/v1/` | **401**（gateway 正常 · 5xx なし） |

---

## 8. DB 不変確認

| 確認 | 結果 |
|------|------|
| T1–T5 metadata | L7 状態 **維持**（`t1`–`t5`） |
| 既存 7 件 | **7 件** · L1 baseline **diff なし** |
| `custom_access_token_hook` | **1 件** · **未変更** |
| `match_*` テーブル | **0** |

---

## 9. 禁止事項の遵守

| 禁止 | 遵守 |
|------|------|
| metadata 変更 | ✓ |
| Hook / Dashboard / RLS / MATCH / UI | ✓ |
| legacy demo JWT 刷新 | ✓ |

---

## 10. rollback 参照（未実施）

| 段階 | 手順 |
|------|------|
| 1 | Dashboard Hook **OFF**（L6 §11） |
| 2 | L1 baseline 論理復旧 |
| 3 | 必要時 L5 `DROP FUNCTION custom_access_token_hook` |

---

## 11. 成果物

| ファイル | 用途 |
|----------|------|
| `scripts/verify-auth-hook-l8-edge-prep.mjs` | L8 自動検証 |
| `scripts/lib/match-auth-claim-core.mjs` | claim 優先順位 mirror（Node） |
| `sql/auth-hook-l8-verify-readonly.sql` | READ 監査 |
| `sql/auth-hook-l8-verify-gates.sql` | CLI gates |

---

## 12. 判定

| 判定 | 理由 |
|------|------|
| **`READY_FOR_LINKED_REF_L9_EDGE_SMOKE`** | claim 経路 prep PASS · T1–T5 実 JWT local Edge smoke PASS · invalid 拒否 · demo 非接続 · DB/MATCH 不変 |

---

## 13. 次ステップ（L9）

| 順 | 作業 |
|----|------|
| 1 | linked ref へ MATCH 7 Edge functions **deploy** |
| 2 | T1–T5 Bearer で **remote** smoke（`x-match-user-id` なし） |
| 3 | T4 admin claim 必要なら **別フェーズ**で role backfill 検討（L8 では未実施） |
| 4 | 記録: `match-staging-edge-smoke-result-signed-jwt.md` 相当 |
