# TLV AI（導線）

**最終更新:** 2026-07-26  
**ステータス:** 導線接続済 · TLV 専用 AI なし  
**直近コミット（導線実装）:** `5ed9672`  
**運営方針正本:** [TLV_PRD.md](../TLV_PRD.md) §0.4

---

## 方針（決定）

| 項目 | 内容 |
| --- | --- |
| **展開方針** | 日本発 · 将来は海外ユーザー利用可能な設計 · 多言語・翻訳は将来 — [DECISIONS.md](../DECISIONS.md) **AD-011** |
| **TLV 製品** | Production Ready v1.0 · **FEATURE FROZEN**（コード）· 次世代範囲は [TLV_PRD.md](../TLV_PRD.md) §0 |
| **TLV 専用 AI エンジン** | **作らない**（**AD-004**） |
| **AI 利用** | TASFUL AI Workspace への **導線のみ**（Gateway 新規定義なし） |

---

## AI が支援してよい範囲（設計 · AD-004 内）

TLV 側にモデルループを置かず、Workspace（`source=tlv`）経由で次を **支援**する。

| 支援 | 内容 |
| --- | --- |
| 配信検索 | ライブ · スケジュールの検索補助 |
| 配信者検索 | クリエイター発見 |
| ショート動画検索 | 縦動画コンテンツの検索補助 |
| おすすめ表示 | 提案・要約ベースのレコメンド UI 支援 |
| 配信予約 | 予約文面 · 時刻案の **下書き / 提案** |

### 上限（禁止）

| 禁止 | 理由 |
| --- | --- |
| ランキング操作 · 順位改ざん | Score / Rank OS（[TLV_PRD.md](../TLV_PRD.md) §5–§6）の改変になる |
| 露出保証 | 有料枠・制度の代替になる · 公平性破壊 |
| 配信開始 · 課金 · 還元の自動確定 | AD-006 ドラフト原則 · 人間確認必須 |
| TLV 専用 LLM ループ / 独自 Gateway | AD-004 |

AI の上限は **検索 · 要約 · 提案まで**。

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
| **プロダクト範囲** | ショート + ライブ特化 · チャットは TALK 集約 — [TLV_PRD.md](../TLV_PRD.md) §0 |
| **TLV ビジネスシミュ** | AI スコープ外 · working tree に modified 残（KI-010） |
| **Live その他** | `5ed9672` 除外 · 未コミット資産は別整理 |

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
| Workspace テンプレ拡充 | 検索 / 予約支援プロンプトは **設計のみ** — 実装は別タスク |
| TASFUL AI 本番接続 | Workspace 側タスク — [TASFUL_AI.md](./TASFUL_AI.md) |
| Live 未コミット整理 | working tree — [TODO.md](../TODO.md) |

---

## 関連

- [TLV_PRD.md](../TLV_PRD.md) §0 — 運営方針（ショート · ライブ · AI · TALK）
- [TASFUL_AI.md](./TASFUL_AI.md) — Workspace 本体
- [DECISIONS.md](../DECISIONS.md) **AD-004** · **AD-006**

**レポート:** `reports/tlv-tasful-ai-entry.md`, `reports/tlv-release-status.md`
