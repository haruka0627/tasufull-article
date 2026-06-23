# TASFUL — Auth Hook / JWT Claim staging setup plan

| 項目 | 内容 |
|------|------|
| 版 | v1.0（計画のみ） |
| 作成日 | 2026-06-21 |
| ステータス | **未作成 · 未接続 · 未適用** |
| 前提 | `tasful-auth-hook-dry-run-review.md`, `tasful-auth-hook-implementation-plan.md` |
| 判定入力 | `READY_FOR_AUTH_HOOK_STAGING_DECISION`（U-5 / U-7 確定済み） |
| 本書の範囲 | 専用 staging ref 作成 · 検証 · 本番移行前の **手順計画**。実行は次フェーズ |

---

## 1. U-5 確定内容

| 項目 | 確定 |
|------|------|
| **決定** | **A — 専用 staging Supabase ref を採用** |
| **本番 ref** | `ddojquacsyqesrjhcvmn`（linked / 実運用 · **Auth Hook 検証対象外**） |
| **staging ref** | **新規作成**（ref は作成時に `reports/tasful-auth-hook-staging-ref-checklist.md` 等へ文書化 · 本書時点では未発行） |

**採用理由（確定）**

| # | 理由 |
|---|------|
| 1 | 本番 ref `ddojquacsyqesrjhcvmn` への Auth / JWT / Hook 影響を **完全回避** |
| 2 | Auth Hook · JWT claim · RLS D2 を **破壊的検証**可能 |
| 3 | Hook 有効化 · 無効化 · rollback を本番と **切り離して** 反復確認 |

**フォールバック B（linked ref テスト限定）:** **不採用** — dry-run 後の product/infra 判断で A に確定。

---

## 2. U-7 確定内容

**方針:** Custom Access Token Hook 実行時、`talk_user_id` 欠落ユーザーは **最終的に login 拒否**。移行期間は **段階的に厳格化**。

| フェーズ | 環境 | Hook 挙動 | ユーザー影響 | 監査 |
|----------|------|-----------|--------------|------|
| **Phase S** | **staging ref** | `RAISE WARNING` · token **発行継続** | 欠落でも login 可（検証用） | Postgres logs · Dashboard Auth logs |
| **Phase P1** | **本番 ref**（移行初期） | `RAISE WARNING` · token **発行継続** | 欠落ユーザーは **暫定ログイン可** | **監査ログ必須**（欠落 uuid / email / 時刻） |
| **Phase P2** | **本番 ref**（安定後） | `RAISE EXCEPTION` | **login / refresh 拒否** | 同上 · アラート |

**実装切替（Hook SQL · 将来 migration）**

```sql
-- 概念 · 本書では適用しない
-- staging:   v_hook_mode := 'warn';
-- prod P1:   v_hook_mode := 'warn_audit';
-- prod P2:   v_hook_mode := 'reject';
```

| ゲート（P1 → P2） | 条件 |
|-------------------|------|
| G-U7-1 | 本番 cohort `missing_talk_user_id` = **0**（§11 検証 SQL） |
| G-U7-2 | staging + 本番 P1 で **7 日以上** WARN 0 件 |
| G-U7-3 | product/ops **書面 GO** |
| G-U7-4 | rollback（Hook OFF · P1 へ戻す）手順 **リハーサル済み** |

**不変:** `user_metadata` からの補完 **禁止** · 欠落時に `sub` を `talk_user_id` に **しない**。

---

## 3. 専用 staging Supabase ref を作る目的

| 目的 | 詳細 |
|------|------|
| **Auth SPOF 分離** | Custom Access Token Hook は全 token 発行に介入 · 本番で試さない |
| **JWT claim 実測** | `app_metadata.talk_user_id` · backfill · refresh · Hook ON/OFF の before/after |
| **Edge 署名 JWT** | `match-auth.ts` verifyJwt 本実装を **Supabase 発行 JWT** で smoke |
| **RLS D2 試験** | `match_current_user_id()` + policies を **本番 TALK データ無し**で適用 |
| **U-7 モード検証** | staging = WARN のみ先に実装 · 本番 P1/P2 は staging 成功後 |
| **rollback 訓練** | Hook OFF · metadata 戻し · RLS revert を **本番影響ゼロ**で反復 |

---

