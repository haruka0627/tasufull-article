# Breaking Change 依存調査 — 2026-07-04

**Scope:** 期限付き Breaking Change に該当する API / モデル / サービス依存が TASFUL リポジトリ内に残っていないか調査。
**Mode:** 調査のみ（**修正・commit・deploy なし**）。
**Scanned:** `.env.example` / `wrangler.toml` / `package.json` / `supabase/config.toml` / `deploy/cloudflare/functions/` / `supabase/functions/` / `supabase/migrations/` / `scripts/` / `docs/` / ルート HTML/JS/CSS / `shared/` / `live/` / `builder/` / `business-directory/` 他。
**Excluded:** `node_modules/` / `deploy/cloudflare/dist/**`（ビルド生成物）/ `.git/` / `screenshots/` / `backups/` / `agent-transcripts/`。

---

## 1. サマリー

| 種別 | HIT 件数 | 分類 |
|---|---:|---|
| **本番影響 = あり（即対応要）** | **0** | — |
| **既に保護済み**（deprecation 対応済） | **1 パターン**（`deepseek-chat/reasoner`） | P0（対応済み） |
| **本番未接続 / 現状は WIP** | **1 パターン**（OpenAI Realtime WS transport） | P1（Watch） |
| **HIT なし** | **8 パターン** | クリア |
| **要確認（環境依存）** | **1 パターン**（Supabase Postgres バージョン） | P0 verify only |

**結論:** 期限付き Breaking Change による **即時 blocker はゼロ**。DeepSeek 廃止（2026-07-24）は既に runtime 正規化で保護済み。

---

## 2. P0（本番影響の恐れがある / 期限が近い）

### P0-1. DeepSeek `deepseek-chat` / `deepseek-reasoner` — **廃止 2026-07-24**

- **状態:** ✅ **保護済み（対応不要）**
- **本番影響:** **なし**

`deploy/cloudflare/functions/_shared/secretary-deepseek.mjs` で自動正規化。

```1:27:deploy/cloudflare/functions/_shared/secretary-deepseek.mjs
/**
 * AI 運営秘書 — DeepSeek chat (OpenAI-compatible API)
 * Secret: DEEPSEEK_API_KEY (Cloudflare Pages / Workers · ローカル .env)
 * Optional: DEEPSEEK_CHAT_MODEL (official: deepseek-v4-flash | deepseek-v4-pro)
 */

export const DEEPSEEK_API_BASE = "https://api.deepseek.com";

/** @see https://api-docs.deepseek.com/quick_start/pricing */
export const DEFAULT_DEEPSEEK_CHAT_MODEL = "deepseek-v4-flash";

const DEPRECATED_DEEPSEEK_MODELS = new Set(["deepseek-chat", "deepseek-reasoner"]);

export function trimSecretaryText(value, maxLen) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLen);
}

export function resolveDeepSeekModel(env) {
  const configured = String(env?.DEEPSEEK_CHAT_MODEL || "").trim();
  const model = configured || DEFAULT_DEEPSEEK_CHAT_MODEL;
  if (DEPRECATED_DEEPSEEK_MODELS.has(model)) {
    return DEFAULT_DEEPSEEK_CHAT_MODEL;
  }
  return model;
}
```

| 場所 | 用途 | 判定 |
|---|---|---|
| `deploy/cloudflare/functions/_shared/secretary-deepseek.mjs:12` | 廃止モデル ID 集合 | Guard |
| `deploy/cloudflare/functions/_shared/secretary-deepseek.mjs:20-27` | `resolveDeepSeekModel(env)` → 廃止 → `deepseek-v4-flash` 強制 | ✅ 保護 |
| `deploy/cloudflare/functions/_shared/secretary-deepseek.mjs:10` | Default = `deepseek-v4-flash` | ✅ 現行 |
| `.env.example:8` | `# deepseek-chat / deepseek-reasoner は 2026-07-24 廃止予定（設定しても v4-flash に正規化）` | ✅ ドキュ済 |
| `scripts/test-secretary-deepseek-model.mjs:34-43` | `assert(resolveDeepSeekModel({DEEPSEEK_CHAT_MODEL:'deepseek-chat'}) === 'deepseek-v4-flash')` | ✅ 回帰テスト |
| `docs/TODO.md:955` | 「旧 deepseek-chat · 旧 deepseek-reasoner は 2026-07-24 廃止予定」 | ✅ backlog |
| `reports/*deepseek*.{md,json}` | 20+ files — 過去の smoke 証跡（`model: "deepseek-chat"` 等の記録） | 履歴 · 本番影響なし |

