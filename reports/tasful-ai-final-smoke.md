# TASFUL AI Final Smoke — 総合確認レポート

実施日: 2026-06-26  
方針: **新機能追加なし** · Critical Bug のみ修正（今回 **コード修正なし** · テスト追加のみ）

---

## 1. PASS 一覧

### ビルド

| コマンド | 結果 |
| --- | --- |
| `npm run build:pages` | **PASS** |

### 既存 E2E（回帰）

| コマンド | 結果 |
| --- | --- |
| `node scripts/test-admin-ai-secretary-text-chat-browser.mjs` | **PASS** |
| `node scripts/test-talk-ops-assistant-browser.mjs` | **PASS** |
| `node scripts/test-admin-operations-dashboard-browser.mjs` | **PASS** |
| `node scripts/test-ai-voice-core-browser.mjs` | **PASS** |
| `node scripts/test-tasful-ai-attach-vision-browser.mjs` | **PASS** |

### 追加 Final Smoke（53/53）

| コマンド | 結果 |
| --- | --- |
| `node scripts/test-tasful-ai-final-smoke-browser.mjs` | **PASS** (53 checks) |

**Final Smoke 内訳（カテゴリ別）**

| カテゴリ | PASS |
| --- | --- |
| gateway | 4 |
| chat | 9 |
| search | 3 |
| attach | 17 |
| vision | 3 |
| voice | 5 |
| ui | 4 |
| image-gen | 4 |
| regression | 2 |
| summary | 1 |

---

## 2. FAIL 一覧

| 項目 | 状態 |
| --- | --- |
| 自動テスト FAIL | **なし** |
| Critical Bug（要即修正） | **なし** |

### 既知の制限（FAIL ではないが本番前に注意）

| 項目 | 内容 | 重要度 |
| --- | --- | --- |
| 添付「削除」UI | 個別 ✕ ボタンなし。送信時 `TasuTgaShell.clearAttachments()` でクリア | 低 |
| 画像生成チャット | 生成意図は `requestModelWritingReply` → Gateway 優先。mock パネルは `tryHandle` 直叩きでは表示 | 中 |
| ライブ Vision / Serper | file:// + mock fallback で検証。本番 Edge secrets / デプロイ後の live 応答は未自動化 | 中 |
| PDF 本文 | 受信・メタのみ。パース未実装（意図どおり） | 低 |
| エラー UI 専用テスト | API 障害時の表示は mock fallback で間接確認のみ | 低 |

---

## 3. UI 確認

| 項目 | 結果 | 根拠 |
| --- | --- | --- |
| レスポンシブ 390px | ✅ | Final smoke: 横スクロールなし |
| ダークテーマ | ✅ | `body.ai-workspace-page` |
| モバイル入力・送信 | ✅ | input / send visible @390px |
| ローディング | ✅ | `dataset.aiChatSending` ON/OFF |
| ボタン状態 | ✅ | 送信中 disabled → 解除 |
| スクロール | ✅ | `#chat-scroller` 利用（既存 UI） |
| 添付プレビュー | ✅ | `[data-ai-attach-preview]` |
| Voice toolbar | ✅ | `.tasful-ai-voice__toolbar` |

---

## 4. Vision 確認

| 項目 | 結果 | 備考 |
| --- | --- | --- |
| 画像 → `completeTurn({ attachments })` | ✅ | png @ gemini-flash / gpt / claude |
| Gemini Edge inlineData | ✅ コード | `supabase/functions/gemini-chat/index.ts` + `_shared/ai-attachments.ts` |
| OpenAI Edge image_url | ✅ コード | `openai-chat/index.ts` |
| Claude Edge base64 image | ✅ コード | `claude-chat/index.ts` |
| ライブ Vision 応答 | ⚠️ | E2E は mock/fallback。Edge デプロイ + `GEMINI_API_KEY` 等が必要 |

---

## 5. Voice 確認

| 項目 | 結果 |
| --- | --- |
| Voice ON/OFF | ✅ |
| Speaker ON/OFF | ✅ |
| Browser SpeechSynthesis | ✅ 検出 |
| テキストチャット継続 | ✅ |
| AI秘書 Voice 回帰 | ✅ (`test-ai-voice-core-browser.mjs`) |