## 4. staging に必要な構成

### 4.1 Supabase project（新規）

| 項目 | 方針 |
|------|------|
| Project 名 | `tasful-auth-staging`（例 · 命名は infra 確定） |
| Region | 本番と **同一リージョン推奨**（レイテンシ · 障害パターン一致） |
| Plan | Free/Pro（Custom Access Token Hook は Free/Pro 可） |
| Database | Postgres · **空 DB から migration 適用** |
| Auth | Email/password · テストユーザー 3〜5 · **本番 SSO 連携は後回し** |
| Edge Functions | MATCH 7 件 + `_shared/match-auth.ts` **のみ先行**（Stripe/GenAI は不要） |
| Storage | MATCH 検証に必要な **匿名プレースホルダのみ** · 本番 bucket 複製禁止 |
| Secrets | staging 専用 · **本番 secrets と値共有禁止** |

### 4.2 Repo / ローカル

| 項目 | 方針 |
|------|------|
| `chat-supabase-config.js` | **本番ファイル変更禁止** · `chat-supabase-config.staging.local.js` 等で上書き |
| `supabase link` | staging ref 用 **別ディレクトリ or `--project-ref`** · 本番 link 上書き注意 |
| CI | staging secrets を **別 GitHub Environment**（将来） |
| ドキュメント | ref · テストユーザー UUID · 検証日を **repo 外 secrets 管理表** + レポート |

### 4.3 テストユーザー（最小 5 ロール）

| # | email（例） | talk_user_id | 用途 |
|---|-------------|--------------|------|
| T1 | `auth-hook-test-1@tasful.invalid` | `u_auth_test_001` | backfill · JWT 正常系 |
| T2 | `auth-hook-test-2@tasful.invalid` | `u_auth_test_002` | TALK buyer 役 |
| T3 | `auth-hook-test-3@tasful.invalid` | `u_auth_test_003` | TALK seller 役 |
| T4 | `auth-hook-test-ops@tasful.invalid` | `u_auth_test_ops` | `is_ops=true` · admin Edge |
| T5 | `auth-hook-test-missing@tasful.invalid` | **（意図的に未設定）** | U-7 WARN 検証 |

**禁止:** `u_me` を staging 恒久 ID にしない（demo 専用列は T5 以外で使わない）。

### 4.4 検証成果物（staging 各 Phase 完了時）

| Phase | レポート（案） |
|-------|----------------|
| ref 作成 | `tasful-auth-hook-staging-ref-checklist.md` |
| schema seed | `tasful-auth-hook-staging-seed-result.md` |
| backfill | `tasful-auth-hook-backfill-result.md` |
| Hook | `tasful-auth-hook-staging-jwt-result.md` |
| Edge smoke | `match-staging-edge-smoke-result-signed-jwt.md` |
| RLS D2 | `match-rls-d2-staging-apply-result.md` |

---

## 5. staging にコピーすべきもの

| カテゴリ | 内容 | ソース（repo） |
|----------|------|----------------|
| **スキーマ草案** | MATCH DDL（RLS 本体は D2 ゲート後） | `supabase/migrations/20260621120000_match_schema_draft.sql` |
| | RLS helper 草案 | `20260621130000_match_rls_draft.sql` |
| | RLS D2 talk_user_id 草案 | `20260621140000_match_rls_d2_talk_user_id_draft.sql` |
| | TALK 最小テーブル subset | **新規 seed SQL 草案**（`transaction_rooms` 等 · 匿名化 synthetic） |
| **必要最小限のテストデータ** | 2〜3 ルーム · 1 listing · 2 match_profiles | synthetic · text ID = テストユーザー `talk_user_id` |
| **テストユーザー** | §4.3 の 5 アカウント | Dashboard 手動作成 · Admin API backfill |
| **match_* 草案** | 上記 migration + hobby_tags seed 数件 | repo migration |
| **Edge Function stub** | MATCH 7 functions + `match-auth.ts` | `supabase/functions/match-*` |
| **Auth Hook 草案** | `custom_access_token_hook`（U-7 = WARN） | dry-run §4 草案 → staging migration |
| **検証スクリプト** | ローカル smoke · JWT decode script（新規案） | `scripts/test-match-local-edge-smoke.mjs` 等 |
| **設計・mapping** | CSV テンプレート · confidence ルール | dry-run §2 |

