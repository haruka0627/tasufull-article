# TASFUL LIVE (TLV) — リリース確定

**バージョン:** `v1.0 Production Ready`  
**確定日:** 2026-06-25  
**状態:** ✅ Production Ready · **FEATURE FROZEN**

以降、TLV 関連では **新機能追加・UI変更・レイアウト変更を禁止** します。  
修正対象は **Critical Bug / Security / Production 障害** のみです。

---

## 総合判定

| 項目 | 判定 |
|------|------|
| **Production Ready** | ✅ 確定（Critical 0） |
| **Release Candidate** | ✅ 到達済み（P2 完了） |
| **Feature Freeze** | ✅ **本ドキュメント時点で確定** |
| P0 / P1 | 修正済み・維持 |
| Playwright（最終） | **9/9 PASS** |

---

## Feature Freeze ポリシー

### 禁止（TLV スコープ）

- 新機能追加
- UI 変更
- レイアウト変更
- DB / RLS / migration 変更（障害対応を除く）
- 通知仕様の拡張・変更

### 許可

| 種別 | 例 |
|------|-----|
| **Critical Bug** | 本番で再現するクラッシュ、データ破損、通知未達 |
| **Security** | 認証バイパス、dev 漏れ、JWT/RLS 不備 |
| **Production 障害** | 配信不能、Edge 5xx、Pages 404 |

### スコープ

- `live/**`
- `deploy/cloudflare/dist/live/**`
- `supabase/functions/live-*` および TLV 通知 Edge
- `scripts/test-tlv-*` / `scripts/audit-tlv-*`（回帰のみ）

---

## 公開前監査資料（保管先）

| 資料 | パス |
|------|------|
| Production Ready | [`tlv-v1-production-ready/01-production-ready.md`](tlv-v1-production-ready/01-production-ready.md) |
| QA / Release Candidate | [`tlv-v1-production-ready/02-qa-release-candidate.md`](tlv-v1-production-ready/02-qa-release-candidate.md) |
| Playwright 結果 | [`tlv-v1-production-ready/03-playwright-results.md`](tlv-v1-production-ready/03-playwright-results.md) |
| Security 結果 | [`tlv-v1-production-ready/04-security.md`](tlv-v1-production-ready/04-security.md) |
| TODO 棚卸し | [`tlv-v1-production-ready/05-todo-inventory.md`](tlv-v1-production-ready/05-todo-inventory.md) |
| dead code 削除候補 | [`tlv-v1-production-ready/06-dead-code-candidates.md`](tlv-v1-production-ready/06-dead-code-candidates.md) |
| バージョン記録 | [`tlv-v1-production-ready/VERSION.md`](tlv-v1-production-ready/VERSION.md) |
| 監査 JSON | [`tlv-v1-production-ready/artifacts/`](tlv-v1-production-ready/artifacts/) |

---

## 確定根拠（要約）

| 領域 | 結果 |
|------|------|
| 通知 5 種 | follow / comment / live_started / video_published / system — PASS |
| フォロー | dev fallback + prod guest — PASS |
| dev 漏れ対策 | P0/P1 完了、`prod-guest-check` / `dev-auth-security` PASS |
| title 文字化け | 0（P2 修正済み） |
| 有害 console | 0（localhost benign は分類済み） |
| 本番 URL | CF Access 保護下。未認証自動監査は TLV 未到達（手動スモーク推奨） |

---

## 残存（non-blocker）

- `system-notify-dev.html` dist 同梱（runtime localhost ガード）
- Lighthouse 未計測（任意）
- `audit-tlv-pre-release.mjs` localhost exit 1（既知 false positive）

詳細は各監査レポートを参照。
