# TASFUL AI — Architecture SSOT

**最終更新:** 2026-06-30  
**目的:** TASFUL AI Workspace および関連 AI サーフェスを理解する **前提となるアーキテクチャ正本**（本ファイル）。  
**スコープ:** 境界 · surface 分離 · Gateway · データ · 他製品との関係。**本ファイル自体は契約変更 · 実装を含まない。**

---

## 1. 位置づけ

| 項目 | 内容 |
| --- | --- |
| **製品名** | TASFUL AI Workspace |
| **入口** | `ai-workspace.html` |
| **役割** | **総合 AI Workspace** — 一般業務相談 · 生成 · 履歴 · 音声 · メディア |
| **展開方針** | 国内完成優先 · 将来海外対応設計（AD-011） |
| **Production Ready** | **Go**（2026-06-28）— 本番接続完了 · P1 改善タスク残 |
| **正本（製品）** | [AI/TASFUL_AI.md](../AI/TASFUL_AI.md) |

### 1.1 詳細設計への参照

| ドキュメント | 用途 |
| --- | --- |
| [AI/TASFUL_AI.md](../AI/TASFUL_AI.md) | 機能一覧 · 本番接続 · 残タスク |
| [AI/README.md](../AI/README.md) | AI 領域インデックス · Voice Phase 5-D |
| [DECISIONS.md](../DECISIONS.md) | AD-001〜006 · AD-010 · AD-011 · AD-015 |
| [AI/TASFUL_AI_QA.md](../AI/TASFUL_AI_QA.md) | サイト内 QA SSOT（AD-015 · 設計） |
| [AI/AI_MEMBERSHIP_PRICING.md](../AI/AI_MEMBERSHIP_PRICING.md) | 料金 · Fair Use（Draft） |
| [reports/builder-ai-architecture.md](../../reports/builder-ai-architecture.md) | Builder AI 分離設計（**統合しない** 根拠） |

---

## 2. AI サーフェス分離（AD-001）

TASFUL 全体の AI は **別 UI · 別 surface · 別データ境界** で運用する。