**原則:** 構造と **合成 ID** のみ · 本番行の `COPY` **禁止**。

---

## 6. staging にコピーしてはいけないもの

| 禁止 | 理由 |
|------|------|
| **本番ユーザー個人情報** | 法令 · 契約 · 漏洩リスク |
| **本番チャット内容** | `transaction_reads` / メッセージ本文 |
| **本人確認データ** | `match_verifications` 相当 · KYC 画像 |
| **決済情報** | Stripe customer / 注文 · 本番 Edge 不要 |
| **通報詳細** | `match_reports` 実内容 |
| **本番 secrets の平文** | service_role · Stripe · LINE · API keys |
| **本番 storage の個人画像** | アバター · 施工写真 · 通報添付 |
| **本番 auth.users ダンプ** | uuid/email 混在 · 誤 backfill リスク |
| **本番 JWT / refresh token** | セキュリティ |
| **本番 Webhook URL / DNS** | 誤課金 · 誤通知 |

**anon key のみ** client 配布可 · **service_role** は CI/ops のみ。

---

## 7. 必要な環境変数一覧

### 7.1 Supabase Dashboard / CLI（staging ref）

| 変数 | 用途 | 保管 |
|------|------|------|
| `SUPABASE_URL` | `https://{STAGING_REF}.supabase.co` | CI · ローカル `.env.staging`（gitignore） |
| `SUPABASE_ANON_KEY` | client · smoke | 同上 · Pages preview 可 |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API backfill · migration | **CI/ops のみ** |
| `SUPABASE_ACCESS_TOKEN` | CLI deploy（個人 PAT） | 開発者ローカルのみ |
| `SUPABASE_DB_PASSWORD` | migration · SQL 監査 | secrets 管理表 |
| `SUPABASE_JWT_SECRET` | Edge verifyJwt（Phase 6） | Dashboard → API · **本番と別値** |

### 7.2 Edge Functions（staging deploy · MATCH のみ）

| 変数 | 用途 | 備考 |
|------|------|------|
| `SUPABASE_URL` | auto + 明示 | |
| `SUPABASE_ANON_KEY` | CORS 付き invoke | |
| `SUPABASE_SERVICE_ROLE_KEY` | admin Edge 内部 | |
| `SUPABASE_JWT_SECRET` | `verifyJwt` | Phase 6 以降 |

**不要（staging Auth フェーズ）:** `STRIPE_*`, `OPENAI_*`, `GEMINI_*`, `LINE_*` 等 — デプロイ対象外。

### 7.3 ローカル / スクリプト

| 変数 | 用途 |
|------|------|
| `STAGING_SUPABASE_URL` | smoke script |
| `STAGING_SUPABASE_ANON_KEY` | login テスト |
| `STAGING_TEST_USER_EMAIL` / `PASSWORD` | T1 等 |
| `MATCH_EDGE_BASE_URL` | `https://{STAGING_REF}.supabase.co/functions/v1` |
| `SKIP_BROWSER` | CI で browser 省略可 |

### 7.4 Cloudflare Pages（staging preview · 任意）

| 変数 | 用途 |
|------|------|
| Preview branch env | staging anon URL/key **のみ** |
| **禁止** | 本番 `chat-supabase-config.js` への staging key コミット |

---

## 8. Cloudflare / app 側の staging 接続方針

| 項目 | 方針 |
|------|------|
| **本番 Pages (`tasful.jp`)** | **staging ref に接続しない** · 本計画では DNS/本番 env 変更なし |
| **ローカル検証（第一選択）** | `npx wrangler pages dev` + **ローカル** `chat-supabase-config.staging.local.js` を HTML から読込 |
| **Pages Preview** | 専用 branch `auth-hook-staging` · Cloudflare env に staging anon のみ |
| **`chat-supabase-config.js`** | 本番 ref 固定 **維持** · merge 禁止 |
| **接続切替** | `?supabaseStaging=1` または `window.__TASU_SUPABASE_STAGING__`（**将来 PR · 本計画では未実装**） |
| **TALK / MATCH UI** | staging 検証時のみ preview URL · `edge_stub` / 明示 staging mode |
| **talkProductionMode** | preview でも **false 相当** · demo fallback テストは localhost 限定 |