---

## 6. Search 確認

| 項目 | 結果 |
| --- | --- |
| Serper 経路 | ✅ コード + orchestrator テスト群 |
| 添付なし通常検索 | ✅ `skipSearch=false`（Web ツール時） |
| 添付あり検索スキップ | ✅ `skipSearch=true` |
| Final smoke Web ツール + mock | ✅ `__TASU_SERPER_MOCK_RESPONSE__` |

---

## 7. Attach 確認

| 形式 | プレビュー | Gateway |
| --- | --- | --- |
| png / jpg / webp | ✅ | ✅ kind=image |
| txt / md / csv / json | ✅ | ✅ kind=document + textContent |
| pdf | ✅ | ✅ kind=pdf（本文未解析） |
| サイズ制限 | ✅ 4MB+ 拒否 |
| 非対応形式 | ✅ エラー表示 |
| クリア | ✅ `clearAttachments()`（送信時も実行） |

---

## 8. Gateway 確認

| API / モジュール | 結果 |
| --- | --- |
| `TasuAiModelGateway.completeTurn` | ✅ 契約維持 + `attachments` 後方互換 |
| `TasuAiSearchOrchestrator.prepare` | ✅ |
| `TasuAiWorkspaceAttachments.prepareFromFileList` | ✅ |
| Edge: gemini / openai / claude / serper | ✅ コード実装済（secrets 依存） |
| `gen-ai-workspace.html` 読込 | ✅ JS error なし |
| `talk-home.html` 読込 | ✅ JS error なし |

---

## 9. Production 前に残る作業

| 優先 | 作業 |
| --- | --- |
| P0 | 本番 URL + Edge secrets（`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SERPER_API_KEY`）の live smoke |
| P0 | PDF 本文解析 or UX 上の期待値整理 |
| P1 | 添付個別削除 UI（✕ ボタン）— 現状は送信でクリアのみ |
| P1 | 画像生成: チャット経路と mock パネルの優先順位整理（Gateway 文案 vs `ai-generate-ui` パネル） |
| P1 | ライブ Vision 3 プロバイダ応答の手動/capture テスト |
| P1 | プラン課金と Gateway gating の本番接続 |
| P2 | ストリーミング応答 |
| P2 | サーバー側会話履歴 |
| P2 | TLV / Platform からの AI Core 統合（スコープ外のまま） |

---

## 変更ファイル（今回）

| ファイル | 内容 |
| --- | --- |
| `scripts/test-tasful-ai-final-smoke-browser.mjs` | **新規** Final Smoke E2E |
| `reports/tasful-ai-final-smoke.md` | 本レポート |

**アプリコード変更: なし**

---

## 機能状態サマリー

| 機能 | 状態 |
| --- | --- |
| チャット | ✅ |
| モデル切替 | ✅ |
| 検索 | ✅ |
| 添付 | ✅ |
| Vision | ⚠️ |
| Voice | ✅ |
| 画像生成 | ⚠️ |
| UI | ✅ |
| Gateway | ✅ |
| Production Ready | **NO** |

### 判定理由（⚠️ / NO）

- **Vision ⚠️**: Gateway までの payload は自動確認済。本番 Edge への live Vision 応答は secrets + デプロイ後の確認が残る。
- **画像生成 ⚠️**: `ai-generate-ui.js` の mock パネルは存在するが、チャット送信時は Gateway 文案 path が優先され mock パネルは出ない（既知）。
- **Production Ready NO**: 上記に加え、PDF 解析・ストリーミング・課金 enforcement・本番 URL E2E が未完了。

---

## 実行コマンド（再現）

```bash
npm run build:pages
node scripts/test-admin-ai-secretary-text-chat-browser.mjs
node scripts/test-talk-ops-assistant-browser.mjs
node scripts/test-admin-operations-dashboard-browser.mjs
node scripts/test-ai-voice-core-browser.mjs
node scripts/test-tasful-ai-attach-vision-browser.mjs
node scripts/test-tasful-ai-final-smoke-browser.mjs
```
