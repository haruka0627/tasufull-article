# TASFUL AI Production Preflight — 本番前確認レポート

実施日: 2026-06-26  
方針: **新機能追加なし** · Critical Bug 修正のみ（今回 **アプリコード修正なし**）· 本番前確認・レポート作成

---

## 1. 確認した URL

| URL | HTTP | 備考 |
| --- | --- | --- |
| `https://tasufull-article.pages.dev/ai-workspace.html` | 200 | **Cloudflare Access ログイン画面**（未認証） |
| `https://tasufull-article.pages.dev/ai-workspace-chat.js` | 200 | 同上 — 実 JS ではなく Access HTML |
| `https://tasufull-article.pages.dev/ai-model-gateway.js` | 200 | 同上 |
| `https://tasufull-article.pages.dev/gen-ai-workspace.html` | 200 | Access HTML |
| `deploy/cloudflare/dist/ai-workspace.html` | — | **staging dist に存在**（`npm run build:pages` 後） |
| `file://` ローカル（Final Smoke / Attach テスト） | — | **PASS** — composer / model bar / 390px すべて正常 |
| Edge: `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/*` | — | live Supabase Edge（anon key 経由） |

**解釈:** 本番 Pages URL は HTTP 200 だが、**Cloudflare Access により未認証クライアントは Workspace 本体に到達できない**。JS/CSS は MIME エラーというより **Access ログインページが text/html で返る** 状態。認証済みブラウザでの手動確認は別途必要。

---

## 2. build 結果

| コマンド | 結果 |
| --- | --- |
| `npm run build:pages` | **PASS** |

`deploy/cloudflare/dist/` に以下を含む staging 成果物を確認:

- `ai-workspace.html`, `ai-workspace-chat.js`, `ai-workspace-attachments.js`
- `ai-model-gateway.js`, `ai-search-orchestrator.js`, `ai-workspace-voice.js`
- `ai-generate-ui.js`, `tasful-ai-voice.css`, `gen-ai-workspace.html`

---

## 3. test 結果

| コマンド | 結果 | 備考 |
| --- | --- | --- |
| `node scripts/test-admin-ai-secretary-text-chat-browser.mjs` | **PASS** | |
| `node scripts/test-talk-ops-assistant-browser.mjs` | **PASS** | |
| `node scripts/test-admin-operations-dashboard-browser.mjs` | **PASS**（単独実行） | 全テスト連続実行時は Connect コピー toast で **タイムアウト flake**（単独再実行で PASS → 製品 Critical Bug ではない） |
| `node scripts/test-ai-voice-core-browser.mjs` | **PASS** | |
| `node scripts/test-tasful-ai-attach-vision-browser.mjs` | **PASS** | |
| `node scripts/test-tasful-ai-final-smoke-browser.mjs` | **PASS** (53/53) | |
| `node scripts/test-tasful-ai-production-preflight.mjs` | **PARTIAL** (29/39) | Access ゲート + live Vision 未達成により一部 FAIL（下記） |

**回帰（Final Smoke 内）**

| 領域 | 結果 |
| --- | --- |
| AI秘書 | ✅ |
| Voice Core | ✅ |
| Attach/Vision（ローカル Gateway） | ✅ |
| talk-ops | ✅ |
| admin dashboard | ✅（単独） |
| gen-ai-workspace | ✅ JS error なし |
| talk-home | ✅ JS error なし |
| Platform / Builder / TLV | ✅ 今回触っていない · 既存テスト PASS |

---

## 4. live Edge 実応答結果（text）

Edge base: `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1`

| ルート | HTTP | 実応答 | 判定 |
| --- | --- | --- | --- |
| `gemini-chat`（text） | **429** | prepayment credits depleted（Gemini billing） | ⚠️ secret は参照されるが **API 利用不可** |
| `openai-chat`（text） | **200** | 短い応答（例: 「確認」） | ✅ 動作 |
| `claude-chat`（text） | **200** | 短い応答（例: 「ping」） | ✅ 動作 |
| `serper-search` | **502** | Serper upstream 400: **Not enough credits** | ❌ Web 検索 **利用不可** |

