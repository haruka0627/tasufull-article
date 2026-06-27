# TASFUL AI P0-2 — 本番接続 残タスク Triage

**実施日:** 2026-06-26  
**目的:** `docs/TODO.md` §P0-2 未完了 3 項目の現状調査（**コード変更なし**）  
**参照:** `docs/TODO.md` §P0-2 · `reports/tasful-ai-production-preflight.md` · `docs/AI/TASFUL_AI.md` · `docs/DECISIONS.md` AD-005 / UD-002

---

## 1. Git 作業ツリー（調査開始時）

| 区分 | 件数 | 備考 |
| --- | --- | --- |
| 変更済み `docs/` | 9 | 機能開発フェーズ TODO 整理（未コミット） |
| 変更済み `reports/` / `scripts/` | 多数 | テスト出力・triage レポート |
| `deploy/cloudflare/dist/` | **clean** | dist 直接編集なし |

**Git HEAD:** `3b030ab`（`cf-pages-deploy` · push 済 · Pages deploy 済）

---

## 2. P0-2 サブタスク — 総合判定

| サブタスク | TODO 記載 | **本調査時点** | ブロッカー種別 |
| --- | --- | --- | --- |
| Edge + Vision | ✅ 完了 | ✅ **完了**（live 再プローブ PASS） | — |
| Gemini billing | ✅ 完了 | ✅ **完了**（429 解消） | — |
| **Serper credits** | ❌ 未完了 | ❌ **未解消** | **外部課金（Serper アカウント）** |
| **CF Access 本番 E2E** | ⚠️ 一部 | ⚠️ **未達**（Service Token 未設定） | **運用設定（Zero Trust）** |
| **Workspace 課金 enforcement** | ❌ 未実装 | ❌ **未実装** | **機能実装（Gateway + Edge + UI）** |
| 動画/音楽 API 本番 | ❌ | ❌ 未実装 | P0-2 外（`enabled: false`） |

**P0-2 残 3 点の性質:** コードバグ 0 件 · Serper は **secret 設定済み・upstream 枯渇** · Access は **意図的保護** · 課金は **設計どおり未着手**。

---

## 3. Serper credits — 切り分け

### 3.1 経路（コード確認済み）

```
ai-workspace-chat.js
  → TasuAiModelGateway.completeTurn()
    → TasuAiSearchOrchestrator.prepare()
      → serper-search-service.js → TasuSerperSearchService.search()
        → POST {SUPABASE_URL}/functions/v1/serper-search
          → supabase/functions/serper-search/index.ts
            → POST https://google.serper.dev/search (X-API-KEY: SERPER_API_KEY)
```

### 3.2 起因判定

| レイヤ | 状態 | 根拠 |
| --- | --- | --- |
| **クライアント JS** | ✅ 正常 | `serper-search-service.js` — Edge 経由のみ。API キー非露出 |
| **Supabase Edge コード** | ✅ 正常 | `serper-search/index.ts` — key 未設定時 503。upstream 4xx を 502 でラップ |
| **Supabase secret** | ✅ **設定済み** | 503 `not configured` ではない |
| **Serper 外部課金** | ❌ **枯渇** | upstream **400: `Not enough credits`** |

**結論:** **外部課金（Serper アカウント credits 不足）が唯一のブロッカー。** コード修正・secret 名変更は不要。

### 3.3 live プローブ（本調査 · 再実行）

```bash
node scripts/verify-tasful-ai-production-environment.mjs
```

| プローブ | HTTP | 結果 |
| --- | --- | --- |
| OpenAI / Claude / Gemini text | 200 | ✅ PASS |
| OpenAI / Claude / Gemini Vision | 200 | ✅ PASS |
| **Serper search** | **502** | ❌ FAIL — `Not enough credits` |

出力: `reports/tasful-ai-production-environment-probes.json`（`capturedAt` 本調査時刻）

### 3.4 復旧手順（運用 · コード変更なし）