**原則:** app 側変更は **staging preview ブランチ限定 PR** · 本番反映は §15 チェックリスト後。

---

## 9. Auth Hook 検証順

**前提:** staging schema 適用済み · テストユーザー作成済み · **本番 ref 未変更**

| 順 | 作業 | U-7 モード | ゲート |
|----|------|------------|--------|
| H0 | Hook 関数 migration **適用**（CREATE のみ · Dashboard **OFF**） | — | 関数存在 · GRANT OK |
| H1 | T1 backfill **`talk_user_id` 設定**（§10） | — | metadata 存在 |
| H2 | Hook **OFF** · T1 login · JWT decode | — | metadata in JWT |
| H3 | Hook **ON** · T1 `refreshSession` | **WARN** | claim = metadata |
| H4 | T5（欠落）login · refresh | **WARN** | token 発行 · **warning ログ** |
| H5 | T4 ops · `is_ops` / admin claim | **WARN** | admin Edge 準備 |
| H6 | Hook **OFF** リハーサル（§14） | — | login 継続 · claim 残存 |
| H7 | Hook **ON** 再開 · 24h 監視 | **WARN** | error rate 正常 |

**禁止:** H3 以前に RLS D2 ENABLE · 本番 ref での H3。

---

## 10. app_metadata.talk_user_id backfill 検証順

| 順 | 作業 | 対象 | 方法 |
|----|------|------|------|
| B0 | mapping CSV 完成（staging 5 ユーザー） | T1–T4 | dry-run §2 テンプレート |
| B1 | **READ** 監査 · 全員欠落確認 | auth.users | dry-run §5.1 SQL |
| B2 | **T1 のみ** Admin API merge | 1 uuid | dry-run §3.4 |
| B3 | JWT decode（Hook **OFF**） | T1 | R3: `talk_user_id` 存在 |
| B4 | `refreshSession` | T1 | R5 一致 |
| B5 | T2–T4 順次 backfill | 3 uuid | B2 同手順 |
| B6 | 重複監査 | 全体 | dry-run §5.2 → **0 rows** |
| B7 | TALK seed 整合 | buyer/seller | dry-run §5.3–5.4 |
| B8 | **T5 は意図的スキップ** | 欠落 | U-7 H4 用 |

**ロールバック訓練:** T1 のみ §3.3 相当 Admin API で metadata 削除 → B2 再実行。

---

## 11. JWT claim 実測手順

### 11.1 ツール

| 方法 | 許可 | 禁止 |
|------|------|------|
| ローカル Node script（base64 decode） | ✓ staging token のみ | jwt.io 等外部 |
| Browser DevTools + `supabase.auth.getSession()` | ✓ preview/localhost | 本番 token 共有 |
| Postgres `select auth.jwt()` | ✓ staging · authenticated | service_role 混同 |

### 11.2 手順（1 ユーザー · T1）

| # | 操作 | 確認 |
|---|------|------|
| J1 | staging anon で `signInWithPassword` | session 取得 |
| J2 | access_token をローカル decode | `sub` = auth uuid |
| J3 | `app_metadata.talk_user_id` | = `u_auth_test_001` |
| J4 | `app_metadata.member_id` | = `talk_user_id` |
| J5 | Hook ON 後 J1–J4 再実行 | 値不変 |
| J6 | `TasuAuthCurrentUser`（preview） | `talkUserId` = J3 |
| J7 | SQL `select auth.jwt()->'app_metadata'->>'talk_user_id'` | = J3 |

**ゲート:** J3–J7 が **同一値 · 非 NULL**（T5 を除く）。

### 11.3 token refresh 確認（implementation plan §9）

| ステップ | 期待 |
|----------|------|
| backfill 直後 · 旧 token | 旧 claim の可能性 → **refresh 必須** |
| `refreshSession()` 後 | 新 token に `talk_user_id` |
| Hook ON/OFF 各 1 回 | claim 一貫（metadata 源） |

---

## 12. Edge smoke 再実行手順

**前提:** Phase 6 `verifyJwt` 実装済み · staging Functions deploy · **署名付き** Supabase JWT