```text
                    ┌─────────────────────┐
                    │  TASFUL AI Workspace │  ai-workspace.html
                    │  (総合 AI)           │  TasuAiModelGateway
                    └──────────┬──────────┘
                               │
         source=platform       │       source=tlv
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        Platform 入口      TLV 8テンプレ    一般利用
        (AD-003)           (AD-004)

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Builder AI       │  │ AI 運営秘書       │  │ Site Assistant   │
│ surface=         │  │ DeepSeek 専用     │  │ FAQ / 案内       │
│ builder_ai       │  │ (AD-010)          │  │ Gateway 非接続   │
│ (AD-002 統合禁止)│  │ admin-ops         │  │ 全ページ右下     │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

| Surface | 統合 | Gateway / Provider |
| --- | --- | --- |
| **TASFUL AI** | — | `TasuAiModelGateway` · OpenAI（本番） |
| **Builder AI** | **TASFUL AI と統合しない**（AD-002） | `surface=builder_ai` · OpenAI |
| **AI 秘書** | 独立（AD-010） | DeepSeek · **Gateway 非使用** |
| **Platform** | 専用 LLM なし（AD-003） | `source=platform` リダイレクトのみ |
| **TLV** | 専用 AI なし（AD-004） | `source=tlv` · `tlv-tasful-ai-entry.js` |
| **Site Assistant** | Workspace とは別 | `TasuAiConsultBridge` · deterministic |

---

## 3. 論理アーキテクチャ（TASFUL AI）

```text
Browser (ai-workspace.html + ai-workspace-*.js)
    │
    ├─► TasuAiModelGateway (ai-model-gateway.js)  … AD-005 契約凍結
    │       │
    │       └─► Cloudflare Pages Functions / Edge
    │               ├─ OpenAI (chat · vision · voice)
    │               ├─ Gemini (media generate · 一部)
    │               ├─ Quota / billing enforcement
    │               └─ Web search (Brave 等 · 設定依存)
    │
    ├─► localStorage 履歴 (tasu_ai_history_v1 · max 500)
    │       └─► Future: Supabase 同期（TBD · P2）
    │
    └─► Platform QA 記事 (AD-015)
            platform-qa-article.js · /help/*
            … AI 回答欄と詳細ページで同一コンポーネント
```

**静的配信:** `npm run build:pages` → `deploy/cloudflare/dist`（AD-009）。

---

## 4. Gateway 契約（AD-005）

| 項目 | 内容 |
| --- | --- |
| **正本ファイル** | `ai-model-gateway.js` |
| **方針** | **安易な破壊的変更禁止** — 変更時は ADR 追加 |
| **既知課題** | working tree 未コミット diff 可能性（[KNOWN_ISSUES.md](../KNOWN_ISSUES.md) KI-001） |

Gateway 経由で扱う代表 concern（詳細はソース · AD-005 参照）:

- Model routing / plan 制限
- Streaming / tool orchestration
- Surface 別コンテキスト（`source` · `surface` クエリ）
- Quota · billing hook（Edge 連携）

**本 SSOT では Gateway API の再定義は行わない。**

---

## 5. フロントエンド構成（実装済み · TASFUL_AI.md 準拠）

| 領域 | 主要モジュール |
| --- | --- |
| シェル · チャット | `tasful-general-ai-shell.js`, `ai-workspace-chat.js` |
| 生成 UI | `ai-generate-ui.js` |
| 履歴 | `ai-history-store.js`, `ai-workspace-history-bridge.js`, `ai-workspace-categories.js` |
| メディア生成 | `ai-video-generate.js`, `ai-music-generate.js`, `ai-document-generate.js` |
| 音声 | `tasful-ai-voice-core.js`, `ai-workspace-voice.js` |
| TLV 文脈 | `ai-workspace-tlv-source.js` |
| 規約 · 免責 | `common-ai-disclaimer.*`, `ai-terms.html`（AD-006） |

---

## 6. データ · ストレージ

| データ | 現行 | 将来 |
| --- | --- | --- |
| **チャット履歴** | `localStorage` (`tasu_ai_history_v1`) | Supabase 同期 **TBD**（P2） |
| **添付 · メディア** | クライアント + Edge | 永続化ポリシー **TBD** |
| **課金 · quota** | Edge + Gateway | [AI_MEMBERSHIP_PRICING.md](../AI/AI_MEMBERSHIP_PRICING.md) Draft |
| **QA 記事** | `platform-qa-articles.generated.js` · `/help/*` | AD-015 SSOT |

**exportAll / importAll** で履歴移行可能（TASFUL_AI.md 記載）。

---

## 7. 他製品との境界

### 7.1 Builder AI（AD-002）

- **案件コンテキスト**（Project / Thread / Partner）専用
- TASFUL AI Workspace へ **統合しない**
- 設計詳細: [reports/builder-ai-architecture.md](../../reports/builder-ai-architecture.md)

### 7.2 Platform（AD-003）

- Deterministic assist（検索 · 比較 · バッジ）のみ
- AI 需要は **`ai-workspace.html?source=platform`** へ遷移

### 7.3 TLV（AD-004）

- `live/tlv-tasful-ai-entry.js` → Workspace
- 8 テンプレ · 無料枠 UI（`ai-workspace-tlv-source.js`）

### 7.4 AI 秘書（AD-010）

- `admin-operations-dashboard.html`
- **DeepSeek** 専用 Cloudflare Function
- OPS triage · Gmail — **Gateway 非接続**

### 7.5 Business Directory（AD-013）

- Pro+ **AI おすすめ掲載** は **Future / TBD**
- BD 専用 AI エンジンは **作らない**（TASFUL AI 入口経由を想定）

---

## 8. 出力 · 安全方針（AD-006）

| 原則 | 内容 |
| --- | --- |
| **非確定出力** | 契約 · 請求 · 採用 · 返金等の **自動確定禁止** |
| **表示** | 全 surface 共通 disclaimer · `ai-terms.html` |
| **Platform / TLV** | TASFUL AI 入口経由で QA 契約（AD-015）を共有 |

---

## 9. 本番 · 運用ステータス

| 項目 | 状態（docs 正本） |
| --- | --- |
| Production Ready Go | 2026-06-28 · [reports/tasful-ai-production-ready-verification.md](../../reports/tasful-ai-production-ready-verification.md) |
| 本番 AI API | OpenAI（TASFUL AI · Builder） |
| P1 残 | 課金 enforcement 強化 · 履歴 Supabase 等 — [TASFUL_AI.md](../AI/TASFUL_AI.md) §残タスク |
| 凍結対象外 | TASFUL AI は AD-008 Production Ready 凍結製品 **に含めない**（本番接続タスク残の注記あり） |

---

## 10. サイト内 QA（AD-015）

| 項目 | 内容 |
| --- | --- |
| **SSOT** | QA 記事コンポーネント（`platform-qa-article.js`） |
| **表示** | `/help/<slug>/` 詳細 ≒ AI 回答欄 |
| **データ** | `scripts/lib/platform-qa-catalog-*.mjs` 生成 |
| **実装深度** | TASFUL_AI.md · TODO — 一部 **Backlog / 未着手** と記載あり · **TBD で reconcile** |

---

## 11. Voice · Realtime（参考）

OpenAI Realtime Live — surface 別 feature flag（default OFF）:

| Surface | ページ | フラグ |
| --- | --- | --- |
| TASFUL AI | `ai-workspace.html` | `__TASU_VOICE_LIVE_TASFUL_AI__` |
| Builder AI | `builder/builder-ai.html` | `__TASU_VOICE_LIVE_BUILDER_AI__` |
| AI 秘書 | `admin-operations-dashboard.html` | `__TASU_VOICE_LIVE_OPS_SECRETARY__` |

Platform · TLV は **専用 Voice なし**（AD-003 / AD-004）。  
詳細: [AI/README.md](../AI/README.md) §Voice Core。

---

## 12. Future / TBD

| 項目 | 備考 |
| --- | --- |
| 履歴 Supabase 同期 | P2 · schema TBD |
| AI Membership 最終料金 | Draft · 原価シミュレーション後 |
| 操作アシスタント（Gemini） | Backlog · [tasful-ai-ui-operation-assist-backlog.md](../tasful-ai-ui-operation-assist-backlog.md) |
| PDF/PPT エクスポート | P2 |
| Gateway 契約変更 | Q4 · 別 ADR（AD-005 注記） |
| BD / Platform 深連携 AI | 専用エンジン新設 **禁止**（AD-003） |

---

## 13. 設計 · レビュー時の禁止事項

以下は本アーキテクチャ SSOT 上 **禁止**（AD 根拠付き）:

1. Builder AI を TASFUL AI Workspace に統合（AD-002）
2. Platform / TLV 専用 LLM ループ新設（AD-003 / AD-004）
3. AI 秘書を Gateway 経由に変更（AD-010）
4. `ai-model-gateway.js` の無審査 breaking change（AD-005）
5. 法的 · 金銭的確定を AI 出力から自動実行（AD-006）

---

*本ファイルは Jules / 設計者向け SSOT。Gateway 契約 · Edge 実装の変更は別 ADR · 別タスクで行う。*
