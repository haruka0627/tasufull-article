# AI 秘書 DeepSeek Phase 2 — OpsContextBuilder 設計

**実施日:** 2026-06-26  
**状態:** 設計正本 · **Phase 2 実装完了**（`reports/secretary-ops-context-builder-phase2.md` · **未コミット · 未デプロイ**）  
**前提:** Phase 1 DeepSeek Adapter 完了 — `reports/secretary-deepseek-adapter-phase1.md`  
**参照設計:** `reports/secretary-deepseek-adapter-design.md` · AD-010 · AD-005

---

## 現状の問題

| # | 問題 | 根拠 |
| --- | --- | --- |
| 1 | **LLM に運営データが渡っていない** | `admin-ai-secretary-phase2.js` は固定 `SYSTEM_PROMPT` + チャット履歴のみ。DeepSeek は接続済みでも **実データ根拠の回答不可** |
| 2 | **6 ドメインの統一ビューが存在しない** | `TasuTalkOpsAssistant.buildHubSections()` は 7 セクション（priority / open_inquiry / report / anpi / connect / builder / ops_watch）。**Platform · TLV · AI利用状況** は秘書 Q&A 向けに正規化されていない |
| 3 | **データは散在しているが再利用可能** | Daily Inbox · KPI Center · Action Board · Dashboard metrics は **同一 localStorage / Store** から取得済み。新規 DB レイヤーは不要 |
| 4 | **差分（「昨日から増えた」）の比較基盤は一部のみ** | `TasuAdminAiKpiCenter.compareKpiWithPrevious()` + KPI snapshot（14 日）あり。**案件単位の inbox diff** は未実装 |
| 5 | **TLV は OPS 秘書未接続** | `live/` は FEATURE FROZEN（AD-004）。ダッシュボード refresh パイプラインに TLV collector なし |
| 6 | **AI利用状況は集計 UI のみ** | `TasuAiInteractionLog`（localStorage）+ `buildApiCostSnapshot()` は件数のみ。秘書 LLM 入力用サマリなし |
| 7 | **Stripe / Connect が Support 内に混在** | Connect issue チケット · Stripe webhook sim · `TasuAdminConnectAiSupport` · revenue KPI が別モジュール。**LLM 向けに分離されていない** |
| 8 | **regex コマンドと NL Q&A の役割が未整理** | `parseTalkOpsCommand` は **決定的抽出**（最大 8 件 + href）。DeepSeek は **要約・優先付け・横断整理** 向きだが context 未注入のため mock 的応答に留まる |

---

## 目標構成

Phase 1 の Adapter / Pages Function **契約は維持**し、**クライアント側で systemPrompt に運営 context を付与**する（Edge body スキーマ拡張は Phase 2 では行わない）。

```
┌─────────────────────────────────────────────────────────────────┐
│ admin-operations-dashboard.js refresh()                         │
│   hub · metrics · kpi · priorityRows · checkResult              │
└────────────────────────────┬────────────────────────────────────┘
                             │ 同一 tick のスナップショット（任意キャッシュ）
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ TasuSecretaryOpsContextBuilder  （新規 · 読取専用）              │
│   build({ userText, filters, snapshot? }) → OpsContextV1        │
│   · 既存 collector 委譲 · 6 ドメイン正規化 · PII マスク · top-N   │
└────────────────────────────┬────────────────────────────────────┘
                             │ OpsContextV1 JSON（要約済み）
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ admin-ai-secretary-phase2.js sendMessage()                      │
│   intent = resolveSecretaryIntent(userText)  （軽量 · regex）    │
│   ctx = Builder.build({ userText, filters: intent.filters })    │
│   systemPrompt = BASE + formatContextForPrompt(ctx)             │
└────────────────────────────┬────────────────────────────────────┘
                             │ 既存 completeTurn({ systemPrompt, ... })
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ TasuSecretaryDeepSeekAdapter → /api/secretary-deepseek-chat     │
│   （Phase 1 構成変更なし · Gateway 非経由）                      │
└─────────────────────────────────────────────────────────────────┘

並行（変更なし）:
  talk-ops-assistant.postUserCommand → parseTalkOpsCommand（regex 抽出）
  ops-watch-analyzer → Gateway（ops_watch）
```

