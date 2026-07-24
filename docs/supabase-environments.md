# Supabase 環境 — Production / Staging 正本

**最終更新:** 2026-07-01  
**目的:** Production と Staging の Supabase プロジェクトを物理分離し、誤 link · 誤 deploy · 誤 migration を防ぐ。

| 種別 | 正本 |
| --- | --- |
| **人間向け** | 本ファイル |
| **機械可読** | [reports/tasful-supabase-staging-project-manifest.json](../reports/tasful-supabase-staging-project-manifest.json) |
| **構築計画** | [reports/tasful-supabase-staging-project-plan.md](../reports/tasful-supabase-staging-project-plan.md) |

---

## 1. プロジェクト一覧

| 環境 | Name（推奨） | Project Ref | URL | 用途 |
| --- | --- | --- | --- | --- |
| **Production** | `tasful-ai` | `ddojquacsyqesrjhcvmn` | `https://ddojquacsyqesrjhcvmn.supabase.co` | 本番データ · Cloudflare Pages Production · リリース窓のみ変更 |
| **Staging** | `tasful-staging` | `ahlxuyvhzqdqaojiywmu` | `https://ahlxuyvhzqdqaojiywmu.supabase.co` | migration リハーサル · Edge 試験 · Preview / ローカル 8788 デフォルト |

**Supabase プラン:** 各 Free（org あたり最大 2 プロジェクト · PITR なし）

**禁止:**

- Staging 作業中に Production ref へ `supabase link` したまま migration / remote SQL
- Production anon / service_role を Preview / `.env.staging` に設定
- Production ユーザーデータの Staging への dump 復元

---

## 2. 環境変数 — 一覧と保存場所

### 2.1 ビルド · ブラウザ（anon のみ）

| 変数 | Production | Staging | 保存場所 |
| --- | --- | --- | --- |
| `TASFUL_SUPABASE_URL` | `https://ddojquacsyqesrjhcvmn.supabase.co` | `https://ahlxuyvhzqdqaojiywmu.supabase.co` | Cloudflare Pages env · ローカル build 前 |
| `TASFUL_SUPABASE_ANON_KEY` | Production anon public | Staging anon public | 同上 |

**生成物:** `npm run build:pages` → `deploy/cloudflare/stage-cloudflare-pages.mjs` が `deploy/cloudflare/dist/chat-supabase-config.js` を生成。

### 2.2 CLI · スクリプト（ローカル · gitignore）

| 変数 | Production 例 | Staging 例 | ファイル |
| --- | --- | --- | --- |
| `SUPABASE_PROJECT_REF` | `ddojquacsyqesrjhcvmn` | `ahlxuyvhzqdqaojiywmu` | `.env` / `.env.staging` |
| `SUPABASE_URL` | Production URL | Staging URL | 同上 |
| `SUPABASE_ANON_KEY` | Production anon | Staging anon | 同上 |
| `SUPABASE_SERVICE_ROLE_KEY` | Production service_role | Staging service_role | **ローカルのみ · Edge secrets · コミット禁止** |
| `BD_PRODUCTION_PROJECT_REF` | `ddojquacsyqesrjhcvmn` | 同上（ガード用定数） | `.env` · `.env.staging` |
| `SUPABASE_STAGING_PROJECT_REF` | — | `ahlxuyvhzqdqaojiywmu`（任意 · manifest 既定あり） | `.env.staging` |
| `AUTH_HOOK_L2_ALLOWLIST_PASSWORD` | L7 テスト用 | Staging Auth 用（別パスワード推奨） | `.env` / `.env.staging` |

**テンプレート:**

| ファイル | 用途 |
| --- | --- |
| [.env.example](../.env.example) | Production / 共通 |
| [.env.staging.example](../.env.staging.example) | Staging 専用 |

### 2.3 Edge Functions secrets（Dashboard / `supabase secrets set`）

| Secret | Production | Staging |
| --- | --- | --- |
| `SITE_URL` | `https://tasufull-article.pages.dev` | Preview URL または `http://127.0.0.1:8788` |
| `STRIPE_SECRET_KEY` | Live（Launch 後） | **Test mode のみ** |
| `STRIPE_WEBHOOK_SECRET` | Production endpoint | Staging 専用 endpoint |
| `GEMINI_API_KEY` 等 | 本番 quota 注意 | Staging 専用 or 共有（要判断） |

---

## 3. Cloudflare Pages — 環境変数

**プロジェクト:** `tasufull-article` · 出力 `deploy/cloudflare/dist`

### 3.1 Production（branch: `cf-pages-deploy` / Production 環境）

| 変数 | 必須 | 値 | 備考 |
| --- | --- | --- | --- |
| `TASFUL_SUPABASE_URL` | ✅ | `https://ddojquacsyqesrjhcvmn.supabase.co` | Encrypted |
| `TASFUL_SUPABASE_ANON_KEY` | ✅ | Production anon public | **service_role 禁止** |
| `TASU_BUILDER_STORAGE_MODE` | ローンチ時 ✅ | `supabase` | `builder-general-jobs-deploy-flags.js` 注入 · **2026年10月リリース直前まで Production deploy 保留** |
| `TASU_BUILDER_GENERAL_JOBS_REPO` | ローンチ時 ✅ | `true` | 同上 · 未設定時は Repository OFF · **10月まで本番有効化しない** |
| `NODE_VERSION` | 推奨 | `20` | ビルド安定 |

### 3.2 Preview（PR / 非 Production branch）

