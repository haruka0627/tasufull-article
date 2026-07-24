# TASFUL リリース前スナップショット

**最終更新:** 2026-07-25（Step 2a · 現在HEAD `d0ed090`）  
**用途:** リリース前に「何が完成していて、何が残っているか」を **1 枚** で把握する。  
**正本:** 詳細ステータスは [PROJECT_STATUS.md](./PROJECT_STATUS.md) · 次タスクは [TODO.md](./TODO.md) · 決定は [DECISIONS.md](./DECISIONS.md)。

---

## 一覧サマリー

| 領域 | 完成度 | 状態 | 主な残タスク |
| --- | --- | --- | --- |
| **TASFUL AI** | 機能 + P1 · **Production Ready Go** | 🔄 運用監視残 | Media flake（KI-014）· Membership=Future |
| **Builder** | v1.0 + Talk Review · Calendar Hub Primary **Go** | 🔒 **FROZEN**（一般案件 Production は10月） | working tree 整理 · 10月 Production 適用 |
| **Platform** | NB-1M + **→Talk 連携 Review PASS** | 🔒 **Production Ready · FROZEN** | featured バッジ · favorites DB · OAuth E2E · fee-pay `talkDev` P2 |
| **TASFUL Talk** | コア + Platform/Builder 連携 Review | 🔒 **Production Ready · FROZEN** | 未読 badge seed（保留） |
| **Business Directory** | MVP-1 + DB prod apply · Launch 準備コミット一部あり | 🔄 **DB Go · Launch Conditional** | Human OB / Stripe Live / OB8 · [checklist](../reports/business-directory-commercial-launch-checklist.md) |
| **TLV** | v1.0 静的 + Payment backend | ⏸ **FROZEN · Live UI No-Go** | REL-P0-02 · Live UI 接続 · stub 廃止 |

**凡例:** 🔒 凍結（Critical/Security/仕様追従のみ） · 🔄 機能完成だが本番/運用タスク残 · ⏸ 開発 Pause

---

## TASFUL AI Workspace

| 項目 | 状態 |
| --- | --- |
| **機能** | チャット · Voice · Vision · Media · Monitoring · 課金 enforcement Phase 1–2 |
| **Production Ready** | **Go**（2026-06-28）— [verification](../reports/tasful-ai-production-ready-verification.md) · CF Access E2E · formal build · prod alias |
| **Gateway** | `ai-model-gateway.js` 契約凍結（AD-005） |

**完成済み（代表）**

- Workspace UI · Gateway ルーティング · Brave Web Search Phase 1
- Edge: attachments · media generate · quota enforcement
- `node scripts/test-tasful-ai-final-phase.mjs` — 31/31

**残タスク**

| 優先 | 内容 | 扱い |
| --- | --- | --- |
| P1 | Monitoring Media smoke Gemini 503 flake | [KNOWN_ISSUES](./KNOWN_ISSUES.md) KI-014 · 監視継続 |
| Future | AI Membership 価格・SKU | REL-F-04 · 実装禁止 |
| Future | Vision/ Voice 品質 P3+ | [ROADMAP](./ROADMAP.md) |

---

## Builder

| 項目 | 状態 |
| --- | --- |
| **製品** | v1.0 **Production Ready · RELEASE FROZEN** |
| **Talk 連携 Review** | **PASS 完了**（2026-07-03） |

**完成済み（Talk Review）**

| フロー | threadKind | 出力 |
| --- | --- | --- |
| 一般案件 | `partner_user` | `reports/ui-review/builder-general/` |
| ワーカー検索 | `worker_contact` | `reports/ui-review/builder-worker-search/` |
| 業者検索 | `vendor_contact` | `reports/ui-review/builder-vendor-search/` |

**完成済み（その他）**

- 条件検索 P0/P1 · Builder AI（TASFUL AI 非統合 · AD-002）
- **Builder Calendar Hub Primary（Hub Primary）完了** — [hub-primary-completion](./builder-calendar-hub-primary-completion.md)
- `node scripts/check-builder-production-ready.mjs`

**残タスク / 保留**