**設計原則**

1. **取得はプログラム · 推論は DeepSeek** — Store / collector から deterministically 構築
2. **既存関数をラップ** — `buildInboxItems` 等のロジック複製禁止
3. **PII 非送信** — マスク済み summary のみ LLM へ
4. **oversized 回避** — top-N · 件数サマリ · token/char budget
5. **Adapter / Gateway / Builder AI / TASFUL AI / Site Assistant 非変更**（Phase 2）

---

## 1. OpsContextBuilder の責務

| 責務 | 内容 |
| --- | --- |
| **収集オーケストレーション** | 既存 API を呼び、1 回の `build()` で一貫したスナップショットを返す |
| **6 ドメイン正規化** | 生 inbox / hub / kpi を `domains.*` にマッピング |
| **Intent 連動フィルタ** | `filters.domains` · `filters.since` · `filters.diffOnly` を適用 |
| **差分計算** | KPI 前日比（既存）+ inbox ID 集合 diff（新規 · 軽量） |
| **PII サニタイズ** | 全 item / summary フィールドをマスク規則で通過 |
| **サイズ制御** | top-N 切り詰め · `meta.truncated` · char budget 超過時の domain 優先度降格 |
| **非責務** | DB 書込 · 実行操作 · LLM 呼び出し · UI 描画 · Edge 改修 |

**公開 API（案）**

```javascript
global.TasuSecretaryOpsContextBuilder = {
  SCHEMA_VERSION: "ops_context_v1",
  build(options),           // → OpsContextV1
  resolveIntent(userText),  // → { domains?, diffOnly?, since? }
  sanitizeItem(raw),        // テスト用
  formatForSystemPrompt(ctx), // → string（systemPrompt 追記部）
};
```

---

## 2. 既存データソースの再利用範囲

| 既存 API | 再利用内容 | Builder での使い方 |
| --- | --- | --- |
| `TasuTalkOpsAssistant.buildHubSections()` | priority / inquiries / reports / anpi / connect / builder / ops_watch · `metrics` · `summaryText` | Support / Connect / Builder の **items ソース** · 全体 summary |
| `TasuAdminAiDailyInbox.buildInboxItems()` | 統合 inbox（source タグ付き） | 6 ドメインへの **正規化入力** · diff の ID 集合 |
| `TasuAdminAiKpiCenter.collectKpiMetrics()` | 当日 KPI 数値 | 各 domain `metrics` + 全体 `kpiSummary` |
| `TasuAdminAiKpiCenter.getPreviousKpiSummary()` | 前日 snapshot | `deltas.kpi` |
| `TasuAdminAiKpiCenter.compareKpiWithPrevious()` | 前日比 | `deltas.kpi` 詳細 |
| `TasuAdminOperationsDashboard.buildMetrics()`（refresh 引数） | openCount · connectCount · violation 等 | `globalSummary` 補完 |
| `TasuAdminOperationsDashboard.buildPriorityRows()` | 本日 top 4 優先 | `priorities[]`（横断） |
| `TasuAdminAiActionBoard.buildActionBoard(ctx)` | urgent / today キュー | `priorities[]` 補完（actionLevel 付き） |
| `TasuAdminAiOpsWatch.collectCurrentMetrics()` | market / connect / builder 詳細 | Platform / Stripe 指標 |
| `TasuAdminConnectAiSupport.buildConnectActionItems()` | Connect 専用 action | **Stripe 分離後** Connect 側 items |
| `TasuPlatformOpsInboxBridge.collectExternalInboxItems()` | content_gate / platform 審査 | Platform domain |
| `TasuAiInteractionLog.readLogs()` | AI 利用ログ | AI利用状況 domain（集計のみ） |
| `TasuMarketEventStore.listMarketEvents()` | 市場イベント | Platform + Stripe（決済系イベント） |

**再利用しない（Phase 2）**

- `TasuAiModelGateway` / `completeTurn`
- Supabase 直接 fetch（新規 Edge クエリ）
- TLV 本番 API（未接続 · 下記 stub のみ）

---

