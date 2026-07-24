# TASFUL / Business Directory — Supabase Staging Project 構築計画

**日付:** 2026-07-01  
**種別:** 設計 · 手順書（**実施なし**）  
**目的:** Commercial Launch 前に **Production DB** と **Staging DB** を物理分離する  
**Production ref（現状）:** `ddojquacsyqesrjhcvmn`（`tasful-ai`）  
**Staging ref:** `ahlxuyvhzqdqaojiywmu` — 正本 [docs/supabase-environments.md](../docs/supabase-environments.md) · [manifest](./tasful-supabase-staging-project-manifest.json)  
**Supabase プラン:** 当面 **Free × 2 プロジェクト**（Production 既存 + Staging 新規）

**本ドキュメント作成時の禁止（維持）:** Project 作成 · `supabase link` · `db push` · migration · remote SQL · Production 変更 · Edge deploy

**関連:**

- [business-directory-phase2a-staging-production-separation.md](./business-directory-phase2a-staging-production-separation.md) — 分離調査
- [business-directory-phase2a-production-controlled-migration.md](./business-directory-phase2a-production-controlled-migration.md) — Production Option B 実施記録
- [docs/supabase-migration-plan.md](../docs/supabase-migration-plan.md) §17 — 設計上の Staging/Production 分離
- [docs/local-dev.md](../docs/local-dev.md) — 8788 検証 · `TASFUL_SUPABASE_*`

---

## 0. Executive summary

| 項目 | 方針 |
| --- | --- |
| **Production** | `ddojquacsyqesrjhcvmn` — 変更はリリース窓のみ |
| **Staging** | **新規 Free project** — migration リハーサル · E2E · Edge 試験専用 |
| **Cloudflare Pages** | Production branch → Production Supabase · Preview → Staging Supabase |
| **CLI link** | 作業前に ref 目視 · `BD_PRODUCTION_PROJECT_REF=ddojquacsyqesrjhcvmn` ガード |
| **最小 MVP** | **Business Directory スコープ** のみ Staging 再現（§12） |
| **Phase 2a** | 今後の migration は **Staging で Go 後 → Production**（§9） |

---

## 1. 新 Staging Project 作成手順（人手 · Dashboard）

> **今回は実行しない。** Commercial Launch 準備のチェックリストとして記載。

### 1.1 事前確認

| # | 確認 |
| --- | --- |
| 1 | Supabase org に **Free project 枠** が残っている（Free は org あたり **最大 2 プロジェクト**） |
| 2 | Production `ddojquacsyqesrjhcvmn` を **誤って複製しない** |
| 3 | リージョンは Production と **同じ `ap-northeast-1`（Tokyo）** を推奨（latency · 運用習慣） |
| 4 | Free 制約を理解: **PITR なし** · 自動 backup 限定的 · 非アクティブ pause あり |

### 1.2 Dashboard 作成手順