**残作業（確認のみ）:** Cloudflare Pages Production の環境変数 `DEEPSEEK_CHAT_MODEL` が明示的に旧 ID になっていないか Dashboard で確認（**設定されていても runtime で `deepseek-v4-flash` に正規化される**ため、実質影響なし）。

---

### P0-2. GitHub Models / `models.inference.ai.azure.com`

- **状態:** ✅ **HIT ゼロ**
- **本番影響:** **なし**
- **アクション:** 対応不要。

---

### P0-3. Assistants API（`beta.assistants` / `v1/assistants`）

- **状態:** ✅ **HIT ゼロ**
- **本番影響:** **なし**
- **補足:** `/assistants` 文字列で数件 HIT したが、すべて `thread_id` / `ensure_chat_thread` 等の **TALK 機能**（OpenAI Assistants API とは別）。`package.json` に `openai` npm SDK 依存もなし（すべて `fetch()` 経由）。
- **アクション:** 対応不要。

---

### P0-4. Supabase Postgres 14

- **状態:** ⚠️ **要確認（環境依存 · repo 内に版指定なし）**
- **本番影響:** **不明**（Supabase Cloud 側の管理）

| ファイル | 状況 |
|---|---|
| `supabase/config.toml` | PG バージョン指定なし（Cloud 管理） |
| `supabase/migrations/*.sql` | 多数（PG 15+ 機能: RLS · `SECURITY DEFINER` · access token hook 等を使用） |

**アクション（確認のみ · 今回スコープ外）:**
1. Supabase Dashboard で Production ref `ddojquacsyqesrjhcvmn` と Staging ref `ahlxuyvhzqdqaojiywmu` の **PostgreSQL major version** を確認
2. `PG 14` なら EOL カレンダーを `docs/supabase-environments.md` に追記
3. 15 → 17 アップグレード計画を必要に応じて `docs/TODO.md` に登録

---

## 3. P1（近い将来の影響 / 監視）

### P1-1. `v1/prompts` — HIT ゼロ

対応不要。

### P1-2. Cloudflare Sandbox SDK — HIT ゼロ

`package.json` に `@cloudflare/sandbox` / `sandbox-sdk` なし。`wrangler.toml` は Gemini Live WS Proxy Worker 1 本のみ（compat `2026-07-02`）。対応不要。

### P1-3. HTTP transport / WebSocket transport — OpenAI Realtime — **監視対象**

- **状態:** ⚠️ **本番未接続 · staging opt-in のみ**
- **本番影響:** **なし**（`useWebSocketTransport: false` / `mockCompatible: true` がデフォルト）

| ファイル | 行 | 内容 | 役割 |
|---|---:|---|---|
| `shared/voice-core/transports/voice-openai-realtime-websocket-transport.js` | 全体 | Phase 5-B WebSocket transport（opt-in） | 実装 |
| `shared/voice-core/adapters/voice-openai-realtime-adapter.js` | 38–59 | `shouldUseWebSocketTransport()` · `createWebSocketTransport()` | adapter |
| `shared/voice-core/voice-realtime-session-client.js` | 103 | `useWebSocketTransport: true`（テスト用） | session client |
| `supabase/functions/_shared/openai-realtime-session.ts` | 47 | `wss://api.openai.com/v1/realtime`（現行 endpoint） | Edge |
| `ai-workspace.html` / `builder/builder-ai.html` / `admin-operations-dashboard.html` | — | `<script src=voice-openai-realtime-websocket-transport.js>` opt-in load | ページ |
| `admin-ai-secretary-voice-controller.js` / `builder/builder-voice-controller.js` / `tasful-ai-voice-controller.js` | 各所 | 全 surface で **`useWebSocketTransport: false`** がデフォルト · `mockCompatible: true` | 本番接続 OFF |

**判定:**
- OpenAI Realtime API の `wss://api.openai.com/v1/realtime` は **現在の公式 endpoint** で存続。
- WebSocket transport は WebRTC 一本化のニュースはあるが即時 deprecation ではない。
- 本 repo では **staging スクリプト以外で Live 接続していない**（`mockCompatible: true` デフォルト）ため即時 blocker なし。

**アクション:** 四半期ごとに OpenAI Realtime 進化状況をレビュー。WebRTC 一本化が確定した時点で `voice-webrtc-transport.js` を追加。

### P1-4. `DOCKER_CONTENT_TRUST` — HIT ゼロ

Docker 未使用（Cloudflare Pages / Wrangler Pages Dev のみ）。対応不要。

---

## 4. 本番影響あり / なし マトリクス

