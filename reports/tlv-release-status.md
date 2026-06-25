# TASFUL LIVE (TLV) — リリース確定

**基準バージョン:** `v1.0` Production Ready  
**確定日:** 2026-06-25  
**状態:** ✅ Production Ready · **FEATURE FROZEN**

正式運用ルール: [`tlv-v1-production-ready/OPERATIONS.md`](tlv-v1-production-ready/OPERATIONS.md)

---

## 運用ルール（要約）

### 禁止

- 新機能追加
- UI 変更
- レイアウト変更
- **CSS 調整**
- **リファクタリング**

### 許可

- **Critical Bug**
- **Security**
- **Production 障害**

### バージョン

| 変更種別 | バージョン |
|---------|-----------|
| 上記許可修正 | `v1.0.1`, `v1.0.2`, …（Patch） |
| 機能追加・UI 等 | **`v1.1` 以降のみ** |

### CI / QA（TLV 変更時のみ）

Playwright · QA · Production Ready 監査 — **全 PASS 必須、FAIL 時コミット禁止**

詳細: [`tlv-v1-production-ready/QA.md`](tlv-v1-production-ready/QA.md)

### ドキュメント更新（TLV 変更時）

`CHANGELOG` · `VERSION` · `QA` を同一変更で更新。

---

## 総合判定

| 項目 | 判定 |
|------|------|
| **Production Ready** | ✅ 確定（Critical 0） |
| **Release Candidate** | ✅ 到達済み（P2 完了） |
| **Feature Freeze** | ✅ 確定 |
| **運用ルール** | ✅ [`OPERATIONS.md`](tlv-v1-production-ready/OPERATIONS.md) |
| Playwright（v1.0 基準） | **9/9 PASS** |

---

## 正式監査資料（`reports/`）

| 資料 | パス |
|------|------|
| **運用ルール** | [`tlv-v1-production-ready/OPERATIONS.md`](tlv-v1-production-ready/OPERATIONS.md) |
| **CI / QA ゲート** | [`tlv-v1-production-ready/QA.md`](tlv-v1-production-ready/QA.md) |
| **CHANGELOG** | [`tlv-v1-production-ready/CHANGELOG.md`](tlv-v1-production-ready/CHANGELOG.md) |
| **VERSION** | [`tlv-v1-production-ready/VERSION.md`](tlv-v1-production-ready/VERSION.md) |
| インデックス | [`tlv-v1-production-ready/README.md`](tlv-v1-production-ready/README.md) |
| Production Ready | [`tlv-v1-production-ready/01-production-ready.md`](tlv-v1-production-ready/01-production-ready.md) |
| QA / Release Candidate | [`tlv-v1-production-ready/02-qa-release-candidate.md`](tlv-v1-production-ready/02-qa-release-candidate.md) |
| Playwright | [`tlv-v1-production-ready/03-playwright-results.md`](tlv-v1-production-ready/03-playwright-results.md) |
| Security | [`tlv-v1-production-ready/04-security.md`](tlv-v1-production-ready/04-security.md) |
| Artifacts | [`tlv-v1-production-ready/artifacts/`](tlv-v1-production-ready/artifacts/) |

---

## 確定根拠（v1.0 基準）

| 領域 | 結果 |
|------|------|
| 通知 5 種 | PASS |
| フォロー / prod guest / dev auth | PASS |
| title 文字化け | 0 |
| 有害 console | 0 |

---

## 残存（non-blocker）

- `system-notify-dev.html` dist 同梱
- Lighthouse 未計測
- `audit-tlv-pre-release` localhost exit 1（既知）

v1.0.x Patch では上記を理由に UI/機能変更を行わない。