---

## 5. Vision 実応答結果

プローブ: 1×1 PNG を `attachments[]` で POST（`kind: image`, `base64` 付き）

| ルート | HTTP | モデル応答（要約） | 判定 |
| --- | --- | --- | --- |
| `gemini-chat` | **429** | billing / credits depleted | ⚠️ 未検証（レート・課金） |
| `openai-chat` | **200** | 「画像を見ることができません」 | ❌ **Vision 未動作**（live Edge） |
| `claude-chat` | **200** | 「I don't see any image attached」 | ❌ **Vision 未動作**（live Edge） |

**根拠:** リポジトリ内 Edge コード（`_shared/ai-attachments.ts` + 各 chat handler）は attachments 対応済みだが、**live Supabase に当該変更が未デプロイ**と判断。ローカル E2E（Attach/Vision テスト）は Gateway 経由で PASS。

**Critical 残タスク:** `gemini-chat` / `openai-chat` / `claude-chat` + `_shared/ai-attachments.ts` を Supabase Edge に **デプロイ**し、Vision 実応答を再確認。

---

## 6. Serper 実応答結果

| 項目 | 結果 |
| --- | --- |
| `SERPER_API_KEY` on Edge | **存在**（503 not-configured ではない） |
| `serper-search` live 呼び出し | **502** — Serper API: `Not enough credits` |
| TASFUL AI Web 検索（本番） | ❌ **現状利用不可**（クレジット枯渇） |

---

## 7. secrets 確認結果（値は伏せる）

| Secret | Edge 上の存在 | 動作 |
| --- | --- | --- |
| `GEMINI_API_KEY` | ✅ present | ❌ 429 — Gemini billing / credits depleted |
| `OPENAI_API_KEY` | ✅ present | ✅ text OK · ❌ Vision（デプロイ待ち） |
| `ANTHROPIC_API_KEY` | ✅ present | ✅ text OK · ❌ Vision（デプロイ待ち） |
| `SERPER_API_KEY` | ✅ present | ❌ Serper account credits 枯渇 |

- secret **値はログ・レポートに出力していない**
- クライアント JS / HTML から secret 参照なし（Edge のみ）

---

## 8. console error 有無

| 環境 | 結果 |
| --- | --- |
| ローカル Final Smoke（file://） | ✅ **console error なし** |
| 本番 URL（未認証 Playwright） | ⚠️ Access ログイン画面 — Cloudflare SVG CSP 関連 error。**Workspace 本体は未ロード** |
| gen-ai-workspace / talk-home（回帰） | ✅ error なし |

---

## 9. MIME / routing 確認

| 対象 | staging dist | 本番 Pages（未認証） |
| --- | --- | --- |
| HTML | ✅ ファイル存在 | 200 · `text/html`（Access ページ） |
| JS (`*.js`) | ✅ 存在 | 200 だが **Content-Type: text/html**（Access ログイン HTML） |
| CSS | ✅ 存在 | 同上 |
| 404 / 500 | — | 未確認（Access が 200 で遮断） |

**結論:** staging build は正しい。**本番 URL の MIME 問題は Cloudflare Access による HTML 差し替え**であり、認証後の実ファイル配信は別途確認が必要。

---

## 10. Production Ready 判定

### 判定: **NO**

| 必須要件 | 状態 |
| --- | --- |
| build PASS | ✅ |
| 既存 E2E PASS | ✅（dashboard は単独実行） |
| 本番 Workspace 到達 | ⚠️ Access 保護 · 未認証 E2E 不可 |
| live text（3 provider） | ⚠️ Gemini 429 · OpenAI/Claude OK |
| live Serper | ❌ credits 枯渇 |
| live Vision（3 provider） | ❌ Edge 未デプロイ + Gemini billing |
| secrets 存在 | ✅ 4/4 present |
| 課金 enforcement（Workspace） | ❌ 未実装（下記） |
| 画像生成 API | ❌ mock のみ（意図どおり今回スコープ外） |

