# AI Model Gateway 差分棚卸し（AI秘書 dist 完了後）

**実施日:** 2026-06-26  
**HEAD:** `31476e8` — `build(secretary): sync Pages dist for ops dashboard and secretary phases`  
**作業種別:** 調査・分類のみ（コード変更 / stage / commit なし）

---

## 1. git status 概要

| 区分 | 件数 | 備考 |
|------|------|------|
| 全体 `M`（tracked 変更） | **19** | Gateway 直結は **1**（dist のみ） |
| 全体 `??`（未追跡） | **~90+** | supabase-ops · platform-ops · Voice · support · site CSS 等 |
| **Gateway source `M`** | **0** | `ai-model-gateway.js` は HEAD と一致 |
| **Gateway dist `M`** | **1** | `deploy/cloudflare/dist/ai-model-gateway.js` |
| **Gateway test/scripts `M`** | **0** | 変更なし |
| **Gateway reports `M`** | **0** | Gemini 診断レポートは **Gateway コード外**（下記除外） |

`git diff --stat` 全体: **19 files, +659 / -512**（Gateway dist は **+73 / -6** 相当）

### 直近コミット（AI秘書完了済み）

```
31476e8 build(secretary): sync Pages dist for ops dashboard and secretary phases
8b15ac4 feat(secretary): complete daily inbox item when ai-ops case resolves
27ecb18 build(tlv): sync Pages dist for live modules and payout assets
```

### Gateway source 既コミット（参考）

```
35d72b2 feat(tasful-ai): add attachment and vision support for production edge chat
         → ai-model-gateway.js のみ（dist 未同梱）
```

**結論:** 機能本体は **source 済み（`35d72b2`）**。**未コミットは dist 同期遅れ 1 ファイルのみ。**

---

## 2. Gateway 候補一覧

### 2-1. パターン抽出（`git diff --name-status`）

| 状態 | パス | 分類 |
|------|------|------|
| M | `deploy/cloudflare/dist/ai-model-gateway.js` | **B Gateway dist** |

パターン `gateway|model-gateway|ai-model|provider|gemini|openai|deepseek` に **追加ヒット**（Gateway コードではない）:

| 状態 | パス | 分類 |
|------|------|------|
| M | `reports/gemini-edge-diagnose.json` | 除外（Gemini Edge 診断 · supabase-ops 隣接） |
| M | `reports/gemini-edge-diagnose.md` | 同上 |

### 2-2. パターン抽出（`git status --short` · 追加 `??`）

| 状態 | パス | 分類 |
|------|------|------|
| ?? | `reports/gemini-billing-recovery-probes.json` | 除外（Gemini 課金回復プローブ） |
| ?? | `reports/gemini-billing-recovery.md` | 同上 |
| ?? | `reports/_gemini-recovery-probe.png` | 同上 |
| ?? | `deploy/cloudflare/dist/docs/builder-ai-gemini-live-field-diagnosis-backlog.md` | 除外（Builder AI backlog） |

### 2-3. dist 限定パターン（`git diff --name-status -- deploy/cloudflare/dist`）

| 状態 | パス |
|------|------|
| M | `deploy/cloudflare/dist/ai-model-gateway.js` |

---

## 3. 分類表

### A. Gateway source（0件）

`git diff HEAD -- ai-model-gateway.js` → **空**。

`35d72b2` で以下が既コミット済み:

- `normalizeAttachments()` / `buildAttachmentTextBlock()` / `mergeMessageWithAttachments()`
- `mockReply(..., attachments)` 拡張
- `callModel()` → gemini / openai / anthropic Edge へ `attachments` 引数追加
- `completeTurn()` → 添付時 `skipSearch`、返却 `attachments_count` / `searchFailed` / `searchMessage`

### B. Gateway dist（1件）

| 状態 | パス | 差分 |
|------|------|------|
| M | `deploy/cloudflare/dist/ai-model-gateway.js` | +73 / -6（source `35d72b2` との同期） |

**検証:** 作業ツリー上の `ai-model-gateway.js` と `deploy/cloudflare/dist/ai-model-gateway.js` は **バイト一致**。

### C. Gateway test/scripts（0件 · 未コミット変更なし）

| ファイル | 状態 | 備考 |
|----------|------|------|
| `scripts/test-tasful-ai-attach-vision-browser.mjs` | 追跡済み · クリーン | 添付/Vision E2E（`5ed9672` 済） |
| `scripts/test-tasful-ai-final-phase.mjs` | 追跡済み · クリーン | Gateway 契約読取検証 |
| `scripts/test-tasful-ai-production-preflight.mjs` | 追跡済み · クリーン | `/ai-model-gateway.js` MIME 確認 |
| `scripts/test-builder-ai-live-qa.mjs` | `??` | **Builder トラック** — Gateway 単独コミットに含めない |
| `scripts/test-builder-ai-live-e2e.mjs` | `??` | 同上 |

### D. Gateway reports/docs（0件 · Gateway 単独対象外）