| 優先 | 内容 | 扱い |
| --- | --- | --- |
| P0 | 一般案件 **10月** Production 適用 | Staging Go · Production 凍結 · [october checklist](../reports/builder-general-jobs-october-release-checklist.md) |
| 保留 | 開示前 badge HTML 初期値「受諾済み」 | diagnostics のみ · UI 非表示 · 機能影響なし |
| P2 | 条件検索 P2 LLM 自然文 | Future · REL-F-07 |
| P1 | Builder AI P2-C staging | REL-P1-03 · 本番 FROZEN |
| 設計 | Monetization / Provider Listing | Draft のみ |

---

## Platform

| 項目 | 状態 |
| --- | --- |
| **製品** | **Production Ready · FROZEN** |
| **Platform → TASFUL Talk** | **PASS 完了**（2026-07-04 記録） |

**完成済み（Platform → Talk Review · 2026-07-03）**

- 求人案件 `job_demo_full_001` → 応募者確認 → **550円** → Talk ルーム（`job_hire`）
- threadId / roomId 同期 · 掲載者 `u_job_demo_full` / 応募者 `u_hiro`
- 双方向通常チャット · 応募通知 · Builder workflow UI **非表示**
- 検証: `node scripts/capture-platform-job-talk-ui-review.mjs` · `node scripts/check-platform-talk-flow-headed.mjs --manual-review-flow --viewport=1280`
- 出力: `reports/ui-review/platform-talk/` · `reports/manual-review/platform-talk/`

**完成済み（その他）**

- NB-1M スモーク · Content Gate · Platform Live Phase 5 Complete
- Platform AI = TASFUL AI 入口のみ（AD-003）

**残タスク**

| 優先 | 内容 | 扱い |
| --- | --- | --- |
| P1 | index featured バッジ | REL-P1-02 |
| P1 | お気に入り Supabase 同期 | REL-P1-02 |
| P1 | Google OAuth 実機 E2E | REL-P1-02 |
| **P2** | **`data-job-app-proceed` 遷移時に `talkDev=1` を URL に付与** | Review スクリプト側は対応済み · 製品恒久対応 |
| — | Wrangler `.html` 除去 | Review スクリプト対応済み · **製品バグではない** |

---

## TASFUL Talk

| 項目 | 状態 |
| --- | --- |
| **コア** | **Production Ready · RELEASE FROZEN**（`reports/talk-release-status.md`） |
| **Platform 求人連携** | **Review PASS**（上記 Platform 節） |
| **Builder 連携** | **Review PASS**（一般 / worker / vendor contact） |

**完成済み（代表）**

- talk-home · chat-detail · 通知 9 種 · Connect · 安否導線
- `scripts/review-talk-user-flow.mjs` — FAIL 0（2026-06-16 基準）
- Platform 求人: 550円 → Talk → 双方向チャット（8788 Review PASS）

**残タスク / 保留**

| 優先 | 内容 | 扱い |
| --- | --- | --- |
| 保留 | 未読 badge（デモ seed 既読） | 必要なら seed に `is-unread` 付与 · **現時点保留** |
| P2 | Platform fee-pay 製品側 `talkDev=1` | Platform 節 P2 と同一 |
| — | カレンダー通知 WARNING 1 | talk-p1-triage · リリース後改善 |

---

## Business Directory

| 項目 | 状態 |
| --- | --- |
| **MVP-1** | Self-Service · 審査 · 公開 · 検索 · Stripe Test — **Complete** |
| **DB** | **Production Ready Go**（2026-07-01 controlled apply） |
| **Commercial Launch** | **Conditional — No-Go** |

**完成済み**

- Owner / Admin / Public UI · Phase 6 Stripe Test · Production DB migrations 適用済
- `reports/business-directory-production-controlled-apply-result.md`
- HEAD 以降の Launch 準備（完了扱いしない）: public Supabase config · owner onboarding guidance · legal clarify · OB4 runbook/smoke · OB7 contact links

**残タスク**

| 優先 | 内容 |
| --- | --- |
| P1 | Human OB / Stripe Live / OB8 明示 Go — [commercial-launch-checklist](../reports/business-directory-commercial-launch-checklist.md)（Launch **Conditional** 維持） |
| P1 | Portal 解約 E2E · Dashboard 目視残（checklist 記載どおり） |
| Future | MVP-2（公開後編集 · Pro TLV · 問い合わせ） |