## 3. 6 ドメインの正規化仕様

秘書 UI・KPI カード・Inbox `source` を **運営者向け 6 ドメイン** に再マップする。

### 3.1 ドメイン定義

| ドメイン ID | 表示名 | 含む | 除外 |
| --- | --- | --- | --- |
| `support` | Support | 問い合わせ · 通報 · 安否 · AI運営案件 · TALK 重要通知 | Connect 専用 · 市場決済 · Builder |
| `builder` | Builder | パートナー評価 · 非表示 · 審査待ち · builder revenue KPI | Platform 一般 |
| `platform` | Platform | content_gate · moderation queue · 市場注文/返金（非 Stripe 本体） · platform notify | Connect · Builder |
| `stripe_connect` | Stripe / Connect | Connect onboarding / payout / identity · Stripe webhook 系チケット · Connect revenue/failure KPI | 一般 support 問い合わせ |
| `tlv` | TLV | （Phase 2 stub） | — |
| `ai_usage` | AI利用状況 | interaction log 集計 · automation rate · secretary 自身の呼び出し回数 | 生 `user_text_preview` 全文 |

### 3.2 Inbox `source` → domain マッピング

| inbox.source | domain |
| --- | --- |
| `support`, `ai_ops`, `anpi`, `talk` | `support` |
| `builder` | `builder` |
| `market`, `content_gate`, `response_plan`* , `automation`* | `platform`（*は ops 系のみ） |
| `connect` | `stripe_connect` |
| （なし） | `tlv` · `ai_usage` は inbox 外 collector |

### 3.3 Hub `section.id` → domain マッピング

| section.id | domain |
| --- | --- |
| `priority`, `open_inquiry`, `report`, `anpi`, `ops_watch` | `support`（ops_watch は support 配下 · ラベル「TALK/OPS WATCH」） |
| `builder` | `builder` |
| `connect` | `stripe_connect` |

### 3.4 正規化 item スキーマ（ドメイン共通）

```typescript
type OpsContextItem = {
  id: string;              // 内部 ID（ticket_xxx · inbox_xxx）— LLM 参照用 · PII なし
  domain: DomainId;
  category: "needs_judgment" | "pending_approval" | "auto_done" | "info";
  priority: "critical" | "high" | "normal" | "low";
  title: string;           // マスク済 · max 80 chars
  reason: string;          // マスク済 · max 120 chars
  recommendedAction: string; // max 80 chars
  ageLabel: string;        // "今日" | "昨日" | "3日前" — 相対表示（ISO 日時は渡さない）
  countsToward: string[];  // 例: ["unresolved", "high_risk"]
  // href · user_id · email · 生 body は LLM に渡さない
};
```

### 3.5 domain オブジェクト

```typescript
type OpsContextDomain = {
  id: DomainId;
  label: string;
  status: "ok" | "watch" | "critical" | "unknown";
  metrics: Record<string, number>;  // 数値のみ
  deltas?: Record<string, number>; // 前日比（あれば）
  topItems: OpsContextItem[];       // top-N
  summaryLine: string;              // 1 行要約（プログラム生成）
  dataQuality: "live" | "partial" | "stub";
};
```

---

## 4. TLV 未接続部分の最小 collector 方針

**方針:** Phase 2 は **stub domain** のみ。TLV FEATURE FROZEN（AD-004）を破らない。

| 項目 | Phase 2 |
| --- | --- |
| データ源 | なし（Supabase TLV ops API 新設しない） |
| `dataQuality` | 常に `"stub"` |
| `metrics` | `{ tlvOpsConnected: 0 }` |
| `summaryLine` | 「TLV 運営データは OPS 秘書に未接続です。TLV 管理画面（live/admin-*）で直接確認してください。」 |
| `topItems` | `[]` |
| 将来フック | `TasuSecretaryOpsContextBuilder.collectTlvStub()` — Phase 3 で `TasuTlvAdminReportStore` 等に差し替え可能な **interface のみ** 定義 |

**Intent 「TLVだけ」:** domain フィルタで stub を返し、LLM に「未接続 · 手動確認を案内」と明示。

---

## 5. AI利用状況の最小 collector 方針

