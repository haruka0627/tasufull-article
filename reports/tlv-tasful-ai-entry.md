# TLV → TASFUL AI 導線 — 実装レポート

実施日: 2026-06-26  
方針: **TLV専用AIは作らない** · 既存 **TASFUL AI Workspace** を `?source=tlv` で共通利用

---

## 1. 追加した導線

| 画面 | 配置 | ラベル |
| --- | --- | --- |
| Creator Dashboard (`studio-dashboard.html`) | Studio トップバー | ✨ TASFUL AI |
| Channel Content (`channel-content.html`) | Studio トップバー | ✨ TASFUL AI |
| Analytics (`studio-analytics.html` / `analytics.html`) | Studio トップバー | ✨ TASFUL AI |
| Video Upload (`video-upload.html`) | Videos トップバー | ✨ TASFUL AI |
| その他 Studio ページ | `initStudioChrome` 経由で同一 | ✨ TASFUL AI |

**実装:** `live/tlv-tasful-ai-entry.js`  
Studio ページは `live-channel-content.js` の `initStudioChrome` から動的ロード。Upload は `video-upload.html` + `tlv-videos-sidebar.js` からマウント。

---

## 2. 遷移先

```
../ai-workspace.html?source=tlv
```

- 新規タブで開く（`target="_blank"`）
- TLV 専用 AI エンドポイントなし · 既存 Workspace のみ

---

## 3. `source` パラメータ

| 項目 | 内容 |
| --- | --- |
| パラメータ | `source=tlv` |
| 読取 | `ai-workspace-tlv-source.js`（URLSearchParams） |
| Gateway / AI Core | **変更なし** |

---

## 4. TLV 用初期テンプレート（表示のみ）

`source=tlv` 時、Welcome 画面に 8 テンプレートを表示（通常チップは非表示）:

| テンプレート | 用途 |
| --- | --- |
| 動画タイトル | YouTube タイトル案 |
| 概要欄 | 概要欄下書き |
| タグ提案 | タグ 10 個 |
| ショート動画案 | ショート企画 |
| ライブ企画 | ライブ配信企画 |
| コメント返信 | 返信文例 |
| 動画改善 | 改善ポイント |
| サムネ文言 | キャッチコピー |

クリック → 入力欄にプロンプト填入（送信はユーザー操作）。**AI Core / Gateway は未変更。**

---

## 5. 無料回数 UI（課金処理なし）

| 項目 | 内容 |
| --- | --- |
| 表示 | `TASFUL AI の無料回数を消費します（残り N 回）` |
| ストレージ | `localStorage.tasu_ai_tlv_free_remaining`（表示用 · デフォルト 10） |
| 枯渇時 | 「無料枠を使い切りました」+ `gen-ai-workspace.html` への CTA（将来サブスク誘導用） |
| 課金 enforcement | **未実装**（意図どおり UI のみ） |

---

## 6. UI 変更箇所

| ファイル | 変更 |
| --- | --- |
| `live/tlv-tasful-ai-entry.js` | **新規** — TLV 導線ボタン |
| `live/live-channel-content.js` | `mountTasfulAiEntry` + `initStudioChrome` フック |
| `live/tlv-videos-sidebar.js` | Upload 系トップバーへマウント |
| `live/video-upload.html` | entry スクリプト追加 |
| `live/live.css` | `.tlv-tasful-ai-entry` スタイル |
| `ai-workspace-tlv-source.js` | **新規** — TLV テンプレート + 無料 UI |
| `ai-workspace.html` | `ai-workspace-tlv-source.js` 読込のみ |
| `ai-workspace.css` | TLV テンプレート / 無料バナー CSS |

**変更していない:** `ai-model-gateway.js`, `ai-workspace-chat.js`（Gateway 契約）, AI秘書, Platform, Builder, Voice Core

---

## 7. build / test 結果

| コマンド | 結果 |
| --- | --- |
| `npm run build:pages` | **PASS** |
| `node scripts/test-tlv-tasful-ai-entry.mjs` | **PASS** (16/16) |

**検証内容（抜粋）**

- Studio Dashboard / Video Upload に `../ai-workspace.html?source=tlv` リンク
- Workspace で 8 テンプレート · 無料バナー · `ai-workspace-page--tlv-source`
- `TasuAiModelGateway.completeTurn` 存続
- dist に新規 JS が含まれる

---

## 8. 完了条件

| 条件 | 状態 |
| --- | --- |
| TLV から TASFUL AI 起動 | ✅ |
| `source=tlv` 付与 | ✅ |
| 新規 AI 未作成 | ✅ |
| 共通 TASFUL AI 利用 | ✅ |
| 既存 TLV 機能維持 | ✅（導線追加のみ · entry テスト PASS） |

---

## 9. 触っていない領域

- `TasuAiModelGateway` / `completeTurn()` 契約
- AI Core / AI Workspace チャットロジック
- Platform / Builder / AI秘書 / Voice
- 課金 API · 回数 decrement ロジック
