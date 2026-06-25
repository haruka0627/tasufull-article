# TLV v1.0 Production Ready — 正式監査資料

**Baseline:** `v1.0` Production Ready  
**Freeze:** 2026-06-25  
**Status:** Feature Frozen

`reports/tlv-v1-production-ready/` を TLV の **正式監査資料** として扱う。

---

## 運用・バージョン（変更時は必ず更新）

| 資料 | ファイル |
|------|---------|
| **運用ルール（正式）** | [OPERATIONS.md](OPERATIONS.md) |
| **CI / QA ゲート** | [QA.md](QA.md) |
| **CHANGELOG** | [CHANGELOG.md](CHANGELOG.md) |
| **VERSION** | [VERSION.md](VERSION.md) |
| リリース確定サマリー | [../tlv-release-status.md](../tlv-release-status.md) |

---

## 監査レポート（v1.0 基準）

| # | 資料 | ファイル |
|---|------|---------|
| 1 | Production Ready 判定 | [01-production-ready.md](01-production-ready.md) |
| 2 | QA / Release Candidate（P2） | [02-qa-release-candidate.md](02-qa-release-candidate.md) |
| 3 | Playwright 結果 | [03-playwright-results.md](03-playwright-results.md) |
| 4 | Security 結果 | [04-security.md](04-security.md) |
| 5 | TODO 棚卸し | [05-todo-inventory.md](05-todo-inventory.md) |
| 6 | dead code 削除候補 | [06-dead-code-candidates.md](06-dead-code-candidates.md) |

---

## Artifacts（JSON）

| ファイル | 内容 |
|---------|------|
| [artifacts/pre-release-audit-report.json](artifacts/pre-release-audit-report.json) | pre-release 監査 |
| [artifacts/production-url-audit-report.json](artifacts/production-url-audit-report.json) | 本番 URL 監査 |
| [artifacts/channel-content-regression-report.json](artifacts/channel-content-regression-report.json) | channel-content 回帰 |

---

## 監査スクリプト

```
scripts/test-tlv-*.mjs          # Playwright
scripts/audit-tlv-pre-release.mjs
scripts/audit-tlv-production-ready.mjs
scripts/audit-tlv-dead-js.mjs
```

---

## Patch リリース時チェックリスト

1. 許可修正（Critical / Security / Production）のみか → [OPERATIONS.md](OPERATIONS.md)
2. Playwright + QA + Production Ready 監査 PASS → [QA.md](QA.md)
3. `CHANGELOG.md` / `VERSION.md` / `QA.md` 更新
4. バージョンを `v1.0.x` にインクリメント（機能追加は v1.1 へ）