**データ源:** `TasuAiInteractionLog.readLogs()`（localStorage · max 500 件）

| 出力 | 内容 |
| --- | --- |
| `metrics.todayCount` | 本日の全 surface 合計 |
| `metrics.weekCount` | 7 日以内 |
| `metrics.bySurface` | `{ ops_secretary, platform, builder, tlv, ... }` 件数のみ |
| `metrics.byProvider` | `{ deepseek, gemini, openai, ... }` 件数のみ |
| `metrics.fallbackRate` | `fallback_used` 比率 |
| `metrics.searchUsedRate` | `search_used` 比率 |
| `topItems` | **空**（個別ログ行は渡さない） |
| `summaryLine` | 例: 「直近7日 AI 呼び出し 42 回（秘書 3 · Gateway 39）。フォールバック 5%。」 |

**禁止:** `user_text_preview` を LLM へ送らない（件数集計のみ）。秘書自身の Phase 2 呼び出しは DeepSeek Adapter 経由のため Gateway log とは別 — `surface: ops_secretary` を明示集計。

---

## 6. Stripe / Connect の分離方針

| 区分 | 判定規則 | 主データ源 |
| --- | --- | --- |
| **Connect（運用）** | inbox.source=`connect` · hub section connect · `TasuAdminConnectAiSupport` · KPI `connectApplications` / `connectFailures` / `connectAiPending` | Connect action items + connect_issue tickets/cases |
| **Stripe（決済インフラ）** | ticket.`stripe_connect_meta` · `source=stripe_webhook_sim` · market 決済イベント · KPI `paymentCount` / `refundAmount` / revenue 系 | Support tickets（Stripe タグ）+ `TasuMarketEventStore` 決済系 + `collectRevenueMetrics` |
| **Support に混ざる Connect** | `category=connect_issue` → **stripe_connect** へ移動（support 件数から除外） |

**LLM への説明文言（system 固定）:**

> Connect = 本人確認・口座・出金ゲート。Stripe = 決済・返金・ webhook 異常。実行（返金/BAN）は管理画面のみ。

**metrics 分離例**

```json
"stripe_connect": {
  "metrics": {
    "connectPending": 2,
    "connectFailures": 1,
    "stripeWebhookTickets": 0,
    "paymentCountToday": 5,
    "refundRequestedToday": 1
  }
}
```

---

## 7. context JSON スキーマ（OpsContextV1）

```json
{
  "schemaVersion": "ops_context_v1",
  "generatedAt": "2026-06-26T12:00:00.000Z",
  "timezone": "Asia/Tokyo",
  "filtersApplied": {
    "domains": ["builder"],
    "diffOnly": false,
    "since": null
  },
  "globalSummary": {
    "headline": "未対応 12 · 高リスク 2 · Connect 要確認 1",
    "priorityQuestionHint": "support > stripe_connect > builder の順で確認推奨",
    "hubSummaryText": "（buildDailySummaryText の先頭 300 文字 · マスク済）"
  },
  "priorities": [
    {
      "rank": 1,
      "domain": "support",
      "title": "【通報】不適切出品の報告",
      "priority": "critical"
    }
  ],
  "kpiSummary": {
    "inquiries": 3,
    "unresolved": 12,
    "reports": 1,
    "connectFailures": 1,
    "builderPending": 2
  },
  "deltas": {
    "kpi": {
      "inquiries": 2,
      "unresolved": 1,
      "reports": 0
    },
    "inboxNewSinceYesterday": {
      "support": 1,
      "builder": 1,
      "platform": 0,
      "stripe_connect": 0,
      "tlv": 0,
      "ai_usage": 0
    }
  },
  "domains": {
    "support": { "...": "OpsContextDomain" },
    "builder": { "...": "OpsContextDomain" },
    "platform": { "...": "OpsContextDomain" },
    "stripe_connect": { "...": "OpsContextDomain" },
    "tlv": { "...": "OpsContextDomain · stub" },
    "ai_usage": { "...": "OpsContextDomain" }
  },
  "meta": {
    "sourceModules": [
      "TasuTalkOpsAssistant.buildHubSections",
      "TasuAdminAiDailyInbox.buildInboxItems",
      "TasuAdminAiKpiCenter.collectKpiMetrics"
    ],
    "truncated": false,
    "approxChars": 4200,
    "itemLimits": { "perDomain": 5, "priorities": 5 }
  }
}
```