| ファイル | 状態 | 理由 |
|----------|------|------|
| `reports/tasful-ai-attach-vision-first.md` | 追跡済み · クリーン | 実装レポート（`5ed9672`） |
| `reports/gemini-edge-diagnose.*` | M | Edge Secret / Google API プローブ — **運用診断** |
| `reports/gemini-billing-recovery.*` | ?? | 課金回復調査 |
| `reports/gate-d-smoke-last.json` | M | Gate D スモーク（Access ブロック記録）— Gateway 無関係 |

### E–I. 他トラック（Gateway コミットに混ぜない）

| 分類 | 代表パス | 件数感 |
|------|----------|--------|
| **E Voice** | `voice-settings.*` (??) | 3 |
| **F supabase-ops** | `supabase-ops-*`, `supabase-client.js`, `chat-supabase-config.js` (??) | ~12 |
| **G Platform** | `platform-ops-*`, `stripe-connect-*` (??) | ~8 |
| **H Talk** | クリーン（`b655014` 済） | 0 |
| **I AI秘書** | クリーン（`31476e8` 済） | 0 |
| **TLV 残** | `deploy/cloudflare/dist/live/tlv-feature-flags.js` (M) | 1（ビルド生成 · TLV 外） |

### J. 判断不能（0件）

Gateway 候補は dist 1 件に収束。曖昧ファイルなし。

---

## 4. 必須確認

| 確認対象 | 結果 |
|----------|------|
| **`ai-model-gateway.js`（root）** | HEAD と一致 · 差分 **0** |
| **`deploy/cloudflare/dist/ai-model-gateway.js`** | HEAD 比 +73 行 · 作業ツリー root と **同一内容** |
| **Gemini provider** | `model.provider === "gemini"` → `postEdge("gemini-chat", {..., attachments})` — **既存ルーティング維持**、添付引数追加のみ |
| **OpenAI provider** | `postEdge("openai-chat", {..., attachments})` — 同上 |
| **DeepSeek provider** | Gateway 内 **ルートなし**（AI秘書は別 Edge 経路 · AD-010） |
| **Anthropic provider** | `postEdge("claude-chat", {..., attachments})` — 添付引数追加 |
| **provider routing** | 変更なし（分岐構造不変） |
| **API adapter (`postEdge`)** | 変更なし · 各 Edge への payload に `attachments` キー追加 |
| **secret 参照** | 新規 secret 参照 **なし** · 既存 `sb_secret_` マスクのみ |
| **feature flags** | Gateway 内 feature flag **なし** |
| **Builder AI / TASFUL AI 混在** | `builder_ai` · `secretary` · `voice` 文字列 **なし** · `surface` パラメータは既存契約のまま |
| **Voice 依存** | **なし** |
| **supabase-ops 依存** | **なし**（クライアント JS のみ · Edge 関数は `35d72b2` 以前コミット済み） |

### dist 差分の要点（`35d72b2` 内容の dist 反映）

1. 添付正規化ヘルパー 3 関数追加
2. `mockReply` が添付ファイル名・PDF/画像注記を返す
3. `callModel` / `completeTurn` が `attachments` を Edge へ転送
4. 添付あり時 Web 検索スキップ（`skipSearch || hasAttachments`）
5. 返却メタに `attachments_count` · `searchFailed` · `searchMessage` 追加（後方互換）

**AD-005 注意:** 契約拡張（`attachments` オプション引数）は `35d72b2` で source 確定済み。今回 dist は **同期のみ**。

---

## 5. Go / No-Go

| 判定 | 結果 | 理由 |
|------|------|------|
| **source だけ先に切れるか** | **N/A（済）** | `35d72b2` でコミット済み |
| **dist だけか** | **Yes** | 未コミットは dist 1 ファイルのみ |
| **Gateway 単独コミット可能か** | **Yes** | `deploy/cloudflare/dist/ai-model-gateway.js` 1 件で完結 |
| **Voice 依存があるか** | **No** | |
| **supabase 依存があるか** | **No**（本コミット範囲） | Edge 側は別コミット · dist はクライアントのみ |

**No-Go 条件:** なし（単独 dist 同期は安全）。

**混在リスク:** `tlv-feature-flags.js` · `gemini-edge-diagnose.*` · Builder/Platform/ops 系を **stage しない** こと。

---

## 6. 除外一覧（Gateway コミットに入れない）

| パス | トラック |
|------|----------|
| `deploy/cloudflare/dist/live/tlv-feature-flags.js` | TLV（ビルド生成） |
| `reports/gemini-edge-diagnose.*` | Gemini 運用診断 |
| `reports/gemini-billing-recovery.*` | Gemini 課金調査 |
| `reports/gate-d-smoke-last.json` | Gate D スモーク |
| `reports/builder-release-status.md` 他 reports `M` | 各トラックレポート |
| `scripts/tmp-channel-*` | TLV/チャンネル回帰アーティファクト |
| `deploy/cloudflare/dist/supabase-ops-*` | supabase-ops |
| `deploy/cloudflare/dist/platform-ops-*` | platform-ops |
| `deploy/cloudflare/dist/voice-settings.*` | Voice |
| `deploy/cloudflare/dist/support-*` | support |
| `scripts/test-builder-ai-live-*.mjs` | Builder |

