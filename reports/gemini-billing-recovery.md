# Gemini Billing Recovery Verification — レポート

実施日: 2026-06-26  
目的: Gemini API クレジット補充後、**429 (prepayment credits depleted) 解消**の確認  
方針: **コード変更なし**（検証スクリプト追加のみ）· Product 仕様変更なし

---

## 結論

| 項目 | 結果 |
| --- | --- |
| **429** | **解消** |
| Gemini Text (Edge) | ✅ |
| Gemini Vision (Edge: png/jpg/webp) | ✅ |
| Gateway (`completeTurn`) | ✅ |
| Workspace (live UI) | ✅ |

**Gemini billing 復旧は確認済み。** 全体 Production は Serper credits 未解消のため **NOT READY**（Gemini 以外の既知ブロッカー）。

---

## ① Gemini Text

Edge: `gemini-chat` · `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/gemini-chat`

| ケース | HTTP | 429 | 結果 |
| --- | --- | --- | --- |
| 短文 ping | 200 | なし | ✅ `はい。` 等 |
| 長文（~1800字プロンプト） | 200 | なし | ✅ replyLen 251–387 |
| マルチターン（history 付き） | 200 | なし | ✅ 履歴応答 OK |
| `verify-gemini-deploy.mjs` basic | 200 | なし | ✅ |
| キャラ設定反映 | 200 | なし | ✅ |
| Preflight Edge probe | 200 | なし | ✅ preview=`pong` 等 |

**`completeTurn()` / モデル切替:** Workspace live で `gemini-flash` 選択 → テキスト送信 → **Gemini バッジ · 429/APIエラーなし** ✅

---

## ② Gemini Vision

`ai-attachments.ts` 経由 · `attachments[]` + `kind: image` + `base64`

| 形式 | HTTP | Edge到達 | payload | Vision応答 | 429 |
| --- | --- | --- | --- | --- | --- |
| **png** | 200 | ✅ | ✅ | `Red` | なし |
| **jpg** | 200 | ✅ | ✅ | `Red` | なし |
| **webp** | 200 | ✅ | ✅ | `Red` | なし |

Preflight Vision probe: `赤色` ✅

**Workspace:** png 添付 → `completeTurn` → 応答表示 · 429/APIエラーなし ✅

---

## ③ Workspace (`ai-workspace.html`)

Base: `https://cf-pages-deploy.tasufull-article.pages.dev`（Access なし preview · 本番成果物と同一 dist）

| 項目 | 結果 |
| --- | --- |
| テキスト送信 | ✅ Gemini バッジ · 429 なし |
| 画像添付 (png) | ✅ プレビュー → 送信 → 応答 |
| loading | ✅ 送信中 disabled → 解除（Final Smoke 継承） |
| error UI | ✅ 429/APIエラー文字列なし |
| 390px / composer / model bar | ✅ Preflight 39/39 PASS |
| console error | ✅ なし |

---

## ④ 回帰（変更なし · 確認のみ）

| 領域 | 結果 |
| --- | --- |
| OpenAI text / Vision | ✅ HTTP 200（`verify-tasful-ai-production-environment.mjs`） |
| Claude text / Vision | ✅ HTTP 200 |
| AI秘書 / Voice / Gateway 契約 | ✅ Final Smoke 53/53 |
| Platform / Builder / TLV | ✅ 触っていない · 回帰 PASS |
| `TasuAiModelGateway.completeTurn()` | ✅ 契約変更なし |

---

## ⑤ build / test

### build

| コマンド | 結果 |
| --- | --- |
| `npm run build:pages` | **PASS** |

### test

| コマンド | 結果 |
| --- | --- |
| `node scripts/verify-tasful-ai-production-environment.mjs` | **PARTIAL** — Gemini/OpenAI/Claude ✅ · Serper ❌ (credits) |
| `node scripts/verify-gemini-billing-recovery.mjs` | **PASS** (8/8) · **429 resolved: YES** |
| `node scripts/verify-gemini-deploy.mjs` | **PASS** (6/6) |
| `node scripts/test-tasful-ai-final-smoke-browser.mjs` | **PASS** (53/53) |
| `node scripts/test-tasful-ai-production-preflight.mjs` | **PASS** (39/39) ※ `PAGES_BASE_URL=cf-pages-deploy...` |

---

## ⑥ 残課題（Gemini 以外）

| 項目 | 状態 | 備考 |
| --- | --- | --- |
| Serper credits | ❌ | `Not enough credits` → Web 検索のみ未復旧 |
| Cloudflare Access 本番 hostname | ⚠️ | Service Token 未設定時は未認証 E2E 不可（preview URL で Workspace 確認済） |
| Workspace 課金 enforcement | 未実装 | 意図どおり今回スコープ外 |

**Gemini 復旧後の再確認:** `node scripts/verify-gemini-billing-recovery.mjs`

---

## 触っていない領域

- アプリ HTML/JS/CSS 仕様
- AI秘書 / Platform / Builder / TLV コード
- Supabase secret 値
- 課金 enforcement · 画像生成 API · PDF 解析

---

## 判定サマリー

| 項目 | 状態 |
|------|------|
| Gemini Text | ✅ |
| Gemini Vision | ✅ |
| 429 | **解消** |
| Gateway | ✅ |
| Workspace | ✅ |
| Production | **NOT READY** |

**Production NOT READY の理由:** Serper credits 枯渇のみ（Gemini ブロッカーは解消）。Serper 復旧 + Access Service Token E2E 後に全体 **READY** 再判定可能。

---

## 参照

- プローブ JSON: `reports/gemini-billing-recovery-probes.json`
- 検証スクリプト: `scripts/verify-gemini-billing-recovery.mjs`