**根拠:** コード品質・ローカル E2E は Production 水準に近いが、**live Edge の Vision 未デプロイ**、**Gemini/Serper の外部クレジット枯渇**、**本番 Pages の Access ゲート** により、本番ユーザー目線の end-to-end は **未達**。

---

## 11. 残タスク

### P0 — 本番ブロッカー

1. **Supabase Edge デプロイ** — `ai-attachments.ts` 含む chat functions を live に反映 → Vision 再プローブ
2. **Gemini billing / credits** — 429 解消（AI Studio prepay）
3. **Serper credits** — アカウントチャージ or キー更新
4. **Cloudflare Access** — 認証済みで `ai-workspace.html` + JS MIME を確認、または公開ルート方針を決定

### P1 — Production Ready 最小要件（課金）

| 項目 | 現状 |
| --- | --- |
| Workspace Gateway 利用制限 | **未実装** — `ai-model-gateway.js` に quota/billing なし |
| プラン表示 | `ai-plan-models.js` — localStorage / URL override の **UI ゲートのみ**（Workspace では全モデル enabled） |
| gen-ai Stripe entitlements | `apply-genai-entitlements.ts` — **gen-ai-workspace 専用** · Workspace 未接続 |
| Edge 側 per-user quota | chat functions に **Workspace 向け enforcement なし** |

**最小実装案（後続）:** userId 単位の日次/月次 turn 上限 · プラン連動 model 制限を Edge + Gateway で enforce · 429/402 を UI 表示。

### P2 — 既知仕様（Final Smoke 継承）

| 項目 | 内容 |
| --- | --- |
| 画像生成 | mock パネル OK · チャット送信時は `requestModelWritingReply` → Gateway 文案 path が優先（mock panel は `tryHandle` 直叩きのみ） |
| PDF | 受信のみ · 本文解析なし |
| 添付削除 UI | 個別 ✕ なし · 送信時クリア |
| dashboard E2E | 連続実行時 Connect コピー flake — テスト順序/待機の改善候補 |

### 追加スクリプト

- `node scripts/test-tasful-ai-production-preflight.mjs` — 新規追加（URL / Edge / secrets / browser）
- 出力: `reports/tasful-ai-production-preflight-probe.json`

---

## 12. 触っていない領域

- `TasuAiModelGateway.completeTurn()` 契約
- AI秘書 Gateway / postUserCommand / Action Registry コア
- Platform / Builder / TLV 本体
- 画像生成 API 実装
- PDF 本文解析
- 課金 enforcement 新規実装
- Supabase secrets 値の追加・変更
- Cloudflare / Wrangler 設定変更

---

## 付録: TASFUL AI Workspace 実操作（ローカル E2E で確認済み）

Final Smoke 53/53 + Attach 8/8 より:

| 操作 | 結果 |
| --- | --- |
| テキスト送信 / Enter | ✅ |
| モデル切替 | ✅ |
| Web 検索 prepare | ✅（live Serper は credits 問題） |
| 添付なし相談 | ✅ |
| 画像 / txt / md / csv / json 添付 | ✅ |
| PDF 添付受信 | ✅ |
| Voice / Speaker ON/OFF | ✅ |
| コピー | ✅ |
| loading / error UI | ✅（mock 経由） |

---

## 判定サマリー

| 項目 | YES / NO |
| --- | --- |
| build PASS | **YES** |
| 既存テスト PASS | **YES**（dashboard flake 除く） |
| 本番 URL で Workspace 開ける | **PARTIAL**（Access 要認証） |
| live text / search / Vision 明確 | **PARTIAL**（text 2/3 · search ❌ · vision ❌） |
| secrets 存在確認 | **YES** |
| **Production Ready** | **NO** |
