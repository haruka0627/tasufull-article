# Builder 一般案件 — Production 環境フラグ（RL-04）

**対象:** Cloudflare Pages ビルド · ランタイム  
**Phase:** 2（コード実装済み · Dashboard 設定は人間作業）  
**Production DB 変更:** なし

**凍結（2026-07-05）:** **Cloudflare Production deploy（`TASU_BUILDER_*` 有効化）は 2026年10月リリース直前まで実行しない。** 正本: [builder-general-jobs-production-freeze-oct2026.md](./builder-general-jobs-production-freeze-oct2026.md)

---

## 1. 正式な環境変数名

### Cloudflare Pages — 共通（Preview / Production それぞれに設定）

| 変数 | 必須 | Preview（推奨値） | Production（ローンチ時） | 役割 |
| --- | --- | --- | --- | --- |
| `TASFUL_SUPABASE_URL` | ✅ | `https://ahlxuyvhzqdqaojiywmu.supabase.co` | `https://ddojquacsyqesrjhcvmn.supabase.co` | `chat-supabase-config.js` 生成 |
| `TASFUL_SUPABASE_ANON_KEY` | ✅ | Staging anon public | Production anon public | 同上 · **service_role 禁止** |
| `TASU_BUILDER_STORAGE_MODE` | ローンチ時 ✅ | `supabase`（検証時） | `supabase` | Repository バックエンド |
| `TASU_BUILDER_GENERAL_JOBS_REPO` | ローンチ時 ✅ | `true`（検証時） | `true` | 一般案件 dual-write primary |
| `NODE_VERSION` | 推奨 | `20` | `20` | ビルド安定 |

**コード正本:**

- `builder/builder-config.js` — ランタイム判定
- `builder/builder-general-jobs-deploy-flags.js` — **ビルド生成物**（dist のみ · git 追跡なし）
- `builder/builder-general-jobs-staging-flags.js` — Staging ref 検出時の開発用フォールバック
- `scripts/lib/builder-deploy-flags.mjs` — env 解決 · Preview/Production 整合チェック
- `deploy/cloudflare/stage-cloudflare-pages.mjs` — 注入オーケストレーション

---

## 2. Preview / Production 分離

| Cloudflare 環境 | ブランチ例 | Supabase ref | Builder フラグ |
| --- | --- | --- | --- |
| **Preview** | PR / 非 `cf-pages-deploy` | **Staging** `ahlxuyvhzqdqaojiywmu` | env 明示 or 未設定（Staging 自動 ON 可） |
| **Production** | `cf-pages-deploy` | **Production** `ddojquacsyqesrjhcvmn` | env **明示必須**（`true` / `supabase`） |
| **ローカル 8788** | — | 現状維持（`.env.staging` 等） | `staging-flags.js` + 任意 build env |

**ビルド時ガード（`stage-cloudflare-pages.mjs`）:**

- Preview ビルド + Production Supabase URL → **ビルド失敗**
- Production ビルド + Staging Supabase URL → **ビルド失敗**

詳細: `docs/supabase-environments.md` §3

---

## 3. 挙動

| 条件 | 結果 |
| --- | --- |
| フラグ未設定 + Staging URL（ローカル / Preview） | `staging-flags.js` が `supabase` + `repo=true` を自動設定 |
| フラグ未設定 + Production URL | Repository **OFF**（安全デフォルト） |
| `TASU_BUILDER_STORAGE_MODE=local` | MVP localStorage 正本 |
| `TASU_BUILDER_GENERAL_JOBS_REPO=false` | Supabase 経路 OFF · MVP のみ |
| `STORAGE_MODE=supabase` + `GENERAL_JOBS_REPO=true` + 認証済み | Supabase primary · MVP mirror |

**判定（`TasuBuilderConfig`）:**

```text
isGeneralJobsRepositoryEnabled()
  = getStorageMode() === "supabase"
  AND Supabase URL/anon 設定済み
  AND TASU_BUILDER_GENERAL_JOBS_REPO === true（明示のみ）
```

---

## 4. Cloudflare Dashboard 設定手順（人間 · Deploy 前）

### 4.1 Preview 環境

1. Settings → Environment variables → **Preview**
2. `TASFUL_SUPABASE_URL` = Staging URL
3. `TASFUL_SUPABASE_ANON_KEY` = Staging anon
4. （任意）`TASU_BUILDER_STORAGE_MODE=supabase` · `TASU_BUILDER_GENERAL_JOBS_REPO=true`

### 4.2 Production 環境（**10月リリース直前まで保留 · 現時点実行禁止**）

1. Settings → Environment variables → **Production**
2. `TASFUL_SUPABASE_URL` = Production URL
3. `TASFUL_SUPABASE_ANON_KEY` = Production anon
4. `TASU_BUILDER_STORAGE_MODE=supabase`
5. `TASU_BUILDER_GENERAL_JOBS_REPO=true`
6. Build: `npm run build:pages` → deploy（**人間が実行**）

**禁止:** Production anon を Preview に設定 · Staging ref を Production に混在

---

## 5. ロールバック（アプリのみ · 即時）

Cloudflare Production 環境変数を変更して **再ビルド・再デプロイ**（人間作業）:

| 変数 | ロールバック値 | 効果 |
| --- | --- | --- |
| `TASU_BUILDER_GENERAL_JOBS_REPO` | `false` | Supabase Repository OFF · MVP fallback |
| `TASU_BUILDER_STORAGE_MODE` | `local` | 全 Repository local 正本 |

**生成される dist（参考）:**

```javascript
global.TASU_BUILDER_GENERAL_JOBS_REPO = false;
global.TASU_BUILDER_STORAGE_MODE = "local";
```

local fallback は常に維持（P0〜P3 契約）。DB / RLS ロールバックは `docs/builder-general-jobs-production-migration-runbook.md` §4。

---

## 6. 検証（ローカル · Production 接続禁止）

```bash
# Phase 2 フラグ注入
node scripts/verify-builder-general-jobs-deploy-flags.mjs

# 既存回帰
npm run build:pages
npm run dev
node scripts/test-builder-general-jobs-launch-smoke.mjs
```

**手動確認（8788）:**

```javascript
// board-projects.html 等
TasuBuilderConfig.getStorageMode();           // "supabase" or "local"
TasuBuilderConfig.isGeneralJobsRepositoryEnabled(); // true / false
TASU_BUILDER_DEPLOY_FLAGS_META;             // ビルド tier 情報
```

---

## 7. 関連

| ドキュメント | 内容 |
| --- | --- |
| `docs/supabase-environments.md` | Staging / Production ref 正本 |
| `docs/builder-general-jobs-production-migration-runbook.md` | RL-05 DB 適用 |
| `reports/builder-general-jobs-production-ready-final.md` | Production Ready チェックリスト |
| `docs/builder-general-jobs-production-freeze-oct2026.md` | 10月リリースまで凍結正本 |
| `reports/builder-general-jobs-october-release-checklist.md` | 10月リリース実行チェックリスト |
