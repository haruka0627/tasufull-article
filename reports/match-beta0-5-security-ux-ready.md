# TASFUL MATCH — β0.5 セキュリティ・UX 完了判定

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 作成日 | **2026-06-22** |
| 判定 | **MATCH_BETA0_5_SECURITY_UX_READY** |

---

## 完了項目

| # | 項目 | 状態 | 成果物 |
|---|------|------|--------|
| 1 | JWT 署名検証 ON 準備 | ✓ | `reports/match-jwt-verify-on-readiness.md` |
| 2 | Edge `requireUserAsync` 統一 | ✓ | `reports/match-edge-auth-unification.md` |
| 3 | 未ログイン UX | ✓ | `reports/match-login-required-ux.md` |
| 4 | β allowlist 403 UX 維持 | ✓ | `match-beta-gate.js`（変更なし・優先順位調整） |

---

## 回帰検証

| コマンド | 結果 |
|----------|------|
| `node scripts/verify-match-auth-unification.mjs --skip-deploy` | **14/14 PASS** |
| `node scripts/verify-match-jwt-production.mjs --skip-deploy` | **15/15 PASS** |
| `node scripts/verify-match-beta-allowlist.mjs --skip-deploy` | **12/12 PASS** |
| `npm run smoke:match:p15-l5` | 下記実行 |

---

## 本番投入前（運用）

1. `MATCH_VERIFY_JWT=1` を Supabase secrets に設定
2. match-* Functions 再デプロイ
3. allowlist 手動追加は `reports/match-beta-allowlist-ops.md`

---

## 次フェーズ（スコープ外）

- P3 β1: 招待コード UI · 募集フォーム