---

## 7. 依存関係

```
35d72b2 ai-model-gateway.js (source, committed)
    ↓ npm run build:pages でコピー（または手動同期済み）
deploy/cloudflare/dist/ai-model-gateway.js (uncommitted M)

消費側（変更不要 · 既に source 参照）:
  ai-workspace.html / ai-workspace-chat.js
  admin-operations-dashboard.html
  gen-ai-workspace.html
  builder/builder-ai.html（共通 Gateway 読込 · 専用分岐なし）
  talk / TLV entry（TasuAiModelGateway.completeTurn）
```

- **上流:** `ai-plan-models.js` · `ai-search-orchestrator.js`（変更なし）
- **下流 Edge:** `gemini-chat` · `openai-chat` · `claude-chat`（`35d72b2` 以前にコミット済み想定）
- **横断:** Builder / Platform / Talk / ANPI / TLV / AI秘書 は **同一 Gateway モジュール**を読むが、今回 diff は **共有基盤の dist 同期**のみ

---

## 8. 推奨コミット単位

### Commit 1（Gateway dist のみ）

```
build(gateway): sync Pages dist for attachment-aware ai-model-gateway
```

**stage 対象（1 ファイル）:**

```
deploy/cloudflare/dist/ai-model-gateway.js
```

**stage 禁止:** 上記除外一覧すべて · `git add -A` 禁止（AD-007）

### 代替メッセージ（TASFUL AI 文脈）

```
build(tasful-ai): sync Pages dist for ai-model-gateway attachments
```

（`35d72b2` の dist 追随である点では `gateway` ラベルの方がトラック横断を明示）

---

## 9. 推奨テスト

| 優先 | コマンド | 目的 |
|------|----------|------|
| 1 | `node scripts/test-tasful-ai-attach-vision-browser.mjs` | 添付 → Gateway → mock/Edge の E2E |
| 2 | `node scripts/test-tasful-ai-final-phase.mjs` | Gateway 契約・フィールド回帰 |
| 3 | `node scripts/test-tasful-ai-production-preflight.mjs` | Pages 上 `/ai-model-gateway.js` 配信 |
| 4 | `node scripts/test-builder-ai-live-qa.mjs`（iso-gateway 項目） | Builder 専用分岐が Gateway に無いこと |
| 5 | `node scripts/test-tlv-tasful-ai-entry.mjs` | TLV 入口から Gateway 到達 |

**軽量確認（コミット前）:**

```powershell
git diff --stat -- deploy/cloudflare/dist/ai-model-gateway.js
# 期待: 1 file, +73 -6 前後

# root と dist 一致確認
Compare-Object (Get-Content ai-model-gateway.js -Raw) (Get-Content deploy/cloudflare/dist/ai-model-gateway.js -Raw)
# 期待: 差分なし
```

---

## 10. 注意点

1. **source は既コミット** — 今回の作業は **dist 遅れ解消**のみ。二重コミットしない。
2. **AD-005** — Gateway 契約は `35d72b2` で既に拡張済み。dist 同期は契約変更ではない。
3. **Pages 本番** — dist 未同期の間、本番 Pages は **添付未対応の旧 Gateway** を配信している可能性（`ai-workspace-attachments.js` は新 · Gateway dist が古い不整合）。
4. **`tlv-feature-flags.js`** — Gateway コミットに同梱しない（TLV ビルド生成物）。
5. **Gemini 診断レポート** — Gateway コミットと別トラック（運用・課金調査）。
6. **secretary dist コミット（`31476e8`）** は dashboard が `ai-model-gateway.js` を読むが、Gateway dist 自体は含めていなかった → **意図的に Gateway 単独コミットが残っている状態**。

---

## 11. サマリー（①–⑧）

| # | 項目 | 件数 / 判定 |
|---|------|-------------|
| ① | Gateway source | **0**（`35d72b2` 済） |
| ② | Gateway dist | **1** |
| ③ | test/scripts | **0**（未コミット変更なし） |
| ④ | reports | **0**（Gateway 単独対象 · Gemini 診断は除外） |
| ⑤ | 依存関係 | Voice **なし** · supabase-ops **なし** · Edge 関数は source コミット済み · 消費側は変更不要 |
| ⑥ | コミット可能範囲 | **`deploy/cloudflare/dist/ai-model-gateway.js` のみ** |
| ⑦ | 推奨テスト | `test-tasful-ai-attach-vision-browser` → `test-tasful-ai-final-phase` → `test-tasful-ai-production-preflight` |
| ⑧ | 推奨コミット順 | **Gateway dist 1 コミット** → 以降 supabase-ops / platform-ops / Voice / support 各トラック |

---

*調査のみ実施。コード変更 · stage · commit · push なし。*