---

## 8. top-N / token budget / summary 方針

### 8.1 件数上限（デフォルト）

| 対象 | top-N |
| --- | --- |
| `domains.*.topItems` | **5** / domain |
| `priorities` | **5** |
| hub section からの取り込み | section 既存 slice を尊重（priority 8 → 5 に再 slice） |
| inbox 全体 | domain 分配後 top-N（ソート: category → priority → createdAt） |

### 8.2 Char budget（Phase 2 · client-side）

| 項目 | 上限 |
| --- | --- |
| `formatForSystemPrompt(ctx)` 全体 | **6,000 chars**（`systemPrompt` 既存 ~400 + context ~5,600） |
| Edge `trimSecretaryText(systemPrompt, 8000)` | 余裕 2,000 chars for history/system overhead |
| 超過時の降格順 | ① `hubSummaryText` 短縮 ② `domains.ai_usage` metrics のみ ③ `domains.tlv` stub 1 行 ④ 各 domain topItems 3→2→1 ⑤ platform items 削減 |
| `meta.truncated` | 降格発生時 `true` |

### 8.3 Summary 生成（LLM 非依存）

各 domain の `summaryLine` は **テンプレート文字列**:

```
"{label}: 要判断 {n} · 承認待ち {m} · 前日比 {deltaLabel}"
```

`globalSummary.headline` は KPI + priority 先頭 1 件からプログラム合成。

---

## 9. PII マスク方針

| データ | LLM へ |
| --- | --- |
| `user_id` / `talkUserId` / UUID | **`user_[hash8]`**（SHA-256 先頭 8 · salt 固定文字列 · 可逆不要） |
| メール · 電話 · 住所 | **削除**（regex `@` · `\d{10,}` · 都道府県パターン） |
| 氏名（パートナー名等） | **イニシャル化** または `パートナーA` 連番 |
| チケット/案件 **本文** | title + reason **120 字以内** · マスク後 |
| `href` / URL クエリ | **渡さない**（「Support 画面で ticket 参照可」程度の指示のみ） |
| 決済金額 | **集計値のみ**（個別注文 ID なし） |
| Stripe account ID | **渡さない** |
| AI log `user_text_preview` | **渡さない** |

**sanitizer 実装:** `admin-ai-secretary-ops-context-sanitize.js`（純関数 · 単体テスト必須）

---

## 10. phase2 → DeepSeek Adapter への渡し方

**Phase 1 Adapter 契約を維持** — `completeTurn({ userText, messages, systemPrompt, modeId, mockFallback })` のみ使用。

```javascript
// admin-ai-secretary-phase2.js（Phase 2 変更イメージ）
async function requestAssistantReply(userText, history) {
  const intent = TasuSecretaryOpsContextBuilder.resolveIntent(userText);
  const opsCtx = TasuSecretaryOpsContextBuilder.build({
    userText,
    filters: intent.filters,
    snapshot: lastDashboardSnapshot, // refresh() で更新
  });
  const systemPrompt =
    SYSTEM_PROMPT +
    "\n\n---\n" +
    TasuSecretaryOpsContextBuilder.formatForSystemPrompt(opsCtx);

  return Adapter.completeTurn({ userText, messages, systemPrompt, ... });
}
```

**`formatForSystemPrompt` 出力形式（推奨）**

```
## 運営コンテキスト（参照専用 · 実行不可）
- 生成: 2026-06-26 JST
- フィルタ: domains=builder

### 全体
未対応 12 · Builder 承認待ち 2

### Builder
status: watch
metrics: builderPending=2, builderRejections=0, delta(builderPending)=+1
items:
1. [critical] パートナーA — 非表示（ドタキャン） — 審査画面で確認
...

回答ルール:
- 上記データに無い数値は推測しない
- 実行操作は提案せず画面確認を促す
- 不足時は「データなし」と明言
```

