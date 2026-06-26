# TASFUL Site Assistant — Backlog

**最終更新:** 2026-06-26  
**Phase 1:** ✅ **実装完了**（commit 予定）  
**Phase 2+:** 📋 未着手（Feedback Launcher · OPS 集約）  
**優先度:** P0/P1 外 · **Phase UI-3 Platform Critical の優先順位に影響しない**

---

## Phase 1 — サイトAIウィジェット（✅ 実装済）

全ページ右下に **「TASFUL サイトAI」** を表示。新規 AI / 新規 API / Gateway 接続は **作らない**。

| 要素 | 方針 |
| --- | --- |
| **UI** | 右下 **丸アイコン**（`fixed` · タップ領域 44px 以上）→ チャットパネル |
| **表示名** | `TASFUL サイトAI` |
| **配置** | **全ページ共通**（`build:pages` で 232 HTML 注入 · 16 スキップ） |
| **回答** | 既存 TASFUL AI **cross-matching / FAQ** を流用 |
| **依存** | `TasuAiConsultBridge.tryCrossSearch` · `TasuAiCrossSearch` · `TasuAiFaqKnowledge` |
| **非接続** | Gateway · DeepSeek · AI 秘書 · Ops Context · 新規外部 API |
| **モード UI** | TASFUL AI の他モード UI は **出さない**（サイトAI のみ） |
| **不明時** | `ai-workspace.html?mode=cross-matching&source=site_assistant` · `/contact` へ誘導 |

### 実装ファイル

| 種別 | パス |
| --- | --- |
| CSS | `tasful-site-assistant.css` |
| UI | `tasful-site-assistant.js` |
| Adapter | `tasful-site-assistant-adapter.js` |
| 注入 | `deploy/cloudflare/stage-cloudflare-pages.mjs` → `applySiteAssistantToDist()` |
| テスト | `scripts/test-tasful-site-assistant-browser.mjs` |

### Context（送信メタのみ）

- `page_url` · `page_title` · `page_heading` · `page_type`（`body[data-page]`）

**禁止:** 個人情報 · localStorage ユーザーデータ · 管理者 / AI 秘書 / Ops / Stripe 内部 Context

### Lazy load（初回パネル open / 送信時）

1. `ai-intent-router.js`
2. `ai-cross-search.js`
3. `ai-faq-knowledge.js`
4. `ai-consult-bridge.js`

### スキップ対象（注入しない）

管理系 · `ai-workspace` · Builder AI · Ops 系 HTML（16 件）

### 検証

```bash
npm run build:pages
node scripts/test-tasful-site-assistant-browser.mjs
```

**報告:** [reports/tasful-site-assistant-phase1.md](../reports/tasful-site-assistant-phase1.md)

---

## Phase 2+ — Feedback Launcher（📋 未着手）

Phase 1 は **サイト案内チャット** のみ。以下は **将来** の拡張（導線ハブ · OPS 集約）。

### 目的

ユーザーが **「問い合わせしたい」「通報したい」「不具合を報告したい」「サイト内で探したい」** と思ったときに、場所が分からず離脱しないようにする。

### 役割分担（混同禁止）

| 製品 / 機能 | 役割 |
| --- | --- |
| **TASFUL AI** | 相談 · 提案 · 専門的な AI 対応 · **操作アシスタント**（Workspace 側） |
| **Site Assistant Phase 1** | 右下 **サイトAI** — cross-search / FAQ · ページ案内 |
| **Site Assistant Phase 2+** | お問い合わせ · **通報** · 不具合 · 要望フォーム · OPS / AI 秘書集約 |
| **操作案内 AI** | [tasful-ai-ui-operation-assist-backlog.md](./tasful-ai-ui-operation-assist-backlog.md) — Site Assistant では実装しない |

### 必須入口（Phase 2 パネル拡張案）

1. **サイト内検索**
2. **お問い合わせ**
3. **通報**
4. **不具合報告**
5. **機能要望**
6. **FAQ**（Phase 1 で cross-search / FAQ 流用済）
7. **TASFUL AI を開く**

### 管理側連携（将来）

送信内容を AI 秘書 / OPS / 管理画面に集約。

| 種別 `type` | 用途 |
| --- | --- |
| `inquiry` | お問い合わせ |
| `report` | 通報 |
| `bug_report` | 不具合報告 |
| `feature_request` | 機能要望 |
| `navigation_help` | ページ案内 |

### Phase 2 実装前の確認事項

- [ ] Phase 1 本番 deploy · smoke
- [ ] 必須7入口のパネル IA 確定
- [ ] フィードバック API / ストアの AD 起票
- [ ] AI 秘書 Inbox との受信スキーマ統一
- [ ] 市場 tabbar との `bottom offset` 仕様
- [ ] 全ページ Playwright（390 / 768 / 1280）

---

## 設計メモ

| ルール | 内容 |
| --- | --- |
| **TASFUL AI と分離** | 埋め込み UI はサイトAI のみ。本格 Workspace は別 URL |
| **Gateway 不要（Phase 1）** | cross-search / FAQ はクライアント既存モジュールのみ |
| **ai-modes.js** | 独自 `site` mode は **追加しない** |
| **プライバシー** | Context はページメタのみ（上記禁止リスト） |

---

## 関連ドキュメント

- [TODO.md](./TODO.md)
- [ROADMAP.md](./ROADMAP.md)
- [AI/TASFUL_AI.md](./AI/TASFUL_AI.md) — cross-matching 流用 · 混同禁止
- [AI/SECRETARY_AI.md](./AI/SECRETARY_AI.md) — Phase 2+ OPS 集約
- [tasful-ai-ui-operation-assist-backlog.md](./tasful-ai-ui-operation-assist-backlog.md)
