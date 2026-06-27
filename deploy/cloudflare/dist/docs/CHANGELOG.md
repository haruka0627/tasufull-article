# TASFUL CHANGELOG（正本サマリー）

**形式:** 正本 `docs/` 用の要約。詳細は `reports/` と git log。

---

## [Unreleased]

### Added

- `docs/` 正本ドキュメントセット（PROJECT_STATUS · TODO · ROADMAP · DECISIONS · AI/* 等）

### Pending

- working tree 440 件の整理
- TASFUL AI 本番接続
- Builder AI P2-C
- Platform Featured / favorites DB / Google OAuth E2E
- `docs/` 自体の git コミット

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