**Edge / `secretary-deepseek-chat.js`:** Phase 2 では **変更しない**（systemPrompt 追記で足りる）。

**Dashboard スナップショット:** `refresh()` 戻り値を `TasuAdminAiSecretaryPhase2.setOpsSnapshot(ctx)` で保持し、送信時の DB 再読込 race を軽減（最大 60s TTL で再 build 可）。

---

## 11. ドメイン / 差分フィルタ方針

### 11.1 Intent 解決（`resolveIntent` · regex 優先 · LLM 不使用）

| ユーザー発話パターン | filters |
| --- | --- |
| `Builderだけ` / `Builderのみ` / `Builder に絞` | `{ domains: ["builder"] }` |
| `Platformだけ` / `市場だけ` | `{ domains: ["platform"] }` |
| `Connect` / `Stripe` | `{ domains: ["stripe_connect"] }` |
| `Support` / `問い合わせ` / `通報` | `{ domains: ["support"] }` |
| `TLV` | `{ domains: ["tlv"] }` |
| `AI利用` / `API利用状況` | `{ domains: ["ai_usage"] }` |
| `昨日から増えた` / `前日比` / `差分` | `{ diffOnly: true }` |
| `今日は何を優先` / 優先 | `{ domains: null, prioritize: true }` — priorities 全ドメイン |
| 無指定 | `{}` — 全 domain · top-N |

### 11.2 diffOnly 動作

1. **KPI 差分:** 既存 `compareKpiWithPrevious(collectKpiMetrics(), getPreviousKpiSummary())` — delta > 0 の metric のみ `deltas.kpi` に残す
2. **Inbox 差分（新規）:** `localStorage` key `tasu_secretary_inbox_ids_v1` に前回 build 時の `{ domain: Set<id> }` を保存。今回 inbox ID と比較し **新規出現 ID のみ** `topItems` に（初回は diff なし · KPI diff のみ）
3. **diffOnly=true かつ新規 0 件:** `summaryLine`: 「前日比で増加した案件は検知されていません（KPI: inquiries +2）」

---

## 12. 既存 regex command と DeepSeek Q&A の役割分担

| 手段 | 入口 | 強み | 弱み | Phase 2 位置づけ |
| --- | --- | --- | --- | --- |
| **運営コマンド** | `talk-ops-assistant.postUserCommand` · `parseTalkOpsCommand` | 決定的 · href 付き一覧 · 8 件抽出 | 横断整理 · 優先理由 · 自然文不可 | **変更なし** — 案件リスト取得専用 |
| **DeepSeek 秘書チャット** | `admin-ai-secretary-phase2.sendMessage` | 要約 · 優先順位 · 複数 domain 横断 · 理由説明 | 件数の厳密一致 · URL 列挙 | **OpsContext 注入で強化** |
| **OPS WATCH 分析** | `ops-watch-analyzer` + Gateway | 異常検知 JSON | 秘書チャットではない | **非接触** |

**UX ガイダンス（quick chip / brief 追記案）**

- 「一覧が欲しい → 下部 運営コマンド（例: 未対応だけ）」
- 「優先順位と理由 → AI チャット（本日の優先対応は？）」

**重複回避:** regex command パターンと同じ文言が秘書 chat に来た場合、DeepSeek は **context 要約** を返し、詳細リストはコマンド誘導（system 固定ルール）。

---

## 13. テスト計画

| # | テスト | 種別 | 合格基準 |
| --- | --- | --- | --- |
| T1 | `test-secretary-ops-context-builder-unit.mjs` | Node 単体 | 6 domain マッピング · PII マスク · top-N · budget 降格 |
| T2 | `test-secretary-ops-context-intent.mjs` | Node | 「Builderだけ」「昨日から増えた」→ filters 期待値 |
| T3 | `test-secretary-ops-context-inbox-diff.mjs` | Node | inbox ID diff · 初回 / 2 回目 |
| T4 | `test-secretary-deepseek-adapter-browser.mjs` 拡張 | Playwright | `completeTurn` に context 付き systemPrompt が渡る（hook） |
| T5 | `test-admin-ai-secretary-text-chat-browser.mjs` 拡張 | Playwright | 送信後クラッシュなし · mock 時も context build 実行 |
| T6 | `test-secretary-ops-context-fixture.mjs` | Node | 固定 seed JSON → golden OpsContextV1 snapshot |
| T7 | 手動スモーク | 実 DeepSeek | 「今日は何を優先？」→ 応答に inbox/KPI 数値が含まれる · PII なし |
| T8 | 回帰 | 既存 | Gateway / OPS WATCH / postUserCommand 挙動不変 |