1. [Supabase Dashboard](https://supabase.com/dashboard) → Organization 選択  
2. **New project**  
3. 推奨設定:

| 項目 | 推奨値 |
| --- | --- |
| **Name** | `tasful-staging`（または `tasful-ai-staging`） |
| **Database password** | パスワードマネージャに保存 · CLI link 用 |
| **Region** | `Northeast Asia (Tokyo)` |
| **Pricing** | **Free** |

4. 作成完了後 **Settings → General → Reference ID** をコピー → §2 へ登録  
5. **Settings → API** から **Project URL** · **anon public** · **service_role**（secrets のみ · git 禁止）を控える  
6. **Auth → URL Configuration** — Staging Pages preview URL を後で追加（§8）

### 1.3 作成直後（まだ migration しない）

- [ ] ref を §2 正本に記録  
- [ ] `.env.staging` をローカル作成（gitignore · §3）  
- [ ] `BD_PRODUCTION_PROJECT_REF=ddojquacsyqesrjhcvmn` を開発者 `.env` に設定  
- [ ] Production project を CLI link したまま作業しないよう **link 先を Staging に切替**

---

## 2. Staging Project Ref の登録場所

Staging ref 確定後、**単一正本** + 参照先を更新する。

### 2.1 正本（必須）

| 優先 | ファイル | 内容 |
| --- | --- | --- |
| **1** | **`docs/supabase-environments.md`** | Production / Staging ref · URL · 用途 · 更新日 |
| **2** | **`reports/tasful-supabase-staging-project-manifest.json`** | 機械可読 SSOT |
| **3** | **本ファイル** §0 · §2.2 表 | 計画 · 実施記録 |

> ref 確定までは `<STAGING_REF>` プレースホルダーを使用。  
> **Production ref `ddojquacsyqesrjhcvmn` を Staging 欄に書かない。**

### 2.2 参照・注入（更新対象）

| 場所 | 用途 | Staging 時の値 |
| --- | --- | --- |
| `.env.staging`（gitignore） | ローカル Staging link / スクリプト | `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` |
| `.env.staging.example`（コミット可） | テンプレート · キー名のみ | プレースホルダー |
| Cloudflare Pages **Preview** env | Preview deploy ビルド | `TASFUL_SUPABASE_URL` · `TASFUL_SUPABASE_ANON_KEY` |
| Cloudflare Pages **Production** env | Production deploy | **既存** `ddojquacsyqesrjhcvmn` のまま |
| `scripts/lib/supabase-env.mjs`（**将来**） | `getProductionRef()` / `getStagingRef()` | ハードコード排除 |
| `scripts/lib/auth-hook-l7-slots.mjs` | 現状 `PROJECT_REF` 固定 | **Production 用のまま** · Staging スクリプトは env 優先に分離 |
| `scripts/test-business-directory-*-edge.mjs` | `--remote` | `--project-ref` または env `SUPABASE_PROJECT_REF` |
| `.cursor/mcp/supabase.md` | MCP read-only | Staging 用 MCP は **別エントリ**（Production MCP は維持） |
| `supabase/config.toml` コメント | `config push` 先 | Staging / Production を **コメントで明記**（同ファイル共用 · push 前に ref 確認） |

### 2.3 CLI link のローカル状態

| パス | 内容 |
| --- | --- |
| `supabase/.temp/project-ref` | 最後に link した ref — **gitignore** |
| 作業ルール | Staging 作業前: `Get-Content supabase\.temp\project-ref` = Staging ref |

---

## 3. Production / Staging 環境変数分離方針

### 3.1 原則

```text
Production Pages (branch: main)
  → TASFUL_SUPABASE_* = ddojquacsyqesrjhcvmn

Preview / Staging Pages (branch: * / preview)
  → TASFUL_SUPABASE_* = <STAGING_REF>

Local dev (8788)
  → デフォルト Staging · Production 確認時のみ明示切替
```

**禁止:** Preview ビルドが Production anon key を参照 · Staging migration を Production link で実行

### 3.2 変数一覧

| 変数 | Production | Staging | 保存場所 |
| --- | --- | --- | --- |
| `TASFUL_SUPABASE_URL` | `https://ddojquacsyqesrjhcvmn.supabase.co` | `https://ahlxuyvhzqdqaojiywmu.supabase.co` | CF Pages · build |
| `TASFUL_SUPABASE_ANON_KEY` | Production anon | Staging anon | CF Pages · build |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Staging | **ローカル / Edge secrets のみ** |
| `SUPABASE_PROJECT_REF` | `ddojquacsyqesrjhcvmn` | `ahlxuyvhzqdqaojiywmu` | スクリプト |
| `BD_PRODUCTION_PROJECT_REF` | `ddojquacsyqesrjhcvmn` | 同上（ガード用） | 全 `--remote` 実行環境 |
| `SITE_URL`（Edge secret） | `https://tasufull-article.pages.dev` | Preview URL または `http://127.0.0.1:8788` | Supabase secrets |

### 3.3 Cloudflare Pages

| Environment | Branch / 条件 | Supabase |
| --- | --- | --- |
| **Production** | `main` | Production ref |
| **Preview** | PR / 非 main branch | Staging ref |

**build:** `npm run build:pages` → `deploy/cloudflare/stage-cloudflare-pages.mjs` が `TASFUL_SUPABASE_*` から `chat-supabase-config.js` を生成。

**ローカル 8788:**

```powershell
# Staging 向け build + dev（例）
$env:TASFUL_SUPABASE_URL = "https://<STAGING_REF>.supabase.co"
$env:TASFUL_SUPABASE_ANON_KEY = "<staging-anon>"
npm run build:pages
npm run dev
```

### 3.4 生成物

| ファイル | 注入元 |
| --- | --- |
| `deploy/cloudflare/dist/chat-supabase-config.js` | `TASFUL_SUPABASE_*` at build |
| ルート `chat-supabase-config.js` | ローカル開発用 · **gitignore 推奨** |

---

## 4. migration chain の適用順序

### 4.1 方針

- **正本:** `supabase/migrations/*.sql`（timestamp 順）
- **Production** には既に多数 apply 済（履歴ドリフトあり · [Step1 報告](./business-directory-production-step1-migration.md)）
- **Staging** は **新規 DB** — 初回は **MVP スコープ**（§12）または **フル再現**（§4.3）を選択

**Staging 初回 apply 方法（人手 · 将来）:**

```text
Method A: npx supabase link --project-ref <STAGING_REF> && npx supabase db push
Method B: db query -f（Production と同様 · drift 時）
```

> **本計画では実行しない。**

### 4.2 Business Directory 必須 chain（Commercial Launch / Phase 2a 検証）

| # | Version | File |
| --- | --- | --- |
| 1 | `20260711100000` | `business_directory_phase1_schema.sql` |
| 2 | `20260711100001` | `business_directory_phase1_seed.sql` |
| 3 | `20260712100000` | `business_directory_phase6_stripe_subscription.sql` |
| 4 | `20260715100000` | `business_directory_storage.sql` |
| 5 | `20260715110000` | `business_directory_content_update.sql` |
| 6 | `20260716100000` | `business_directory_ai_draft_usage.sql` |
| 7 | `20260717120000` | `business_directory_page_content_phase2a.sql` |

**Phase 2a 注意:** view 更新は `DROP VIEW IF EXISTS` + `CREATE VIEW` + `GRANT`（Production apply 時に 42P16 教訓 · [controlled migration](./business-directory-phase2a-production-controlled-migration.md)）

### 4.3 Staging フル再現（将来 · TASFUL 全体）

Production と同等 E2E が必要な場合、BD 以外も timestamp 順で apply。主要グループ:

| グループ | 例（version 範囲） | 備考 |
| --- | --- | --- |
| Auth hook / Partner | `20260621150000` … `20260630100001` | JWT claim · L7 slots 前提 |
| Match | `20260621130000` … | 任意 |
| Live P0 / TLV payment | `20260628100000` … `20260628160000` | TLV Staging 検証時 |
| Live videos P1+ | `20260701100000` … | 任意 |
| Secretary Google vault | `20260710100000` | OAuth Staging 時 |
| Business Directory | §4.2 全7本 | **MVP 必須** |

**推奨:** 初回 Staging は **§4.2 + Auth hook 最小** のみ。他領域は必要になったら追加。

### 4.4 `schema_migrations` 整合

- `db query -f` 適用後は `npx supabase migration repair --status applied <version>` を DBA 判断で実施  
- Staging 新規 DB では **`db push` が通れば repair 不要** のことが多い

---

## 5. seed / test user / mock data 方針

### 5.1 原則

| 項目 | Staging | Production |
| --- | --- | --- |
| **本番ユーザーデータ** | **コピー禁止** | 正本 |
| **seed SQL** | repo 内 migration seed のみ | 同左 |
| **テストユーザー** | L7 allowlist 相当を **Staging Auth に再作成** | 既存 `t1`–`t5@tasful.invalid` |
| **mock** | UI mock（`bdMock=1`）は 8788 のみ · Staging E2E は **real Edge** | 本番 mock 禁止 |

### 5.2 Business Directory seed

- `20260711100001_business_directory_phase1_seed.sql` — plan_features · categories（Staging apply 時に自動）

### 5.3 テストユーザー（L7 slots 再現）

正本: `scripts/lib/auth-hook-l7-slots.mjs`

| Slot | Email | 用途 |
| --- | --- | --- |
| T2 | `t2@tasful.invalid` | BD owner E2E |
| T4 | `t4@tasful.invalid` | BD ops / approve |

**Staging 手順（将来）:**

1. Auth → Users で上記を **Staging project に新規作成**（Production パスワードと **別** にしても可）  
2. `app_metadata.role` — T4 に `tasu_admin`  
3. Custom Access Token Hook migration 適用後、`talk_user_id` / `member_id` を slot 定義どおり設定  
4. パスワードは `.env.staging` の `AUTH_HOOK_L2_ALLOWLIST_PASSWORD`（Production と共有可能だが **推奨は Staging 専用**）

### 5.4 mock data

- **DB:** テスト listing は Staging smoke スクリプトが作成 · 定期 cleanup は任意  
- **Stripe:** Test mode のみ · 本番 Customer ID を Staging に持ち込まない  
- **AI draft quota:** Staging 専用 quota テーブル（migration 6）— 乱用防止で低 quota でも可

---

## 6. Edge Functions の Staging deploy 方針

### 6.1 原則

| 項目 | 方針 |
| --- | --- |
| **Production Edge** | `ddojquacsyqesrjhcvmn` — リリース承認後のみ deploy |
| **Staging Edge** | `<STAGING_REF>` — CI / 人手 · **DB migration 後** に deploy |
| **順序** | **Staging DB migration → Staging Edge deploy → Staging E2E** |

### 6.2 Business Directory MVP で deploy する関数

| Function | 必須 | 備考 |
| --- | --- | --- |
| `business-directory` | ✅ | Phase 2 upsert 版 |
| `stripe-webhook` | ✅ | BD subscription · **Test webhook URL は Staging 専用** |

**deploy コマンド（将来 · Staging ref）:**

```powershell
npx supabase secrets set SITE_URL=https://<preview-or-8788-base> --project-ref <STAGING_REF>
npx supabase functions deploy business-directory stripe-webhook `
  --project-ref <STAGING_REF> --no-verify-jwt --use-api --yes
```

### 6.3 Staging secrets（BD MVP）

| Secret | 値 |
| --- | --- |
| `STRIPE_SECRET_KEY` | **Stripe Test** secret |
| `STRIPE_WEBHOOK_SECRET` | Staging endpoint 用（Production と別） |
| `SITE_URL` | Preview / 8788 |
| `BUSINESS_DIRECTORY_STRIPE_PRICE_STANDARD` | Staging bootstrap 作成 |
| `BUSINESS_DIRECTORY_STRIPE_PRICE_PRO` | 同上 |
| `GEMINI_API_KEY` 等 | AI draft 検証時 · Staging 専用 or 共有（quota 注意） |

**bootstrap（将来）:**

```powershell
$env:SUPABASE_PROJECT_REF = "<STAGING_REF>"
node scripts/bootstrap-business-directory-stripe-prices.mjs
```

### 6.4 フル TASFUL Staging（将来）

78 functions 存在 — **一括 deploy しない**。領域ごとに追加:

- Platform / AI: `gemini-chat`, `openai-chat`, `serper-search` 等  
- TLV: `tlv-payment-webhook`, `tlv-create-tip` 等  
- Secretary: `secretary-google-oauth`, `secretary-google-tools`  

`supabase/config.toml` の `verify_jwt` · `[api] schemas`（`tlv` expose）は **Staging ref 向け `config push`** で同期。

---

## 7. Storage bucket の Staging 再現方針

### 7.1 Business Directory

Migration `20260715100000_business_directory_storage.sql`:

| Bucket | public | 用途 |
| --- | --- | --- |
| `business-directory` | yes | listing 写真 `{listing_id}/{uuid}.ext` |

**Staging:** migration 4 で bucket 定義が作成される。Production 画像の **コピーは不要**（E2E は新規 upload）。

### 7.2 その他（必要時）

| Bucket / migration | 領域 |
| --- | --- |
| `20260624100000_match_profile_storage.sql` | Match |
| Builder signed URL | `builder-create-signed-url` function 連携 |

**方針:** MVP では BD bucket のみ。RLS / storage policy は migration 正本に従う。

---

## 8. Auth / Google OAuth / Stripe test mode の扱い

### 8.1 Supabase Auth

| 項目 | Production | Staging |
| --- | --- | --- |
| **Project** | `ddojquacsyqesrjhcvmn` | `<STAGING_REF>` |
| **Email/password** | 本番 allowlist · 実ユーザー | **テストユーザーのみ** |
| **Custom Access Token Hook** | 有効（`config.toml`） | Staging でも **同 migration 適用** |
| **Redirect URLs** | Production Pages URL | Preview URL · `http://127.0.0.1:8788` |

### 8.2 Google OAuth（AI 運営秘書 · Platform 等）

| 項目 | 方針 |
| --- | --- |
| **GCP OAuth Client** | Staging 用 **別 Client** または同一 Client に Staging redirect URI 追加 |
| **Redirect** | `https://<STAGING_REF>.supabase.co/functions/v1/secretary-google-oauth?action=callback` |
| **Secrets** | `SECRETARY_GOOGLE_CLIENT_ID/SECRET` — Staging project secrets に **Staging 用** |
| **Production Client** | Staging URL を **本番 Client に追加しない**（可能なら分離） |

参照: [ai-secretary-google-oauth-gcp-console-runbook.md](./ai-secretary-google-oauth-gcp-console-runbook.md)

### 8.3 Stripe

| 項目 | Production | Staging |
| --- | --- | --- |
| **Mode** | Live（Launch 後） | **Test mode のみ** |
| **Webhook** | Production endpoint | **Staging 専用 endpoint** |
| **Price ID** | Live prices | Test prices · Staging secrets |
| **共有禁止** | Live secret → Staging | Test secret を Production に使わない |

BD webhook path: `/functions/v1/stripe-webhook` · metadata `order_type=business_directory_subscription`

---

## 9. Phase 2a migration を Staging で検証する手順

> Production には Phase 2a **適用済み**（2026-07-01 · Option B）。  
> **今後の migration** および **Staging 初回構築** では以下を正本とする。

### 9.1 前提

- Staging ref link 済  
- BD chain 1–6 済 · 2a **未 apply**  
- `BD_PRODUCTION_PROJECT_REF=ddojquacsyqesrjhcvmn`

### 9.2 手順

| # | Step |
| --- | --- |
| 1 | `npx supabase link --project-ref <STAGING_REF>` |
| 2 | `npx supabase migration list` — 2a 未適用確認 |
| 3 | apply `20260717120000_business_directory_page_content_phase2a.sql`（`db push` or `-f`） |
| 4 | `node scripts/test-business-directory-phase2a-staging-readiness.mjs --remote` → **PASS** |
| 5 | Staging Edge deploy（`business-directory` Phase 2 版） |
| 6 | `npm run build:pages`（Staging `TASFUL_*`）→ `npm run dev` · 8788 |
| 7 | `node scripts/test-business-directory-phase2a-production-smoke.mjs`（`BASE_URL=8788`） |
| 8 | 人手: AI → 反映 → 保存 → edit → 公開 → approve → public · content_update · planGate |
| 9 | Go/No-Go — [staging-verification §7](./business-directory-phase2a-staging-verification.md) |

### 9.3 Go 後

Production への apply は [production-controlled-migration runbook](./business-directory-phase2a-production-controlled-migration.md) — **Staging Go を前提**に改称運用。

---

## 10. Staging → Production リリース手順

### 10.1 原則

```text
Staging: migration → Edge → E2E → Go
Production: 同一 migration ファイル → Edge → smoke → Go
```

**同一 git commit / 同一 migration ファイル** を Production に適用。Staging のみの hotfix SQL 禁止。

### 10.2 チェックリスト（Production）

| # | Item |
| --- | --- |
| 1 | Staging E2E **Go** · 署名 |
| 2 | PITR / backup 方針確認（Production Free も PITR なし — dump 方針） |
| 3 | Maintenance window |
| 4 | CLI link = `ddojquacsyqesrjhcvmn` 目視 |
| 5 | apply migration（`-f` or `db push`） |
| 6 | `--remote` readiness PASS |
| 7 | Production Edge deploy |
| 8 | Production smoke · planGate |
| 9 | Rollback runbook レビュー済 |

### 10.3 Cloudflare

| Step | Action |
| --- | --- |
| 1 | Preview で Staging Supabase + UI 確認 |
| 2 | merge → `main` |
| 3 | Production build（Production `TASFUL_*`） |
| 4 | Production deploy |

---

## 11. やってはいけないこと

| # | 禁止 | 理由 |
| --- | --- | --- |
| N1 | Staging 作業で Production ref に link したまま migration | 本番 DB 破壊 |
| N2 | Production anon/service key を Staging repo / Preview に設定 | データ · 課金混線 |
| N3 | Production ユーザーデータを Staging に dump 復元 | PII · コンプライアンス |
| N4 | Staging 専用 SQL を Production に適用しないまま Production だけ変更 | ドリフト |
| N5 | Edge を migration 前に Production deploy | unknown column / 500 |
| N6 | Stripe Live key を Staging secrets に設定 | 誤課金 |
| N7 | 「Staging apply」ラベルで Production ref に apply | 用語欺瞞 · 事故 |
| N8 | `git add -A` で `.env.staging` · service key をコミット | 秘密漏洩 |
| N9 | Free Staging project を無監視で放置 | pause · 検証不能 |
| N10 | Phase 2a 初回の `CREATE OR REPLACE VIEW` のみ（DROP なし） | PostgreSQL 42P16 |

---

## 12. 最小構成 MVP 手順（Business Directory · Free 2 project）

Commercial Launch 前の **最短 Staging 立ち上げ**。TLV / Match / Secretary フル再現は **後回し**。

### Phase MVP-0 — 文書 · 準備

- [x] 分離方針文書（本ファイル）
- [x] `docs/supabase-environments.md` 作成（ref 確定）
- [x] `.env.staging.example` 追加
- [x] `reports/tasful-supabase-staging-project-manifest.json` 作成
- [x] `scripts/lib/supabase-env.mjs` — `BD_PRODUCTION_PROJECT_REF` ガード

### Phase MVP-1 — Staging project 作成（人手 · Dashboard）

- [ ] §1.2 Dashboard で Free project 作成  
- [ ] ref を §2 正本登録  
- [ ] `.env.staging` 作成  

### Phase MVP-2 — DB（BD のみ）

- [ ] link Staging  
- [ ] apply §4.2 の migration 1–7（2a 含む）  
- [ ] `node scripts/test-business-directory-phase2a-staging-readiness.mjs --remote` PASS  

### Phase MVP-3 — Auth 最小

- [ ] Auth hook migration（Partner P1 以降 · JWT claim）— owner/ops E2E に必要な最小セット  
- [ ] T2 / T4 テストユーザー作成  

### Phase MVP-4 — Edge + secrets（BD）

- [ ] Stripe Test secrets · SITE_URL  
- [ ] `bootstrap-business-directory-stripe-prices.mjs`（Staging ref）  
- [ ] deploy `business-directory` + `stripe-webhook`  
- [ ] `test-business-directory-production-step2-edge.mjs --remote`（Staging ref 対応後）  

### Phase MVP-5 — Pages / 8788

- [ ] CF Preview env → Staging `TASFUL_*`  
- [ ] ローカル: Staging env で `build:pages` + `dev`  
- [ ] `test-business-directory-phase2a-production-smoke.mjs`  

### Phase MVP-6 — Go / 運用

- [ ] Staging Go 判定 · チケット記録  
- [ ] 以降 Production migration は §10  

**MVP 完了定義:** Staging ref 上で BD Phase 2a **migration + Edge + smoke + planGate** が PASS。

---

## 13. Free プラン運用上の注意

| 制約 | Staging への影響 | 緩和 |
| --- | --- | --- |
| PITR なし | rollback は手動 SQL / 再作成 | migration 前 SELECT 保存 · 小さく apply |
| 自動 backup 限定的 | 同上 | 重要 apply 前に `pg_dump` 方針 |
| 2 project 上限 | Production + Staging のみ | 第3 env 不可 |
| Inactivity pause | Staging 停止 | 定期 smoke で wake · または手動 restore |
| Edge 実行上限 | E2E 大量実行注意 | smoke は必要最小 |

Production も Free のため、**両環境とも PITR 期待しない** — [Phase 2a controlled migration](./business-directory-phase2a-production-controlled-migration.md) §6 と同様の dump 方針を Staging でも踏襲。

---

## 14. 実施ステータス（本計画）

| Item | Status |
| --- | --- |
| 計画文書 | ✅ 本ファイル |
| Staging project 作成 | ✅ ref `ahlxuyvhzqdqaojiywmu` |
| ref 正本登録 | ✅ `docs/supabase-environments.md` · manifest |
| 環境変数テンプレ | ✅ `.env.staging.example` · `.env.example` 更新 |
| Migration / Edge / Pages | ⏸ 未実施（別タスク） |
| Production 変更 | ❌ なし（本タスクスコープ外） |

---

## Related files

| File | Role |
| --- | --- |
| [business-directory-phase2a-staging-production-separation.md](./business-directory-phase2a-staging-production-separation.md) | 分離調査 · Option A/B |
| [business-directory-phase2a-production-controlled-migration.md](./business-directory-phase2a-production-controlled-migration.md) | Production apply 記録 |
| [business-directory-phase2a-staging-verification.md](./business-directory-phase2a-staging-verification.md) | Post-apply E2E · Go/No-Go |
| [docs/supabase-migration-plan.md](../docs/supabase-migration-plan.md) | 運営系 Staging 歴史 |
| [docs/local-dev.md](../docs/local-dev.md) | 8788 · build env |

---

*Staging project 作成・link・migration は **別タスク** — 本計画承認後に MVP-1 から順次実施。*
