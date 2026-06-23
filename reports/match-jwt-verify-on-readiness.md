# TASFUL MATCH — JWT 署名検証 ON 本番準備

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 作成日 | **2026-06-22** |
| 判定 | **JWT_VERIFY_ON_READY（本番 ENV 設定待ち）** |

---

## 1. 仕組み

| レイヤ | 検証内容 |
|--------|----------|
| **Supabase Edge プラットフォーム** | デプロイ時 `--no-verify-jwt` — ゲートウェイでは JWT 未検証（意図的） |
| **MATCH Edge `_shared/match-auth.ts`** | `MATCH_VERIFY_JWT=1` 時、`/auth/v1/user` で **署名付き JWT を Supabase Auth が検証** |
| **stub token** | `stub-match-token` は verify スキップ（localhost デモ専用） |

`MATCH_VERIFY_JWT=1` かつ実 JWT の場合:

1. `verifyBearerWithSupabase()` が `/auth/v1/user` を呼ぶ
2. 失敗 → **401 `unauthorized`**（decode フォールバック **なし**）
3. 成功 → `authMode: jwt_verified`

`MATCH_VERIFY_JWT` 未設定 / `0` の場合:

- 従来どおり payload decode（linked ref 検証スクリプト互換）
- stub token は decode パス

---

## 2. 本番 ENV 必須値

| 変数 | 必須 | 説明 |
|------|------|------|
| `SUPABASE_URL` | Yes | Supabase 自動注入 |
| `SUPABASE_ANON_KEY` | Yes | Supabase 自動注入 |
| `MATCH_VERIFY_JWT` | **本番 `1`** | JWT 署名検証 ON |
| `MATCH_BETA_GATE_DISABLED` | No | `1` で allowlist ゲート無効（緊急のみ） |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | DB bridge 用（既存） |

設定例:

```bash
npx supabase secrets set MATCH_VERIFY_JWT=1 --project-ref ddojquacsyqesrjhcvmn
npx supabase functions deploy match-search-profiles ... --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt
```

**注意:** プラットフォーム `--no-verify-jwt` は **維持**。アプリ層 `MATCH_VERIFY_JWT=1` が実検証担当。

---

## 3. `--no-verify-jwt` 棚卸し

| 項目 | 状態 |
|------|------|
| 全 `match-*` deploy | `--no-verify-jwt` 使用（検証スクリプト共通） |
| 理由 | Custom Access Token Hook · `talk_user_id` claim をアプリ側で解釈するため |
| リスク緩和 | `requireUserAsync` + `MATCH_VERIFY_JWT=1` で Auth API 検証 |
| admin `x-match-admin` fallback | **`MATCH_VERIFY_JWT=1` 時は無効** |

---

## 4. ローカル / stub / demo 互換

| 環境 | 挙動 |
|------|------|
| localhost + `client_stub=1` | Edge 未呼び出し · 影響なし |
| localhost + stub token | `tokenMode: stub` · verify スキップ · 200 stub 応答 |
| linked ref 検証 T1–T5 | 実 JWT · allowlist seed · **PASS** |
| 本番 tasful.jp 未ログイン | `match-login-gate.js` · Edge 401 前に UI 表示 |

---

## 5. 確認チェックリスト（本番投入前）

- [ ] `MATCH_VERIFY_JWT=1` を linked/prod secrets に設定
- [ ] 全 match-* Function 再デプロイ
- [ ] `node scripts/verify-match-jwt-production.mjs --skip-deploy` PASS
- [ ] `node scripts/verify-match-beta-allowlist.mjs --skip-deploy` PASS
- [ ] 不正 JWT（改ざん payload）が 401 になることを確認
- [ ] stub-match-token がローカル smoke で動作（`client_stub=1` / demo）

---

## 6. 判定

| 項目 | 状態 |
|------|------|
| コード準備 | **完了** |
| linked ref（VERIFY off）回帰 | **PASS** |
| 本番 secrets 設定 | **運用待ち** |
| 総合 | **JWT_VERIFY_ON_READY** |