**Fixture:** `scripts/fixtures/secretary-ops-context-seed.json`（テスト専用 · リポジトリ OK · 実 PII 禁止）

---

## 14. Phase 2 実装範囲

| 項目 | 含む |
| --- | --- |
| 新規 `admin-ai-secretary-ops-context.js` + sanitize ヘルパ | ✅ |
| `admin-ai-secretary-phase2.js` — build 呼び出し · systemPrompt 合成 · snapshot 保持 | ✅ |
| inbox ID diff 用 localStorage（秘書専用 key） | ✅ |
| `formatForSystemPrompt` · char budget | ✅ |
| TLV stub domain | ✅ |
| AI利用状況集計 domain | ✅ |
| Stripe / Connect 分離 | ✅ |
| ドキュメント `docs/AI/SECRETARY_AI.md` Phase 2 節 | ✅ |
| 単体 + browser テスト（T1–T6） | ✅ |

| 項目 | 含まない |
| --- | --- |
| Edge / Adapter API スキーマ変更 | ❌ |
| Gateway / OPS WATCH 変更 | ❌ |
| TLV 本番 API 接続 | ❌ |
| LLM による intent 分類 | ❌ |
| ストリーミング | ❌ |
| 案件単位の Supabase 履歴 diff | ❌ |
| Trend Scout / Site Assistant | ❌ |

---

## 15. Phase 3 以降に送る範囲

| 項目 | 内容 |
| --- | --- |
| TLV 本番 collector | `live/admin-*` · Supabase TLV ops テーブル接続 · AD-004 解凍後 |
| Edge 側 context 検証 | `opsContext` フィールド · server-side PII 再チェック · schemaVersion gate |
| Inbox diff の server snapshot | 日次 Supabase / CF KV で ID 履歴（複数端末一致） |
| LLM intent（オプション） | regex 漏れのフォールバック · コスト上限付き |
| ストリーミング応答 | Adapter Phase 2+ |
| Action Board 実行連携 | 「提案」から executor へ — 凍結ポリシー要レビュー |
| Trend Scout 外部ソース | `ai-secretary-trend-scout-backlog.md` |
| Site Assistant 集約 | `tasful-site-assistant-backlog.md` |
| 月次レポート · Voice 読上げ最適化 | Phase 6–8 スタブ領域 |

---

## データソース対応表

| 6 ドメイン | 主要 collector | KPI keys | Hub section | Inbox source |
| --- | --- | --- | --- | --- |
| **Support** | `collectFromSupport`, `collectFromAiOps`, `collectFromAnpi`, hub priority/report/open | inquiries, unresolved, reports, highRisk, anpiEmergency | priority, open_inquiry, report, anpi, ops_watch | support, ai_ops, anpi, talk |
| **Builder** | `collectFromBuilder`, `collectBuilderAlerts` | builderPending, builderRejections, builderRevenue | builder | builder |
| **Platform** | `collectFromMarket`, `collectFromContentGate`, moderation queue counts | marketOrderCreated, marketRefundRequested, pendingReviewCount | — | market, content_gate |
| **Stripe / Connect** | `collectFromConnect`, connect hub, stripe tickets, revenue metrics | connectApplications, connectFailures, paymentCount, refundAmount | connect | connect |
| **TLV** | `collectTlvStub()` | tlvOpsConnected=0 | — | — |
| **AI利用状況** | `collectAiUsageSummary()` | todayCount, bySurface, fallbackRate | — | — |

**横断:** `buildPriorityRows` · `buildActionBoard` → `priorities[]`  
**差分:** `compareKpiWithPrevious` + inbox ID diff

---

## 変更予定ファイル

