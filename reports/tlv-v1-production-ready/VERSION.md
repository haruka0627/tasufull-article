# TLV Version Record

| 項目 | 値 |
|------|-----|
| **Product** | TASFUL LIVE (TLV) |
| **Current version** | **v1.0** (Production Ready) |
| **Baseline** | v1.0 — 2026-06-25 |
| **Status** | Production Ready · Feature Frozen |
| **Git scope** | `live/`, `deploy/cloudflare/dist/live/`, TLV Edge functions |

---

## バージョン体系（確定）

| 種別 | 形式 | 用途 |
|------|------|------|
| **基準** | `v1.0` | Production Ready 到達時点の固定スナップショット |
| **Patch** | `v1.0.1`, `v1.0.2`, … | Critical Bug / Security / Production 障害の修正のみ |
| **Minor** | `v1.1`, `v1.2`, … | 機能追加・UI/レイアウト/CSS 変更（**v1.0 凍結中は不可**） |

### Patch の制約

- 新機能・UI・レイアウト・CSS・リファクタリングを含めない
- [OPERATIONS.md](OPERATIONS.md) の許可修正のみ
- リリース時は [CHANGELOG.md](CHANGELOG.md) + [QA.md](QA.md) を更新

### Minor（v1.1+）の扱い

Feature Freeze 解除は **v1.1 計画として別途承認**。v1.0.x では実施しない。

---

## Milestones（v1.0）

| Phase | 状態 |
|-------|------|
| Phase 5 通知完了 | ✅ |
| P0/P1 品質修正 | ✅ |
| P2 品質仕上げ | ✅ |
| Release Candidate | ✅ |
| Production Ready | ✅ |
| Feature Freeze / 運用ルール確定 | ✅ |

---

## 履歴

| バージョン | 日付 | 備考 |
|-----------|------|------|
| **v1.0** | 2026-06-25 | Production Ready · 基準バージョン固定 |

詳細は [CHANGELOG.md](CHANGELOG.md)。