| 変数 | 必須 | 値 | 備考 |
| --- | --- | --- | --- |
| `TASFUL_SUPABASE_URL` | ✅ | `https://ahlxuyvhzqdqaojiywmu.supabase.co` | **Staging ref** |
| `TASFUL_SUPABASE_ANON_KEY` | ✅ | Staging anon public | Production key **禁止** |
| `TASU_BUILDER_STORAGE_MODE` | 任意 | `supabase` | 未設定時は staging-flags 自動 ON 可 |
| `TASU_BUILDER_GENERAL_JOBS_REPO` | 任意 | `true` | 同上 |
| `NODE_VERSION` | 推奨 | `20` | Production と同じ |

**原則:** Preview ビルドは Staging Supabase のみ。Production DB への誤接続を防ぐ。  
**ビルドガード:** `stage-cloudflare-pages.mjs` が Preview+Production URL / Production+Staging URL の組み合わせでビルドを拒否する。

**Functions binding（Pages dev / 本番 Edge）:** `deploy/cloudflare/.dev.vars` — Supabase service keys は Pages Functions 用 · Staging/Production で別管理。

---

## 4. ローカル 8788 の使い分け

**検証 URL:** [docs/local-dev.md](./local-dev.md) — `http://127.0.0.1:8788/` のみ

### 4.1 デフォルト（Staging 向け · 推奨）

```powershell
Copy-Item .env.staging.example .env.staging
# Dashboard から Staging の anon / service_role を .env.staging に記入

Get-Content .env.staging | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]+)=(.*)$') { Set-Item -Path "env:$($matches[1].Trim())" -Value $matches[2].Trim() }
}
npm run build:pages
npm run dev
```

### 4.2 Production 確認（明示的 · 慎重）

```powershell
$env:TASFUL_SUPABASE_URL = "https://ddojquacsyqesrjhcvmn.supabase.co"
$env:TASFUL_SUPABASE_ANON_KEY = "<production-anon>"
$env:BD_PRODUCTION_PROJECT_REF = "ddojquacsyqesrjhcvmn"
npm run build:pages
npm run dev
```

Production 向け smoke / migration は **別タスク · 承認後** のみ。

---

## 5. CLI link とガード

### 5.1 作業前チェック

```powershell
# 最後に link した ref（gitignore）
Get-Content supabase\.temp\project-ref

# manifest 確認
node -e "import m from './reports/tasful-supabase-staging-project-manifest.json' with { type: 'json' }; console.log(m)"
```

| 作業 | link 先 |
| --- | --- |
| Staging migration リハーサル | `ahlxuyvhzqdqaojiywmu` |
| Production migration（承認後） | `ddojquacsyqesrjhcvmn` |

### 5.2 `BD_PRODUCTION_PROJECT_REF` ガード

**実装:** [scripts/lib/supabase-env.mjs](../scripts/lib/supabase-env.mjs)

| スクリプト種別 | 動作 |
| --- | --- |
| Staging `--remote`（例: `test-business-directory-phase2a-staging-readiness.mjs --remote`） | CLI link が Production ref と一致 → **abort** |
| Production 向け smoke（例: `test-business-directory-phase2a-production-smoke.mjs`） | Production API を直接呼び出し · link 不要 |

**既定 Production ref:** manifest の `production.ref` または env `BD_PRODUCTION_PROJECT_REF=ddojquacsyqesrjhcvmn`

**Staging ref 確認:** manifest `staging.ref` = `ahlxuyvhzqdqaojiywmu`

```powershell
$env:BD_PRODUCTION_PROJECT_REF = "ddojquacsyqesrjhcvmn"
npx supabase link --project-ref ahlxuyvhzqdqaojiywmu
node scripts/test-business-directory-phase2a-staging-readiness.mjs --remote
```

---

## 6. スクリプト · モジュール参照

| モジュール / ファイル | 役割 |
| --- | --- |
| `scripts/lib/supabase-env.mjs` | manifest 読込 · ref 解決 · Staging/Production ガード |
| `scripts/lib/auth-hook-l7-slots.mjs` | L7 allowlist · **現状 Production ref 固定**（Staging ユーザー作成後に Staging 用 ID を別途管理） |
| `reports/tasful-supabase-staging-project-manifest.json` | ref SSOT |
| `deploy/cloudflare/stage-cloudflare-pages.mjs` | `TASFUL_SUPABASE_*` → `chat-supabase-config.js` · `TASU_BUILDER_*` → `builder-general-jobs-deploy-flags.js` |

---

## 7. Business Directory — 環境別 smoke

| コマンド | 接続先 | 前提 |
| --- | --- | --- |
| `node scripts/test-business-directory-phase2a-staging-readiness.mjs` | なし（静的） | — |
| `node scripts/test-business-directory-phase2a-staging-readiness.mjs --remote` | **Staging link** | `BD_PRODUCTION_PROJECT_REF` ガード PASS |
| `node scripts/test-business-directory-phase2a-production-smoke.mjs --skip-stripe` | **Production Edge/API** | Production 変更タスク · 別承認 |

Staging MVP 手順: [tasful-supabase-staging-project-plan.md §12](../reports/tasful-supabase-staging-project-plan.md)

---

## 8. 更新履歴

| 日付 | 変更 |
| --- | --- |
| 2026-07-01 | Staging project 作成 · ref `ahlxuyvhzqdqaojiywmu` 登録 · 本ドキュメント初版 |

**次タスク（本ドキュメントスコープ外）:** Staging link · BD migration chain apply · Staging Edge deploy · Preview env 設定（Dashboard 人手）

---

## Related

- [local-dev.md](./local-dev.md) — 8788 · build
- [business-directory-phase2a-staging-production-separation.md](../reports/business-directory-phase2a-staging-production-separation.md)
- [business-directory-phase2a-production-controlled-migration.md](../reports/business-directory-phase2a-production-controlled-migration.md)
