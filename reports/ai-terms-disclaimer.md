# AI利用規約 / 免責 — 実装レポート

実施日: 2026-06-26  
方針: **規約・文言・表示導線のみ** — Gateway / AI Core / TASFUL AI 契約は**変更なし**

> **重要:** 本実装は現時点で最低限必要な免責と表示です。**法的に完璧な規約であるとは断定しません。** 公開前の弁護士レビューを推奨します。

---

## 1. 作成した規約・免責

| ファイル | 種別 |
| --- | --- |
| `ai-terms.html` | **AI利用規約（共通）** — 適用範囲 · 回答の性質 · 免責 · 禁止事項 · Builder 参照 |
| `ai-disclaimer.html` | **AI免責事項（短版）** — 利用者向け要約 |
| `builder/builder-ai-guidelines.html` | **Builder AI 専用ガイドライン** — 建設・契約・税務・安全 |
| `common-ai-disclaimer.js` | 共通文言 · バナー/フッター生成 · 禁止利用リスト |
| `builder/builder-ai-disclaimer.js` | Builder 固有注意 · 回答フッター |
| `common-ai-disclaimer.css` | 共通スタイル |

### 共通免責（短版）

> AIの回答は参考情報です。正確性・完全性・最新性を保証するものではありません。最終判断は利用者ご自身で行ってください。

### AI回答フッター（共通）

> ※ AI回答は参考情報です。契約・採用・支払い・請求・承認の確定は行われません。

### Builder AI 回答フッター

> ※ 下書き・参考情報です。見積/工程/安全/税務/契約/候補は確定・保証ではありません。

---

## 2. 適用対象（明記）

- TASFUL AI（AI Workspace）
- Builder AI
- Platform 経由 AI（検索 · 比較 · おすすめ）
- TLV 経由 TASFUL AI（`source=tlv`）
- TASFUL Talk 経由 TASFUL AI

---

## 3. 禁止利用（共通）

- 違法行為
- 脱税・架空経費等
- 危険行為の助長
- 資格必要作業の無資格実施助長
- 誹謗中傷
- 個人情報の不正利用

---

## 4. Builder AI 固有免責

| 領域 | 免責要点 |
| --- | --- |
| 見積・数量・工程 | 概算 · 現地調査・正式見積優先 |
| 建設・法令 | 建築基準法等の適合を保証しない |
| 安全 | 安全性・構造・施工可否を保証しない |
| 税務 | 税理士・税務署確認が必要 |
| 契約・法務 | 弁護士等の専門家確認が必要 |
| Worker/業者候補 | 推薦のみ · 採用・契約確定しない |
| KY・安全チェック | 確認補助 · 安全保証なし |

---

## 5. 表示箇所

| 画面 | 表示 |
| --- | --- |
| **Builder AI** | 画面上部バナー（`data-common-ai-disclaimer-banner`）· 回答フッター · フッターリンク |
| **TASFUL AI Workspace** | 入力欄上バナー · 各 AI 回答フッター · bottom-footer リンク |
| **TLV source=tlv** | `bottom-container` 内免責バナー（`mountTlvDisclaimer`） |
| **Platform TOP** | 検索ハブ内免責スロット |
| **規約ページ** | `ai-terms.html` · `ai-disclaimer.html` · `builder-ai-guidelines.html` |

---

## 6. 変更ファイル

| ファイル | 変更 |
| --- | --- |
| `ai-terms.html` | **新規** |
| `ai-disclaimer.html` | **新規** |
| `builder/builder-ai-guidelines.html` | **新規** |
| `common-ai-disclaimer.js` | **新規** |
| `common-ai-disclaimer.css` | **新規** |
| `builder/builder-ai-disclaimer.js` | **新規** |
| `builder/builder-ai.html` | バナー · script · リンク |
| `builder/builder-ai-page.js` | 回答フッター |
| `ai-workspace.html` | バナー · script · footer リンク |
| `ai-workspace-chat.js` | `renderAssistantBubble` フッター |
| `ai-workspace-tlv-source.js` | TLV 免責マウント |
| `index-top.html` | Platform 免責スロット |
| `scripts/test-ai-terms-disclaimer.mjs` | **新規** |

**未変更:** `ai-model-gateway.js` · `builder-ai-core.js`（契約）· `admin-ai-secretary-*` · TLV 本体

---

## 7. テスト結果

| コマンド | 結果 |
| --- | --- |
| `node scripts/test-ai-terms-disclaimer.mjs` | **32/32 PASS** |
| `npm run build:pages` | **PASS**（251 HTML · TLV 12 · dist OK） |
| `node scripts/test-builder-ai-tools-adaptation.mjs` | **85/85 PASS**（24 action 回帰 · Gateway/AI Core 未変更確認含む） |

### 確認項目

- Builder AI 画面: 上部バナー · ガイドラインリンク · 回答フッター
- AI 回答フッター: `common-ai-disclaimer.js` / `builder-ai-disclaimer.js` 経由
- TASFUL AI Workspace: 共通免責バナー · 回答フッター
- TLV `source=tlv`: `mountTlvDisclaimer()` で免責表示
- Platform 検索ハブ: `data-common-ai-disclaimer-banner` スロット（おすすめ/比較/検索導線向け）
- 既存 Builder AI 24 action: 影響なし
- Gateway / AI Core / AI 秘書: 変更なし（isolation テスト PASS）

---

## 8. 未対応事項

| 項目 | 内容 |
| --- | --- |
| 同意チェックボックス | 初回 AI 利用時の明示同意 UI（任意） |
| Talk 個別画面 | Talk 内 AI 入口への個別バナー（共通モジュール流用可能） |
| 多言語 | 英語版規約 |
| ログ同意記録 | 同意日時の DB 保存 |

---

## 9. 法務確認が必要な箇所

- 免責条項の可否（消費者契約法・特定商取引等）
- AI 生成物の著作権・利用権
- 建設・税務・安全に関する表示義務
- 個人情報を AI に入力する場合のプライバシー表示
- 本規約と `company/legal/terms.html` の優先関係の明文化
- **弁護士による全文レビュー（推奨 · 未実施）**

---

## 10. 完了条件

- [x] AI 回答が正解・保証ではないことが明記
- [x] Builder AI 固有リスクが明記
- [x] 共通 AI 利用ルール（`ai-terms.html`）
- [x] 主要 AI 画面に免責表示
- [x] 本レポート作成
