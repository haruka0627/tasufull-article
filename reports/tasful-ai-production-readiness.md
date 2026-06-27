# TASFUL AI Production Readiness — 判定レポート

実施日: 2026-06-26  
対象: TASFUL AI 共通基盤（Gateway / AI Core / Workspace / Edge）  
方針: Builder / Platform / TLV / AI秘書 / Voice / AI Core / Gateway の既存契約は変更しない。TLV・Platform・Talk 専用 AI は作らない。

---

## 現在の判定: **Conditional Go**

| 領域 | 判定 | 理由 |
| --- | --- | --- |
| テキスト AI（Gemini / GPT / Claude） | ✅ Go | live Edge 200 OK |
| Vision（3 プロバイダ） | ✅ Go | live Edge 200 OK |
| TLV → TASFUL AI 導線 | ✅ Go | 16/16 PASS |
| Web 検索（Serper） | ❌ No-Go | credits 枯渇（upstream 400 → Edge 502） |
| Cloudflare Access（本番 hostname E2E） | ⚠️ Conditional | Access 有効だが Service Token 未設定 |
| 課金 enforcement（Workspace） | ❌ No-Go | 表示のみ・消費/制限なし |

**解釈:** チャット・Vision・TLV 導線は本番利用可能。**Web 検索・課金制限・Access 自動検証**は人間作業または追加実装が必要。Serper credits 補充と Access Service Token 設定後、Workspace 課金 enforcement 設計・実装が残ブロッカー。

---

## 残ブロッカー一覧