| パターン | 本番影響 | 期限 | 保護状態 |
|---|:---:|---|---|
| `deepseek-chat` / `deepseek-reasoner` | **なし** | 2026-07-24 | ✅ runtime 正規化済 |
| GitHub Models / Azure Inference | **なし** | — | ✅ HIT ゼロ |
| Assistants API | **なし** | — | ✅ HIT ゼロ |
| Supabase Postgres 14 | **要確認** | Supabase EOL カレンダー依存 | ⚠️ Dashboard 確認要 |
| `v1/prompts` | **なし** | — | ✅ HIT ゼロ |
| Cloudflare Sandbox SDK | **なし** | — | ✅ HIT ゼロ |
| OpenAI Realtime WS transport | **なし**（本番未接続） | 未定 | ⚠️ 監視 |
| `DOCKER_CONTENT_TRUST` | **なし** | — | ✅ 未使用 |

---

## 5. 要確認（人手判断が必要）

| ID | 項目 | 内容 |
|---|---|---|
| **BC-P0-1** | Cloudflare Pages env `DEEPSEEK_CHAT_MODEL` | Dashboard で現行値確認（設定されていても正規化されるが念のため）· 変更不要 |
| **BC-P0-2** | Supabase PG major version | Production `ddojquacsyqesrjhcvmn` / Staging `ahlxuyvhzqdqaojiywmu` の PG version を Dashboard で確認 |
| **BC-P1-1** | OpenAI Realtime WS 存続確認 | 四半期レビュー（本 repo は staging のみ · 本番未接続） |

---

## 6. 修正が必要な場合の最小修正案

**現状すべての P0 パターンは保護済み or HIT ゼロのため、追加修正は不要。**

### 参考: 万一 `deepseek-chat` を直接使う新規コードを書く場合

**Bad:**

```js
fetch("https://api.deepseek.com/chat/completions", {
  body: JSON.stringify({ model: "deepseek-chat", ... }),
});
```

**Good:**

```js
import { resolveDeepSeekModel, DEFAULT_DEEPSEEK_CHAT_MODEL } from "./_shared/secretary-deepseek.mjs";
const model = resolveDeepSeekModel(env);
```

### 参考: Postgres 14 が Supabase Dashboard で確認された場合の初手

1. `docs/supabase-environments.md` に「PG 14 · YYYY-MM-DD 時点確認 · アップグレード要」を追記
2. `docs/TODO.md` §P1 に `BC-P0-2: Supabase PG 15/17 アップグレード計画` を新規登録
3. Staging で先行アップグレード → smoke → Production は運用ウィンドウで計画

（実施は本タスクのスコープ外。今回は調査記録まで。）

---

## 7. スキャン再現手順

```bash
# P0 patterns
rg -n --no-ignore-vcs -g '!node_modules' -g '!deploy/cloudflare/dist/**' -g '!.git' \
   'deepseek-chat|deepseek-reasoner' .
rg -n --no-ignore-vcs -g '!node_modules' -g '!deploy/cloudflare/dist/**' -g '!.git' -i \
   'models\.inference\.ai\.azure\.com|GitHub Models|githubcopilot' .
rg -n --no-ignore-vcs -g '!node_modules' -g '!deploy/cloudflare/dist/**' -g '!.git' \
   'beta\.assistants|/v1/assistants|/assistants/|AssistantsAPI|Assistants API' .

# P1 patterns
rg -n --no-ignore-vcs -g '!node_modules' -g '!deploy/cloudflare/dist/**' -g '!.git' \
   '/v1/prompts|v1\.prompts' .
rg -n --no-ignore-vcs -g '!node_modules' -g '!deploy/cloudflare/dist/**' -g '!.git' -i \
   'cloudflare sandbox|@cloudflare/sandbox|sandbox-sdk' .
rg -n --no-ignore-vcs -g '!node_modules' -g '!deploy/cloudflare/dist/**' -g '!.git' \
   'HTTP transport|WebSocket transport|WebSocketTransport|httpTransport|wsTransport' .
rg -n --no-ignore-vcs -g '!node_modules' -g '!deploy/cloudflare/dist/**' -g '!.git' -i \
   'DOCKER_CONTENT_TRUST' .
```

---

**成果物:**
- `reports/breaking-change-dependency-scan-2026-07-04.md`（本ファイル）
- `reports/breaking-change-dependency-scan-2026-07-04.json`（構造化データ）

**次回スキャン推奨タイミング:**
- 2026-07-23（DeepSeek 廃止 24h 前 · 環境変数 final 確認）
- 2026-10-01（次四半期 · OpenAI Realtime 進化状況 · Supabase PG EOL カレンダー再確認）
