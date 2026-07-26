# TASFUL CHANGELOG（正本サマリー）

**形式:** 正本 `docs/` 用の要約。詳細は `reports/` と git log。

---

## [Unreleased]

### Added

- Phase 3 TASFUL October RC 総合監査 — **RELEASE BLOCKED** — [tasful-phase3-release-candidate-audit.md](../reports/tasful-phase3-release-candidate-audit.md) · HEAD `c6a4f03`
- Platform AI ページ生成（product/skill/job/worker）— Phase 1〜2-E · **RELEASE READY WITH FOLLOW-UP** — [platform-ai-page-gen-phase2e-release-verification.md](../reports/platform-ai-page-gen-phase2e-release-verification.md) · HEAD `57952cd`
- `docs/` 正本ドキュメントセット（PROJECT_STATUS · TODO · ROADMAP · DECISIONS · AI/* 等）
- 商用前整理棚卸し — [commercial-prep-inventory-2026-07.md](./commercial-prep-inventory-2026-07.md)
- dotenv 系の Pages dist 混入防止（gitignore · ビルド除外 · dist 事後検査）— Git 履歴への混入なし（KI-016）

### Changed

- ステータス正本を現在HEAD `d0ed090` へ同期（Step 2a）— Calendar Hub Primary 完了 · 開発優先の再配置 · working tree 固定件数の廃止
- TASFUL AI 表記を **Production Ready Go** に統一（根拠: [tasful-ai-production-ready-verification.md](../reports/tasful-ai-production-ready-verification.md)）
- `docs/AI/PLATFORM_AI.md` — AIページ生成リリース判定を追記（2026-07-26）

### Pending

- Phase 3 RC 解除: REL-P0-01/04 · API JWT（secretary / zego / live-proxy）· AI Workspace categories · その後 prod alias
- Platform AI ページ生成の Production Deploy（Functions → Pages · schema 手動確認）
- 投稿画面「下書き生成」と「AIでページを作成」の文言整理（P3）
- working tree の領域別分割コミット（大量差分 · 分類済）
- Builder AI P2-C
- Platform Featured / favorites DB / Google OAuth E2E
- REL-P0-04 prod alias deploy
- Business Directory Commercial Launch（Conditional · Human OB / Stripe Live 残）
- `docs/` ステータス正本の git コミット（本 Unreleased）

---

## 2026-06-26 — AI 選別コミット `5ed9672`

**ブランチ:** `cf-pages-deploy`  
**メッセージ:** `feat(ai): Builder AI, Platform finish, TASFUL AI final, and AI terms`

### Added / Updated

| 領域 | 内容 |
| --- | --- |
| **AI 規約** | `ai-terms.html`, `ai-disclaimer.html`, `common-ai-disclaimer.*`, Builder guidelines |
| **Builder AI** | `builder/builder-ai-*`（24 actions · practice · search · tax · calculators · draft store · JWT resolver） |
| **Platform** | バッジ · お気に入りフォルダ · search/compare hub · Google OAuth コード · listing 配線 |
| **TASFUL AI Final** | 履歴 · 動画/音楽/資料生成 · カテゴリ UI · 音声 · TLV source |
| **TLV 入口** | `live/tlv-tasful-ai-entry.js` |
| **テスト** | 10 本の Node 回帰スクリプト |
| **dist** | 上記の `deploy/cloudflare/dist` ミラー（80 件） |

### Tests

- 373/373 PASS（7 スイート）— `reports/pre-commit-final-check.md`

### Excluded（意図的）

- `ai-model-gateway.js`
- `package.json`
- `supabase/functions/_shared/ai-attachments.ts`
- ANPI · Live（TLV 入口除く）· admin-ai-secretary · probes

**参照:** `reports/ai-selected-staging-result.md`

---

## 2026-06-26 — Builder v1.0 Production Ready

- Builder RELEASE FROZEN — `reports/builder-release-status.md`

## 2026-06-25 — TLV v1.0 Production Ready

- TLV FEATURE FROZEN — `reports/tlv-release-status.md`

## 2026-06-17 — AI 秘書 / Builder デモ MVP 等

- AI 運営秘書 RELEASE FROZEN — `reports/ai-ops-secretary-release-status.md`

---

## 更新ルール

1. 領域コミット後 — 本ファイルに日付 + ハッシュ + テスト結果
2. Production Ready 宣言 — `PROJECT_STATUS.md` と同期
3. 推測エントリ禁止 — コミットまたはレポート根拠必須
