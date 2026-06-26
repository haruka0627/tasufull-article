# TLV AI（導線）

**最終更新:** 2026-06-26  
**ステータス:** 導線接続済 · TLV 専用 AI なし  
**直近コミット:** `5ed9672`

---

## 方針（決定）

| 項目 | 内容 |
| --- | --- |
| **展開方針** | 日本発 · 将来は海外ユーザー利用可能な設計 · 多言語・翻訳は将来 — [DECISIONS.md](../DECISIONS.md) **AD-011** |
| **TLV 製品** | Production Ready v1.0 · **FEATURE FROZEN** |
| **TLV 専用 AI エンジン** | **作らない** |
| **AI 利用** | TASFUL AI Workspace への **導線のみ** |

---

## 実装済み（`5ed9672`）

| ファイル | 役割 |
| --- | --- |
| `live/tlv-tasful-ai-entry.js` | Studio / upload 等から Workspace へリンク |
| `ai-workspace-tlv-source.js` | `source=tlv` · 8 テンプレ · 無料枠 UI |
| `deploy/cloudflare/dist/live/tlv-tasful-ai-entry.js` | dist ミラー |

**遷移例:** `../ai-workspace.html?source=tlv`

**Gateway:** 新規 AI gateway は定義しない（entry テストで確認）

---

## TLV 本体との境界

| 項目 | 内容 |
| --- | --- |
| **TLV Live UI** | FROZEN — Critical/Security のみ |
| **TLV ビジネスシミュ** | AI スコープ外 · working tree に modified 残（KI-010） |
| **Live その他** | `5ed9672` 除外 · 54 件 unstaged |

---

## テスト

| スクリプト | 結果（`5ed9672` 時） |
| --- | --- |
| `scripts/test-tlv-tasful-ai-entry.mjs` | 16/16 PASS |

**Isolation:** Gateway unchanged · 8 templates · studio/upload links

---

## 残タスク

| 項目 | 内容 |
| --- | --- |
| TLV AI エンジン | **なし**（方針どおり作らない） |
| TASFUL AI 本番接続 | Workspace 側タスク — [TASFUL_AI.md](./TASFUL_AI.md) |
| Live 未コミット 54 件 | working tree 整理 — [TODO.md](../TODO.md) |

---

## 関連

- [TASFUL_AI.md](./TASFUL_AI.md) — Workspace 本体 · 履歴フォルダに「TLV」カテゴリあり

**レポート:** `reports/tlv-tasful-ai-entry.md`, `reports/tlv-release-status.md`