1. [serper.dev](https://serper.dev) ダッシュボードで credits 購入、または有効 credits のある API キーを発行
2. 必要時のみ Supabase Dashboard → Edge Functions secrets → `SERPER_API_KEY` 更新（**値はログ・レポートに出さない**）
3. 再検証: `node scripts/verify-tasful-ai-production-environment.mjs`（Serper 行 PASS 期待）

### 3.5 修正案（コード）

**今回不要。** エラー UX は `ai-workspace-chat.js` + Gateway `searchFailed`/`searchMessage` で credits 不足メッセージ対応済み（`reports/tasful-ai-production-readiness.md` §A）。

---

## 4. Cloudflare Access — 本番 URL E2E

### 4.1 URL 前提（必須）

| ホスト | Access | 用途 |
| --- | --- | --- |
| `https://tasufull-article.pages.dev` | **有効** | **本番 alias** — E2E 対象 |
| `https://cf-pages-deploy.tasufull-article.pages.dev` | **無効** | deploy preview — MIME/Workspace 自動テスト用 |
| `https://48efcb84.tasufull-article.pages.dev` | 要確認 | 直近 deploy preview hash |

**注意:** `BUILDER_BASE_URL` は Builder 系ブラウザテスト用。TASFUL AI Pages E2E は **`PAGES_BASE_URL`**（または preflight の `PAGES_BASE`）を使う。

### 4.2 未認証時の挙動（本調査 · 再実行）

```powershell
$env:PAGES_BASE_URL="https://tasufull-article.pages.dev"
node scripts/verify-tasful-ai-access-workspace.mjs
```

| チェック | 結果 |
| --- | --- |
| Unauthenticated — Access gate active | ✅ PASS（Access ログイン HTML） |
| Authenticated MIME/routing | ❌ FAIL — `CF_ACCESS_CLIENT_ID/SECRET not set` |

出力: `reports/tasful-ai-access-workspace-check.json`

**解釈:** 本番 hostname は **意図どおり Access 保護**。未認証 curl/fetch は HTTP 200 だが **body は Access HTML**（JS MIME 検証 FAIL）。preflight §9 の「MIME 問題」は **ルーティングバグではなく Access ゲート**。

### 4.3 比較 — preview（Access なし · 過去 PASS）

`reports/tasful-ai-access-workspace-check.json`（`base: cf-pages-deploy.*`）:

- `/ai-workspace-chat.js` → `application/javascript` ✅
- Workspace HTML load · composer · 390px layout ✅

`reports/gemini-billing-recovery.md` §③: preview URL で Workspace live UI PASS。

### 4.4 既存 E2E スクリプト一覧

| スクリプト | 対象 BASE | Access 対応 | 用途 |
| --- | --- | --- | --- |
| **`verify-tasful-ai-access-workspace.mjs`** | `PAGES_BASE_URL`（default: 本番 alias） | `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` | **ai-workspace MIME + 390px + composer**（P0-2 直結） |
| **`smoke-gate-d-production.mjs`** | default: `tasufull-article.pages.dev` | 同上 + `--storage-state` | 全製品横断 Gate-D smoke |
| **`test-tasful-ai-production-preflight.mjs`** | `PAGES_BASE_URL` | トークン未対応（fetch のみ） | Edge / secrets / dist / browser |
| **`smoke-cloudflare-pages.mjs`** | `--base` / `PAGES_BASE_URL` | 未対応 | `/ai-workspace.html` 含む Pages smoke |
| **`save-gate-d-auth-storage.mjs`** | — | OTP Cookie 保存 | Service Token 代替 |
| **`verify-gemini-billing-recovery.mjs`** | preview URL 固定 | Access なし前提 | Gemini 429 復旧確認 |

### 4.5 Service Token 前提（運用）

| 変数 | ヘッダ |
| --- | --- |
| `CF_ACCESS_CLIENT_ID` | `CF-Access-Client-Id` |
| `CF_ACCESS_CLIENT_SECRET` | `CF-Access-Client-Secret` |

**手順（人間作業）:**

1. Cloudflare Zero Trust → Access → Service Auth → Create Service Token
2. Application `tasufull-article.pages.dev` の Policy に Service Auth を Include
3. `.env` / CI secrets に ID/Secret 設定（**値をログ出力しない**）
4. 検証:
   ```bash
   node --env-file=.env scripts/verify-tasful-ai-access-workspace.mjs
   # PAGES_BASE_URL=https://tasufull-article.pages.dev
   node --env-file=.env scripts/smoke-gate-d-production.mjs
   ```

**`reports/gate-d-smoke-last.json`:** `hasServiceToken: false` · 全 URL **BLOCKED**（2026-06-26 時点）。

### 4.6 修正案（コード）

**今回不要。** UD-002（Access 下の公開方針）は未決定だが、現状は **保護維持 + Service Token で E2E** が preflight / readiness と整合。

---

## 5. Workspace 課金 enforcement（Gateway + Edge quota）

### 5.1 現行構成

| レイヤ | ファイル | 課金 / quota | 状態 |
| --- | --- | --- | --- |
| **Gateway** | `ai-model-gateway.js` | `completeTurn()` — `Plans.resolveUserPlan()` で `user_plan` を **ログのみ** | ❌ 送信前チェックなし |
| **Plan UI** | `ai-plan-models.js` | Workspace surface では `WORKSPACE_MODEL_IDS` を **強制 enabled**（beta） | ⚠️ 表示 gating のみ無効化 |
| **Edge text** | `gemini-chat` / `openai-chat` / `claude-chat` | `user_plan` 受信なし · per-user quota なし | ❌ |
| **Edge Serper** | `serper-search` | anon キーで誰でも呼べる | ❌ |
| **gen-ai 専用** | `gen-ai-workspace.js` | `canUseGenAiFeature` / `incrementGenAiUsage` / `showUsageLimitBlocked` | ✅ **gen-ai-workspace のみ** |
| **gen-ai Stripe** | `_shared/apply-genai-entitlements.ts` | DB `gen_ai_entitlements` | ✅ gen-ai 専用 · **Workspace 未接続** |
| **TLV UI** | `ai-workspace-tlv-source.js` | `localStorage.tasu_ai_tlv_free_remaining` バナー | ⚠️ **表示のみ** · decrement なし |

**DECISIONS.md AD-005:** Gateway 契約変更は意図なし。enforcement 追加時は **既存 `completeTurn` 戻り値を拡張せず**、別モジュール or Edge 側 middleware が安全。

### 5.2 コード根拠（抜粋）

**Gateway — plan はログのみ:**

```378:393:ai-model-gateway.js
    logTurn({
      modeId: params.modeId,
      userText: params.userText,
      user_plan: userPlan,
      selected_model: model.id,
      // ... quota フィールドなし
    });
```

**Plan — Workspace では全モデル enabled:**

```164:172:ai-plan-models.js
  function listModelsForPlan(planId) {
    const plan = getPlan(planId);
    const workspace = isWorkspaceSurface();
    // ...
    if (workspace && WORKSPACE_MODEL_IDS.includes(id) && !model.comingSoon) {
      access = "enabled";
    }
```

**Edge — Serper に quota なし:** `serper-search/index.ts` は anon JWT のみで認可。

### 5.3 実装済み / 未実装 まとめ

| 機能 | gen-ai-workspace | ai-workspace (TASFUL AI) |
| --- | --- | --- |
| 日次 turn 上限 | ✅ localStorage | ❌ |
| 送信ブロック | ✅ | ❌ |
| Stripe entitlements | ✅ Edge + DB | ❌ |
| サーバー側 quota | ❌（gen-ai も client のみ） | ❌ |
| TLV 無料枠 UI | — | ⚠️ 表示のみ |

### 5.4 最小差分実装案（**未着手 · 参考のみ**）

preflight §11 / `reports/tasful-ai-production-readiness.md` §C と整合:

| Phase | 対象 | 最小差分 |
| --- | --- | --- |
| **1** | クライアント | 新規 `ai-workspace-usage.js`（gen-ai パターン流用）。`ai-workspace-chat.js` の `completeTurn` 前後で `canUse()` / `increment()`。TLV `source=tlv` は既存 storage key を decrement に接続 |
| **2** | Edge | Supabase `ai_usage_daily` + chat functions 入口 middleware（JWT user id）。超過時 **402/429** + message |
| **3** | Stripe | 既存 `apply-genai-entitlements.ts` / webhook を Workspace プランと統合 |

**触らない:** `TasuAiModelGateway.completeTurn()` シグネチャ（AD-005）。Phase 1 は Gateway **呼び出し側** でゲート。

**新規テスト案:** `scripts/test-ai-workspace-usage-enforcement.mjs`（mock quota 枯渇 → 送信ブロック）

---

## 6. P0-2 完了条件チェックリスト

| # | 条件 | 現状 | 次アクション |
| --- | --- | --- | --- |
| 1 | live Gemini/OpenAI/Claude text + Vision | ✅ | — |
| 2 | Serper live search | ❌ | Serper credits チャージ（運用） |
| 3 | 本番 alias + Access 下 Workspace E2E | ❌ | Service Token 発行・`.env` 設定 → `verify-tasful-ai-access-workspace.mjs` |
| 4 | Workspace quota enforcement | ❌ | Phase 1–2 設計 → 実装（別タスク） |

---

## 7. 推奨実行順（P0-2 クローズ）

| 順 | タスク | 種別 | ブロッカー |
| --- | --- | --- | --- |
| **1** | Serper credits チャージ + プローブ再実行 | **運用** | 外部課金 |
| **2** | CF Access Service Token 設定 + `verify-tasful-ai-access-workspace.mjs` PASS | **運用** | Zero Trust 設定 |
| **3** | `smoke-gate-d-production.mjs`（本番 alias） | **検証** | #2 完了後 |
| **4** | Workspace 課金 enforcement Phase 1 設計 | **実装** | P0-2 の「機能」残 · AD-005 順守 |

**P0-2 を「接続」だけで閉じる最小セット:** #1 + #2（#4 は Production Ready 全体の P1 要件として別途）。

---

## 8. 触っていないもの

- アプリ source（`ai-model-gateway.js` 等）— 変更なし
- `deploy/cloudflare/dist/` — 直接編集なし
- Supabase secrets 値
- Cloudflare / Wrangler 設定
- commit / deploy

---

## 9. 関連ファイル索引

| 領域 | ファイル |
| --- | --- |
| 正本 TODO | `docs/TODO.md` §P0-2 |
| Preflight | `reports/tasful-ai-production-preflight.md` |
| Gemini 復旧 | `reports/gemini-billing-recovery.md` |
| Readiness | `reports/tasful-ai-production-readiness.md` |
| Edge プローブ | `scripts/verify-tasful-ai-production-environment.mjs` |
| Access E2E | `scripts/verify-tasful-ai-access-workspace.mjs` |
| Gate-D | `scripts/smoke-gate-d-production.mjs` |
| Serper Edge | `supabase/functions/serper-search/index.ts` |
| Gateway | `ai-model-gateway.js` |
| Plan UI | `ai-plan-models.js` |
| gen-ai enforcement 参考 | `gen-ai-workspace.js` |

---

## 判定サマリー

| 項目 | 状態 |
| --- | --- |
| P0-2 コード経路 | ✅ 正常（Serper upstream 除く） |
| Serper | ❌ **外部 credits 枯渇** |
| CF Access E2E | ⚠️ **Service Token 未設定** |
| Workspace enforcement | ❌ **未実装（設計済み）** |
| **P0-2 Production Ready** | **NO**（上記 3 点残） |