---

## TLV Live

| 項目 | 状態 |
| --- | --- |
| **v1.0 静的** | **FROZEN** — watch / studio / creator-dashboard 導線 |
| **Payment Engine backend** | Step 0–5 prod 適用 · Edge v4 — **Go** |
| **Live UI ↔ Payment** | **未接続 · Production No-Go** |
| **開発** | **Pause**（TLV 固有 Phase 2 禁止 · AD-004） |

**完成済み**

- T1/T2/T4 導線整理 · `npm run verify:tlv-finish-main-flow-smoke`
- Platform Live ZEGO Phase 5 · Phase 1 adapter 77 tests PASS

**残タスク（ブロッカー代表）**

| 優先 | 内容 |
| --- | --- |
| P0 | **REL-P0-02** Payment Runbook（Backup · Stripe webhook · Go Approval） |
| P0 | Live UI 接続（`stream_id` · stub 廃止 · tip/coin UI） |
| P0 | Staging TLV env 整備 |
| — | **REL-P0-04** dist git 同期済 · **prod alias 未 deploy** |

---

## 横断 — リリース前 P0（全製品）

| ID | 内容 | 状態 |
| --- | --- | --- |
| **REL-P0-01** | working tree / dist 選別ステージング | 部分 — 領域別分類済 · 分割コミット予定（調査時点の概数は [PROJECT_STATUS](./PROJECT_STATUS.md)） |
| **REL-P0-02** | TLV Payment 運用ゲート | **Paused** — Runbook のみ |
| **REL-P0-03** | AI 秘書 DeepSeek prod smoke | No-Go |
| **REL-P0-04** | Pages dist 本番反映 | **dist git 同期済**（`6d323dd`）· **prod alias 未 deploy** |

---

## Breaking Change 依存調査（2026-07-04）

| 項目 | 状態 |
| --- | --- |
| **スキャン** | **PASS** — P0 blocker **0** · 追加修正・追加コミット **不要** |
| **証跡** | [breaking-change-dependency-scan-2026-07-04.md](../reports/breaking-change-dependency-scan-2026-07-04.md) · `.json`（reports バンドルは未コミット可） |

**クリア（HIT ゼロ or 保護済）:** GitHub Models / Azure Inference · Assistants API · `v1/prompts` · Cloudflare Sandbox SDK · `DOCKER_CONTENT_TRUST` · DeepSeek 旧モデル ID（`resolveDeepSeekModel` で `deepseek-v4-flash` へ正規化済 · 廃止 2026-07-24）

**残る要確認（Dashboard 目視のみ · コード変更不要）**

| ID | 内容 | 即時本番影響 |
| --- | --- | --- |
| **BC-P0-PG** | Supabase Production (`ddojquacsyqesrjhcvmn`) / Staging (`ahlxuyvhzqdqaojiywmu`) の **Postgres major version** | 不明 — Dashboard 確認後に記録 |
| **BC-P0-DS-ENV** | Cloudflare Pages env の `DEEPSEEK_CHAT_MODEL` 現行値 | **なし** — 旧 ID でも runtime 正規化 |

---

## 検証コマンド（リリース前代表）

```bash
npm run build:pages
npm run dev   # http://127.0.0.1:8788

# TASFUL AI
node scripts/test-tasful-ai-final-phase.mjs

# Builder
node scripts/check-builder-production-ready.mjs

# Platform → Talk（2026-07-03 PASS）
node scripts/capture-platform-job-talk-ui-review.mjs
node scripts/check-platform-talk-flow-headed.mjs --manual-review-flow --viewport=1280

# Builder → Talk（2026-07-03 PASS）
node scripts/capture-builder-vendor-search-ui-review.mjs

# TLV 導線
npm run verify:tlv-finish-main-flow-smoke
```

---

## 関連ドキュメント

- [PROJECT_STATUS.md](./PROJECT_STATUS.md) — 製品別ステータス正本
- [TODO.md](./TODO.md) — 次タスク · REL-P0/P1 詳細
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) — 領域別 Go/No-Go チェック
- [review-mode.md](./review-mode.md) — Review Mode 手順