| # | ブロッカー | 重要度 | 対応 |
| --- | --- | --- | --- |
| 1 | **Serper credits 枯渇** | P0 | [serper.dev](https://serper.dev) で credits 購入。Supabase secret `SERPER_API_KEY` は設定済み |
| 2 | **Cloudflare Access Service Token 未設定** | P1 | Zero Trust で Service Token 発行 → `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` を CI・ローカル `.env` に設定 |
| 3 | **Workspace 課金 enforcement 未実装** | P1 | 無料回数 UI は表示のみ。送信ゲート・サーバー側カウンタなし |
| 4 | **Pages 本番 alias 再デプロイ** | P2 | 今回の Web 検索 UX 修正を `tasufull-article.pages.dev` に反映するには Pages 再デプロイが必要 |

---

## A. Serper / Web Search 状態

### 経路

```
ai-workspace-chat.js
  → TasuAiModelGateway.completeTurn()
    → TasuAiSearchOrchestrator.prepare()
      → TasuSerperSearchService.search()
        → POST {SUPABASE_URL}/functions/v1/serper-search
          → supabase/functions/serper-search/index.ts
            → https://google.serper.dev/search (header: X-API-KEY)
```

### 設定名

| レイヤ | 名前 | 場所 |
| --- | --- | --- |
| Supabase Edge secret | `SERPER_API_KEY` | Supabase Dashboard → Edge Functions secrets |
| クライアント endpoint | `TASU_CHAT_SUPABASE_CONFIG.url` + `/functions/v1/serper-search` | `chat-supabase-config.js` |
| クライアント auth | anon key（`Authorization` / `apikey`） | 同上 |
| テスト mock | `global.__TASU_SERPER_MOCK_RESPONSE__` | ブラウザテスト用 |

**注意:** API キーはクライアントに露出しない。Edge 経由のみ。

### エラー時の挙動

| 条件 | Edge HTTP | Edge message（例） | クライアント `message` | 旧 UX | 今回修正後 UX |
| --- | --- | --- | --- | --- | --- |
| `SERPER_API_KEY` 未設定 | 503 | `SERPER_API_KEY is not configured` | `not_configured` 相当 | Web 専用モードでも AI デモ回答 | **Web 専用モード: 自然なエラー文** |
| credits 不足 | 502 | `Serper API error (400): …Not enough credits…` | upstream message | 同上 | **「利用枠が不足しています…」** |
| 429 / rate limit | 502 | `Serper API error (429)…` | `http_502` + message | 同上 | **「リクエストが集中…」** |
| 403 / 401 | 502 | `Serper API error (403/401)…` | 同上 | 同上 | **「アクセスできません…」** |
| Supabase 未設定 | — | — | `not_configured` | 同上 | 同上 |
| CORS / network | — | — | `cors_or_network` | 同上 | 同上 |

**ハイブリッドモード（TASFUL内 + Web）:** Web 側失敗時は TASFUL 内結果のみ表示。Web 専用ツール選択時のみ強制エラー表示。

### live プローブ結果（2026-06-26）

| 項目 | 結果 |
| --- | --- |
| `SERPER_API_KEY` on Edge | **設定済み**（値は未ログ） |
| live `serper-search` | **HTTP 502** — upstream `Not enough credits` |
| Web 検索機能 | **利用不可**（credits 補充まで） |

### 今回のコード変更（最小差分）

- `ai-model-gateway.js`: `completeTurn` 戻り値に `searchFailed` / `searchMessage` を追加（既存フィールドは不変）
- `ai-workspace-chat.js`: Web 専用強制検索失敗時にデモ回答ではなくユーザー向けエラー文を返す

`TasuAiModelGateway.completeTurn()` のシグネチャ・呼び出し契約は変更していない。

---

## B. Cloudflare Access Service Token 状態

### 保護対象

| ホスト | Access | 備考 |
| --- | --- | --- |
| `https://tasufull-article.pages.dev` | **有効** | 未認証 → Cloudflare Access ログイン HTML |
| `https://cf-pages-deploy.tasufull-article.pages.dev` | **無効**（preview） | 自動テスト・MIME 確認用 |

### 必要な env / secret 名

| 変数 | 用途 | ヘッダ |
| --- | --- | --- |
| `CF_ACCESS_CLIENT_ID` | Service Token Client ID | `CF-Access-Client-Id` |
| `CF_ACCESS_CLIENT_SECRET` | Service Token Client Secret | `CF-Access-Client-Secret` |

**参照スクリプト:**

- `scripts/smoke-gate-d-production.mjs`
- `scripts/verify-tasful-ai-access-workspace.mjs`
- `scripts/save-gate-d-auth-storage.mjs`（ブラウザ Cookie 方式の代替）

**ローカル `.env` 状態（2026-06-26）:** `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` **未設定**。`CLOUDFLARE_API_TOKEN` は設定済み（Pages API 用。Zero Trust 編集権限は別途必要）。

### 未設定時の失敗モード

| シナリオ | 挙動 |
| --- | --- |
| 人間ユーザー（未ログイン） | Access OTP / IdP ログイン画面。Workspace 本体未到達 |
| curl / fetch（トークンなし） | HTTP 200 だが body は Access HTML（JS MIME 検証 FAIL） |
| CI smoke（トークンなし） | `verify-tasful-ai-access-workspace.mjs` が **FAIL** |
| Service Token 設定後 | 実 asset が正しい MIME で取得可能 |

### 本番適用手順（人間作業）

1. Cloudflare Zero Trust → **Access** → **Service Auth** → **Create Service Token**
2. Application（`tasufull-article.pages.dev`）の Policy に **Service Auth** を Include
3. 発行された Client ID / Secret を **値をログに出さず** 以下へ設定:
   - ローカル `.env`: `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`
   - CI secrets（GitHub Actions 等）
4. 検証:
   ```bash
   node --env-file=.env scripts/verify-tasful-ai-access-workspace.mjs
   # PAGES_BASE_URL=https://tasufull-article.pages.dev
   ```
5. 代替: `node scripts/save-gate-d-auth-storage.mjs` で OTP ログイン Cookie を保存 → `--storage-state reports/gate-d-auth-storage.json`

---

## C. 課金 enforcement 状態

### 正本（source of truth）

| 領域 | 正本 | 備考 |
| --- | --- | --- |
| プラン定義（UI） | `ai-plan-models.js` → `PLANS`, `resolveUserPlan()` | Workspace では **全モデル enabled**（beta 扱い） |
| gen-ai 日次 usage | `gen-ai-workspace.js` → `localStorage.tasu_genai_usage` | **gen-ai-workspace のみ** enforcement あり |
| gen-ai Stripe  entitlements | `supabase/functions/_shared/apply-genai-entitlements.ts` | DB `gen_ai_entitlements` — gen-ai 専用 |
| TLV 無料回数 UI | `ai-workspace-tlv-source.js` → `localStorage.tasu_ai_tlv_free_remaining` | **表示のみ**。送信時の decrement なし |
| Gateway / Edge | `ai-model-gateway.js` | `user_plan` を Edge に渡すが **quota チェックなし** |

### 表示のみ（enforcement なし）

| 箇所 | 内容 |
| --- | --- |
| `ai-workspace-tlv-source.js` | 「残り N 回」バナー。枯渇時 CTA → `gen-ai-workspace.html` |
| `ai-plan-models.js` | Workspace surface では GPT/Claude も選択可能（プラン gating 無効化） |
| `ai-faq-knowledge.js` | FAQ 文案「一部無料」— 情報のみ |

### 実装済み enforcement（gen-ai-workspace のみ）

| 関数 | 動作 |
| --- | --- |
| `canUseGenAiFeature(type)` | 日次残数 > 0 |
| `incrementGenAiUsage(type)` | 送信成功時に localStorage 加算 |
| `showUsageLimitBlocked(type)` | 枯渇時バナー + 送信ブロック |

**ai-workspace には未接続。** 今回 Stripe 深掘りは行わない。

### 安全な実装案（次フェーズ）

1. **Phase 1（クライアントのみ）:** gen-ai と同パターンで `ai-workspace-usage.js` を新設。`completeTurn` 前に `canUse()` / 成功後 `increment()`。TLV `source=tlv` は既存 storage key を decrement に接続。
2. **Phase 2（サーバー）:** Supabase `ai_usage_daily` テーブル + Edge middleware。JWT user id ベース。localStorage は表示キャッシュのみ。
3. **Phase 3（Stripe）:** 既存 `apply-genai-entitlements.ts` / Stripe webhook を Workspace プランと統合。

**リスク:** Phase 1 のみだと bypass 可能。本番課金には Phase 2 必須。

---

## D. 実行テストと結果

| コマンド | 結果 | 備考 |
| --- | --- | --- |
| `npm run build:pages` | **PASS** | dist 更新済み（Web 検索 UX 修正含む） |
| `node scripts/test-tasful-ai-production-preflight.mjs` | **39/39 PASS** | Pages base: `cf-pages-deploy.*`（Access なし）。Serper live **502 credits** |
| `node scripts/test-tasful-ai-final-smoke-browser.mjs` | **53/53 PASS** | Gateway / 添付 / Vision / Voice 回帰 OK |
| `node scripts/test-tlv-tasful-ai-entry.mjs` | **16/16 PASS** | TLV 導線・Gateway 不変確認 |
| `node scripts/verify-tasful-ai-access-workspace.mjs` | **PASS**（preview URL） | Service Token 未設定 |
| `PAGES_BASE_URL=https://tasufull-article.pages.dev node scripts/verify-tasful-ai-access-workspace.mjs` | **FAIL** | Access 有効・Service Token 未設定 |

### シナリオ別確認（コードレビュー + live プローブ）

| シナリオ | 確認方法 | 結果 |
| --- | --- | --- |
| Serper 未設定 | Edge 503 パス確認 | コード対応済。live は key **設定済み** |
| Serper credits 不足 | live Edge プローブ | **502 Not enough credits** |
| Access token 未設定 | verify スクリプト | prod hostname **FAIL** |
| 無料回数残あり | TLV UI | バナー表示 OK。**消費なし** |
| 無料回数 0 | `localStorage` 手動 | 枯渇 CTA 表示。**送信ブロックなし** |
| `source=tlv` | TLV entry テスト | **PASS** |
| `source=platform` / `source=talk` / なし | コード検索 | **専用分岐なし**（通常 Workspace） |

---

## E. 変更ファイル一覧

| ファイル | 変更内容 |
| --- | --- |
| `ai-model-gateway.js` | `completeTurn` 戻り値に `searchFailed` / `searchMessage` 追加 |
| `ai-workspace-chat.js` | Web 専用検索失敗時のユーザー向けエラーメッセージ |
| `reports/tasful-ai-production-readiness.md` | 本レポート（新規） |

**未変更（契約維持）:** `TasuAiModelGateway.completeTurn` 呼び出し側シグネチャ、AI Core、AI秘書、Builder、Platform、Voice、TLV entry モジュール。

---

## 本番適用前に人間が設定すべき secret / 外部作業

| 作業 | 担当 | 詳細 |
| --- | --- | --- |
| Serper credits 購入 | 運用 | serper.dev アカウント。secret 名は `SERPER_API_KEY`（再設定不要なら credits のみ） |
| Cloudflare Access Service Token | インフラ | `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` |
| Pages 再デploy | インフラ | 今回の JS 修正を本番 alias へ反映 |
| Workspace 課金設計 | プロダクト | Phase 1–3 のどこまでを Go 条件に含めるか決定 |
| Access 後の手動 smoke | QA | OTP ログイン後 `ai-workspace.html` で Web 検索・Vision 目視 |

---

## Builder / Platform / TLV / Talk / AI秘書への影響

| 領域 | 影響 |
| --- | --- |
| **Builder** | なし |
| **Platform** | なし |
| **TLV** | なし（導線・テンプレ・無料 UI は既存のまま） |
| **Talk** | なし |
| **AI秘書** | なし |
| **Voice Core** | なし |
| **Gateway / AI Core** | 戻り値に optional フィールド追加のみ。破壊的変更なし |
| **gen-ai-workspace** | なし（別 surface の enforcement は独立） |

---

## 次にやるべきこと

1. **Serper credits 補充** → live `serper-search` が 200 / `ok: true` になることを preflight で再確認
2. **Cloudflare Access Service Token 設定** → `tasufull-article.pages.dev` で verify スクリプト PASS
3. **Pages 再デプロイ** → Web 検索失敗 UX 修正を本番反映
4. **Workspace 課金 enforcement Phase 1** — gen-ai パターンを `ai-workspace` に接続（設計承認後）
5. **Go 判定の再評価** — 上記 1–3 完了後 **Go**、4 は monetization Go-Live 条件

---

## 参照

- `reports/tasful-ai-production-preflight.md`
- `reports/tasful-ai-production-environment-fix.md`
- `reports/gemini-billing-recovery.md`
- `reports/tlv-tasful-ai-entry.md`
- `reports/production-private-test-access-plan.md`
- `reports/tasful-ai-production-preflight-probe.json`
- `reports/tasful-ai-access-workspace-check.json`