| 順 | 作業 | 参照 |
|----|------|------|
| E0 | ローカル回帰 | `node scripts/test-match-local-edge-smoke.mjs` PASS 維持 |
| E1 | staging に MATCH 7 functions deploy | `match-staging-edge-smoke-plan.md` §2 |
| E2 | T1 login → `access_token` 取得 | §11 |
| E3 | `Authorization: Bearer <access_token>` · **`x-match-user-id` なし** | |
| E4 | 7 functions 疎通 | 200/422 期待どおり |
| E5 | T4 ops JWT · admin function | `is_ops` claim |
| E6 | 故意に欠落 JWT（T5） | 401/403（verify 実装次第） |
| E7 | 結果記録 | `match-staging-edge-smoke-result-signed-jwt.md` |

**LOCAL との差:** `stub-match-token` → **Supabase 発行 JWT** · 署名検証 **必須**。

**Docker 無し:** remote staging URL 直接 · または `match-local-edge-smoke-server.ts` + staging JWT（署名検証は remote で実施）。

---

## 13. RLS D2 適用前ゲート

`20260621140000_match_rls_d2_talk_user_id_draft.sql` 適用は **以下 ALL PASS**（implementation plan §11）

| # | ゲート | 確認方法 | staging 担当 Phase |
|---|--------|----------|-------------------|
| G1 | JWT に `talk_user_id` | decode · `auth.jwt()` | §11 完了 |
| G2 | JWT = `TasuAuthCurrentUser.talkUserId` | preview script | §11 J6 |
| G3 | JWT = TALK `buyer_id`/`seller_id` | seed SQL + session | §10 B7 |
| G4 | JWT = `match_profiles.user_id` | seed 後 SQL | schema seed 後 |
| G5 | Edge `requireUser` = 同一 ID | §12 E4 | Edge smoke |
| G6 | Hook ON · refresh 後も維持 | §9 H3 + §11 J5 | Hook 検証 |
| G7 | 対象 cohort で `match_current_user_id()` NULL **0** | SQL 監査 | T5 は除外定義を文書化 |

**適用順（staging）**

```text
20260621120000_match_schema_draft.sql
  → synthetic seed
  → §10 backfill + §11 JWT + §9 Hook
  → §12 Edge smoke (G5)
  → 20260621130000_match_rls_draft.sql（helper）
  → 20260621140000_match_rls_d2_talk_user_id_draft.sql
  → RLS ENABLE migration（別ファイル · レビュー後）
  → RLS 統合テスト
```

**禁止:** G1 未達で RLS ENABLE · 本番 ref での staging スキップ。

---

## 14. rollback 手順

### 14.1 Hook 無効化（最優先 · 1 分以内目標）

| 順 | 操作 | 環境 |
|----|------|------|
| 1 | Dashboard → Authentication → Hooks → **Custom Access Token Hook OFF** | staging / 本番 |
| 2 | Auth error rate · login 成功率確認 | |
| 3 | 継続障害 → metadata / Edge エスカレーション | |

**Hook OFF 後:** JWT は Supabase 標準 + **`app_metadata` 埋込**（backfill 済みなら `talk_user_id` 残る）。

### 14.2 U-7 モード rollback

| から | へ | 操作 |
|------|-----|------|
| P2 EXCEPTION | P1 WARN | Hook SQL を `warn_audit` に差替 · deploy · **即時** |
| P1 WARN | Hook OFF | Dashboard OFF · 欠落ユーザーは metadata 未設定のまま |

### 14.3 backfill rollback（staging）

| ケース | 手順 |
|--------|------|
| 単一ユーザー誤 mapping | Admin API merge 修正 + refresh |
| 全テストユーザー | allowlist uuid の metadata キー削除 |
| TALK seed 不一致 | seed SQL revert · **ID 変更禁止**（行がある場合） |

### 14.4 Edge rollback

`match-auth.ts` を verify 前 stub に revert · staging functions redeploy · §12 E0 ローカル PASS。

### 14.5 RLS D2 rollback

RLS DISABLE migration · `match_current_user_id()` DROP/旧版 · MATCH client は `client_stub` 維持。

### 14.6 staging ref 全体破棄

project pause/delete（**最終手段**）· 本番 ref には **影響なし**（A 採用の利点）。

---

## 15. 本番移行前チェックリスト

**本番 ref `ddojquacsyqesrjhcvmn` への適用前 · ALL required**

### 15.1 staging 完了

