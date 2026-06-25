# TLV v1.0 Production Ready — 監査資料インデックス

**Version:** v1.0 Production Ready  
**Freeze:** 2026-06-25  
**Status:** Feature Frozen

---

## ドキュメント

| # | 資料 | ファイル |
|---|------|---------|
| — | **リリース確定・Feature Freeze** | [`../tlv-release-status.md`](../tlv-release-status.md) |
| 1 | Production Ready 判定 | [01-production-ready.md](01-production-ready.md) |
| 2 | QA / Release Candidate（P2） | [02-qa-release-candidate.md](02-qa-release-candidate.md) |
| 3 | Playwright 結果 | [03-playwright-results.md](03-playwright-results.md) |
| 4 | Security 結果 | [04-security.md](04-security.md) |
| 5 | TODO 棚卸し | [05-todo-inventory.md](05-todo-inventory.md) |
| 6 | dead code 削除候補 | [06-dead-code-candidates.md](06-dead-code-candidates.md) |
| — | バージョン記録 | [VERSION.md](VERSION.md) |

---

## Artifacts（JSON）

| ファイル | 内容 |
|---------|------|
| [artifacts/pre-release-audit-report.json](artifacts/pre-release-audit-report.json) | `audit-tlv-pre-release.mjs` 出力 |
| [artifacts/production-url-audit-report.json](artifacts/production-url-audit-report.json) | `audit-tlv-production-ready.mjs` 出力 |
| [artifacts/channel-content-regression-report.json](artifacts/channel-content-regression-report.json) | channel-content 62 チェック |

---

## 監査スクリプト

```
scripts/audit-tlv-pre-release.mjs
scripts/audit-tlv-production-ready.mjs
scripts/audit-tlv-dead-js.mjs
scripts/test-tlv-*.mjs
```