| ファイル | 変更内容 |
| --- | --- |
| `admin-ai-secretary-ops-context.js` | **新規** — Builder 本体 |
| `admin-ai-secretary-ops-context-sanitize.js` | **新規** — PII マスク（または ops-context 内 private） |
| `admin-ai-secretary-phase2.js` | `requestAssistantReply` で context 合成 · snapshot 保持 |
| `admin-operations-dashboard.html` | script タグ追加（adapter / phase2 の前後） |
| `talk-ops-room.html` | 同上（秘書 chat がある場合） |
| `scripts/test-secretary-ops-context-builder-unit.mjs` | **新規** |
| `scripts/test-secretary-ops-context-intent.mjs` | **新規** |
| `scripts/test-secretary-deepseek-adapter-browser.mjs` | context 付与アサーション追加 |
| `scripts/test-admin-ai-secretary-text-chat-browser.mjs` | 回帰 |
| `docs/AI/SECRETARY_AI.md` | Phase 2 OpsContext 節 |
| `reports/secretary-ops-context-builder-design.md` | 本書 |

---

## 新規予定ファイル

- `admin-ai-secretary-ops-context.js`
- `admin-ai-secretary-ops-context-sanitize.js`（分割する場合）
- `scripts/test-secretary-ops-context-builder-unit.mjs`
- `scripts/test-secretary-ops-context-intent.mjs`
- `scripts/test-secretary-ops-context-inbox-diff.mjs`
- `scripts/fixtures/secretary-ops-context-seed.json`

---

## 触らないファイル

| ファイル / 領域 | 理由 |
| --- | --- |
| `ai-model-gateway.js` | AD-005 |
| `admin-ai-secretary-deepseek-adapter.js`（公開 API） | Phase 1 契約維持 |
| `deploy/cloudflare/functions/api/secretary-deepseek-chat.js` | systemPrompt 追記で足りる |
| `deploy/cloudflare/functions/_shared/secretary-deepseek.mjs` | 同上 |
| `ops-watch-analyzer.js` | 別 surface |
| `talk-ops-assistant.js`（`parseTalkOpsCommand`） | regex 専用 · 役割分担 |
| Builder AI / TASFUL AI / Site Assistant 全般 | スコープ外 |
| `live/**` TLV 本体 | FEATURE FROZEN · stub のみ |
| Gateway 経由 Edge functions | AD-010 |

---

## Go / No-Go 判定

### 設計レビュー（本書）

| 条件 | 判定 |
| --- | --- |
| Phase 1 DeepSeek 接続完了 | **Go**（Adapter + CF Function 実装済 · 本番 Secret は ops 待ち） |
| 既存 collector 再利用可能 | **Go** |
| PII / budget 方針明確 | **Go** |
| Adapter / Gateway 非変更で実装可能 | **Go** |
| TLV 実データ | **No-Go（Phase 2）** — stub のみ · Phase 3 へ |

### Phase 2 実装開始

| 条件 | 判定 |
| --- | --- |
| Phase 1 コミット + 選別ステージング | **推奨**（未完了でも parallel 可） |
| 実 DeepSeek ローカル疎通 | **推奨**（context 付き prompt の目視確認） |
| RELEASE FROZEN 例外 | **P0 Critical 扱い** — OpsContext は「本番接続の一部」として AD-010 秘書 P0 に含める |

### Phase 2 本番 deploy

| 条件 | 判定 |
| --- | --- |
| T1–T6 自動テスト PASS | **必須** |
| T7 手動 · PII 監査 PASS | **必須** |
| `DEEPSEEK_API_KEY` CF Encrypted + redeploy | **必須** |
| KPI / inbox diff が空の環境での graceful 応答 | **必須** |

**総合:** 設計 **Go** · Phase 2 実装 **条件付き Go** · TLV 実連携は **Phase 3 No-Go（本 Phase 対象外）**

---

## 関連

- `reports/secretary-deepseek-adapter-phase1.md`
- `reports/secretary-deepseek-adapter-design.md` §4.2「DB コンテキスト注入は Phase 2」
- `docs/DECISIONS.md` AD-010 · AD-004
- `docs/AI/SECRETARY_AI.md` — AI は取得済みデータの要約に限定