- [ ] 専用 staging ref 作成 · 文書化
- [ ] §10 backfill 手順 staging 完遂（T1–T4）
- [ ] §9 Hook H3–H7 PASS（U-7 = WARN）
- [ ] §11 JWT J1–J7 PASS
- [ ] §12 Edge smoke 署名 JWT PASS
- [ ] §13 G1–G7 staging PASS
- [ ] RLS D2 staging 適用 · 統合テスト PASS
- [ ] §14 rollback リハーサル PASS（Hook OFF · metadata 1 件戻し）

### 15.2 本番 mapping

- [ ] 本番 auth.users 棚卸し CSV · confidence `high` のみ自動対象
- [ ] `u_me` / demo 本番 cohort **0 件**
- [ ] talk_user_id 重複 **0 件**
- [ ] product/ops mapping CSV **承認**

### 15.3 本番実行計画

- [ ] 変更窗口 · 担当 2 名 · `#ops-auth` 連絡
- [ ] U-7 **P1（WARN + 監査）** で開始 · P2 日付は G-U7 ゲート後
- [ ] backfill 段階: 1 → 10 → 100 → 全量（各段 refresh ゲート）
- [ ] 本番 Edge verifyJwt deploy 計画（MATCH 先行）
- [ ] 本番 RLS D2 は **本番 JWT ゲート再確認後**

### 15.4 禁止確認

- [ ] 本番 Hook ON と RLS D2 **同日実施しない**
- [ ] service_role client 露出 **なし**
- [ ] 本番 secrets を staging に **コピーしていない**

---

## 16. 次ステップ

| 順 | フェーズ | 作業 | 成果物 | 実行 |
|----|----------|------|--------|------|
| **1** | **Staging ref 作成** | Supabase project 新規 · ref 記録 · secrets 管理表 | `tasful-auth-hook-staging-ref-checklist.md` | **次アクション** |
| 2 | Schema + seed | migration 適用 · synthetic TALK/MATCH seed | seed result レポート |
| 3 | テストユーザー | Dashboard 5 件 · mapping CSV 確定 | UUID 一覧（secrets 表） |
| 4 | Backfill | §10 B2–B7 | backfill result |
| 5 | Hook deploy | migration + Dashboard ON（WARN） | JWT result |
| 6 | JWT 実測 | §11 全項目 | 同上 |
| 7 | Edge verify + smoke | `verifyJwt` PR + §12 | signed JWT smoke result |
| 8 | RLS D2 | G1–G7 後 apply | RLS apply result |
| 9 | 本番移行計画 | §15 チェックリスト · U-7 P1 開始日 | prod rollout runbook |
| 10 | U-7 P2 | G-U7 ゲート後 EXCEPTION 切替 | prod stable 宣言 |

**本書作成時点で行わないこと:** ref 作成 · Dashboard · SQL · Hook · DB 接続 · UI · 本番反映。

---

## 判定

### **READY_FOR_STAGING_REF_CREATION_CHECKLIST**

**理由**

- **U-5（A: 専用 staging ref）** — product/infra **確定**
- **U-7（段階移行: staging WARN → 本番 P1 WARN+監査 → P2 EXCEPTION）** — **確定**
- staging 構成 · コピー可否 · env · app 接続 · 検証順 · ゲート · rollback · 本番前チェックリストを **実行可能粒度**で固定
- 次フェーズの即時アクションは **§16-1: staging ref 作成チェックリスト** のみ（本書では ref 未作成）

**NEEDS_DECISION:** なし（U-5 / U-7 解消済み）

---

## 参照

| ファイル | 用途 |
|----------|------|
| `reports/tasful-auth-hook-dry-run-review.md` | mapping · SQL/Hook 草案 · 禁止事項 |
| `reports/tasful-auth-hook-implementation-plan.md` | Phase 0–10 · rollback · G1–G7 |
| `reports/tasful-auth-hook-jwt-claim-design.md` | 案 A · claim 構造 |
| `reports/match-staging-edge-smoke-plan.md` | Edge 7 functions |
| `reports/match-local-edge-smoke-result.md` | LOCAL_EDGE_SMOKE_PASS |
| `chat-supabase-config.example.js` | client 設定テンプレート |
| `supabase/migrations/202606211*.sql` | MATCH schema / RLS 草案 |
