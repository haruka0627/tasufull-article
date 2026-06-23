# TASFUL — Auth Hook / JWT Claim 専用 staging ref 作成チェックリスト

| 項目 | 内容 |
|------|------|
| 版 | v1.0（チェックリストのみ） |
| 作成日 | 2026-06-21 |
| ステータス | **ref 未作成 · 未接続 · 未適用** |
| 前提 | `tasful-auth-hook-staging-setup-plan.md`, `tasful-auth-hook-implementation-plan.md`, `tasful-auth-hook-dry-run-review.md` |
| 判定入力 | `READY_FOR_STAGING_REF_CREATION_CHECKLIST` |
| 本書の範囲 | 専用 staging Supabase ref **作成前**の作業明文化。**作成・Dashboard · SQL · Hook は本書では行わない** |

---

## 使い方

| 記号 | 意味 |
|------|------|
| `[ ]` | 未実施（手動作業時にチェック） |
| **禁止** | 実施してはいけない |
| **後続** | ref 作成 **後** のフェーズ（本チェックリスト完了後） |

**記録:** ref 作成後、`STAGING_REF` · 各 `auth_user_id`（UUID）は **repo 外 secrets 管理表**に記載。本書には `{STAGING_REF}` プレースホルダのみ。

---

## 1. staging ref 作成目的

| # | 目的 |
|---|------|
| 1 | 本番 ref `ddojquacsyqesrjhcvmn` へ **Auth Hook / JWT / backfill 影響を与えない** |
| 2 | `app_metadata.talk_user_id` · Custom Access Token Hook · token refresh を **安全に実測** |
| 3 | MATCH Edge **署名付き JWT** smoke · RLS D2 を **合成データのみ**で試験 |
| 4 | U-7 **staging = WARN** · Hook ON/OFF · rollback を **反復訓練** |
| 5 | 本番移行前ゲート（G1–G7 · §15）の **エビデンス取得場** |

**凍結継続:** MATCH **新機能追加禁止**（Auth/Hook/Edge/RLS 検証のみ）。

---

## 2. 作成前チェック

### 2.1 方針・前提

- [ ] U-5 **A（専用 staging ref）** 確定済み（`staging-setup-plan.md` §1）
- [ ] U-7 段階移行確定済み（staging WARN → 本番 P1 → P2）
- [ ] Phase 0 dry-run 完了（`tasful-auth-hook-dry-run-review.md`）
- [ ] 担当者 2 名以上 · 変更窗口の合意（ops/product）
- [ ] 本番 `chat-supabase-config.js` を **変更しない** 合意

### 2.2 権限・ツール

- [ ] Supabase org へ **新規 project 作成権限**あり
- [ ] `supabase` CLI インストール済み（任意 · migration 用）
- [ ] secrets 管理表（repo 外）のテンプレート準備
- [ ] 本番 service_role / JWT secret を **持ち出さない** 確認

### 2.3 禁止事前確認

- [ ] 本番 DB dump · `auth.users` COPY 計画 **なし**
- [ ] 本番 ref で Hook 有効化予定 **なし**（staging 完了まで）
- [ ] `tasful.jp` 本番 Pages env 変更予定 **なし**
- [ ] RLS D2 本番適用予定 **なし**（G1–G7 前）

### 2.4 成果物準備（repo 内 · 読取のみ）

- [ ] `supabase/migrations/20260621120000_match_schema_draft.sql` レビュー済み
- [ ] `20260621130000_match_rls_draft.sql` · `20260621140000_match_rls_d2_talk_user_id_draft.sql` レビュー済み
- [ ] Hook SQL 草案（dry-run §4）レビュー済み
- [ ] テストユーザー 5 ロール定義（§10）合意

**作成前ゲート:** 上記 **すべて** ✓ → **手動 ref 作成に進行可**

---

## 3. 作成時チェック

**実施:** Supabase Dashboard → New project（**本チェックリスト作成時点では未実施**）

### 3.1 Project 基本

- [ ] Project 名: `tasful-auth-staging`（または infra 命名規則）
- [ ] Region: 本番と **同一リージョン**（推奨）
- [ ] Database password: **本番と別** · secrets 管理表へ記録
- [ ] **Project ref** `{STAGING_REF}` を secrets 管理表に記録（**repo に commit しない**）
- [ ] Project URL: `https://{STAGING_REF}.supabase.co`

### 3.2 本番との分離確認（作成直後）

- [ ] ref が `ddojquacsyqesrjhcvmn` **ではない**ことを目視確認
- [ ] anon key / service_role が **本番と異なる**ことを確認
- [ ] JWT secret が **本番と異なる**ことを確認（Settings → API）
- [ ] 本番 project を誤って open していない（URL バー二重確認）

### 3.3 初期 Dashboard 設定（Hook は OFF のまま）

- [ ] Authentication → Providers: Email 有効（テスト用）
- [ ] Authentication → Hooks: **Custom Access Token Hook = 未設定 / OFF**
- [ ] Site URL: `http://localhost:8788` または preview URL（本番 `tasful.jp` **禁止**）
- [ ] Redirect URLs: localhost + preview のみ追加
- [ ] **本番 OAuth / SSO 連携は設定しない**（後回し）

### 3.4 CLI link（任意 · 本番 link 上書き禁止）

- [ ] `supabase link --project-ref {STAGING_REF}` を **本番 link 前に** ref 確認
- [ ] または `.supabase/` を staging 専用 worktree で使用
- [ ] `supabase link` 後も `chat-supabase-config.js` は **本番 ref のまま**

---

## 4. 作成後チェック

### 4.1 接続・鍵

- [ ] anon key を secrets 管理表に記録
- [ ] service_role key を secrets 管理表に記録（**repo 不入**）
- [ ] `SUPABASE_JWT_SECRET` を記録（Edge verifyJwt 用 · 後続）
- [ ] ローカル `.env.staging` 作成（**.gitignore** · 未 commit 確認）

### 4.2 Auth 状態

- [ ] テストユーザー 5 件作成（§10）· UUID を管理表に記録
- [ ] T5 以外は **まだ backfill しない**（または T5 のみ常にスキップ）
- [ ] Hook **OFF** のまま（Dashboard 再確認）

### 4.3 ドキュメント

- [ ] `reports/tasful-auth-hook-staging-ref-created.md`（**後続** · ref 作成実行時）に日時 · ref · 担当を記録
- [ ] 本チェックリスト §3–§4 の `[ ]` を実行ログとして保存

### 4.4 本番非接触

- [ ] `ddojquacsyqesrjhcvmn` Dashboard を **変更していない**
- [ ] 本番 `chat-supabase-config.js` diff **なし**
- [ ] 本番 Edge Functions deploy **なし**

---

## 5. 必要な Supabase 設定

| 設定 | staging 値 | 備考 |
|------|------------|------|
| **Project ref** | `{STAGING_REF}`（新規） | ≠ `ddojquacsyqesrjhcvmn` |
| **Auth → Email** | ON | 5 テストユーザー用 |
| **Auth → Hook** | **OFF**（初期〜backfill 完了まで） | ON は §13 ゲート後 |
| **Site URL** | localhost / preview | ≠ `https://tasful.jp` |
| **Redirect URLs** | `http://127.0.0.1:*` · preview `*.pages.dev` | |
| **Database** | 空 → migration 適用（**後続**） | 本番 COPY 禁止 |
| **Edge Functions** | MATCH 7 件のみ deploy（**後続**） | Stripe/GenAI 不要 |
| **Storage** | 匿名プレースホルダ bucket のみ（必要時） | 本番 bucket 複製禁止 |
| **RLS** | 初期 OFF · D2 ゲート後 ENABLE（**後続**） | |
| **Realtime / Webhooks** | 初期 OFF または未設定 | 本番 webhook URL 禁止 |

---

## 6. 必要な Secrets / 環境変数

### 6.1 secrets 管理表（repo 外 · 必須列）

| キー | 例 | 保管 |
|------|-----|------|
| `STAGING_REF` | `{STAGING_REF}` | 管理表 |
| `STAGING_SUPABASE_URL` | `https://{STAGING_REF}.supabase.co` | 管理表 · `.env.staging` |
| `STAGING_SUPABASE_ANON_KEY` | `eyJ...` / `sb_publishable_...` | 同上 |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` / `sb_secret_...` | **管理表のみ** |
| `STAGING_SUPABASE_JWT_SECRET` | Dashboard → JWT Settings | 管理表 · Edge secrets |
| `STAGING_DB_PASSWORD` | 作成時設定 | 管理表 |
| `T1_AUTH_USER_ID` … `T5_AUTH_USER_ID` | uuid × 5 | 管理表 |
| `T1_PASSWORD` … `T4_PASSWORD` | テスト用 | 管理表（T5 も login 用 pw） |

### 6.2 ローカル / スクリプト（`.env.staging` · gitignore）

```bash
STAGING_SUPABASE_URL=https://{STAGING_REF}.supabase.co
STAGING_SUPABASE_ANON_KEY=
STAGING_SUPABASE_SERVICE_ROLE_KEY=
MATCH_EDGE_BASE_URL=https://{STAGING_REF}.supabase.co/functions/v1
```

### 6.3 Edge Functions secrets（**後続** deploy 時 · staging のみ）

| 変数 | 用途 |
|------|------|
| `SUPABASE_URL` | auto |
| `SUPABASE_ANON_KEY` | invoke |
| `SUPABASE_SERVICE_ROLE_KEY` | admin 内部 |
| `SUPABASE_JWT_SECRET` | verifyJwt（Phase 6） |

### 6.4 禁止

| 禁止 | 理由 |
|------|------|
| 本番 `service_role` を staging env に設定 | 誤操作 · 漏洩 |
| secrets を repo / `chat-supabase-config.js` に commit | セキュリティ |
| 本番 Stripe / LINE / OpenAI keys を staging にコピー | スコープ外 · 誤課金 |

---

## 7. コピーしてよい schema / migration

**原則:** repo の **草案 migration を staging に適用**（本番 ref には **未適用**のまま）。**後続フェーズ**で実行。

| 順 | ファイル | 内容 | 適用タイミング |
|----|----------|------|----------------|
| 1 | `supabase/migrations/20260621120000_match_schema_draft.sql` | MATCH テーブル DDL | seed 前 |
| 2 | （新規）`staging_talk_minimal_draft.sql` | `transaction_rooms` 等 **合成**最小 TALK | seed |
| 3 | `20260621130000_match_rls_draft.sql` | helper · policy 草案 | **G1–G6 後** |
| 4 | `20260621140000_match_rls_d2_talk_user_id_draft.sql` | `match_current_user_id()` D2 | **G1–G6 後** |
| 5 | （新規）`auth_custom_access_token_hook_draft.sql` | Hook 関数 CREATE | Hook 前 · **ENABLE は別** |
| 6 | （将来）`member_identities` DDL | 任意 | Phase 2 |

**禁止:** 本番 DB から `\copy` · pg_dump データ · `auth.users` インポート。

---

## 8. コピーしてよい seed data

**すべて synthetic · テストユーザー `talk_user_id` と一致**

| データ | 内容 | 関連ロール |
|--------|------|------------|
| `match_hobby_tags` | 3〜5 件（slug/label のみ） | 全般 |
| `match_profiles` | T1/T2/T3 各 1 行 · text `user_id` | §10 |
| `match_verifications` | T2 のみ `status=approved` **合成**（画像 URL は placeholder） | T2 |
| `match_sanctions` | T3 のみ active `type=ban` **合成** | T3 |
| `transaction_rooms` | T1 buyer × T2 seller 等 · **匿名タイトル** | T1/T2 |
| `listings` | 0〜1 件 · ダミー seller | 任意 |

**生成方法:** 手書き SQL seed または faker · **本番行 ID の再利用禁止**（ coincidental も避ける）。

---

## 9. コピー禁止データ

| 禁止 | 理由 |
|------|------|
| **本番ユーザー個人情報** | 法令 · 契約 |
| **本番チャット内容** | `transaction_reads` / メッセージ |
| **本番 KYC 情報** | `match_verifications` 実データ · 身分証 |
| **本番決済情報** | Stripe · 注文 |
| **本番通報詳細** | `match_reports` 実内容 |
| **本番 secrets 平文** | 全 API keys · service_role |
| **本番 storage 個人画像** | アバター · 施工 · 通報添付 |
| **本番 auth.users ダンプ** | uuid/email 混在リスク |
| **本番 JWT / refresh token** | セキュリティ |
| **`u_me` を本番 cohort からコピー** | demo ID 汚染 |

---

## 10. テストユーザー 5 ロール定義

**email ドメイン `@tasful.invalid` · 本番に存在しないこと**

| ID | ロール | email（例） | talk_user_id | app_metadata（backfill 後） | seed / 備考 |
|----|--------|-------------|--------------|----------------------------|-------------|
| **T1** | `normal_user` | `auth-hook-t1-normal@tasful.invalid` | `u_stg_normal_001` | `member_id`=同値 · `is_ops=false` | `match_profiles` 通常 · `verification_status=none` |
| **T2** | `match_verified_user` | `auth-hook-t2-verified@tasful.invalid` | `u_stg_verified_002` | 同上 | `verification_status=verified` · 合成 `match_verifications` |
| **T3** | `banned_match_user` | `auth-hook-t3-banned@tasful.invalid` | `u_stg_banned_003` | 同上 | active `match_sanctions` · Edge/RLS ban 検証用 |
| **T4** | `tasu_admin` | `auth-hook-t4-admin@tasful.invalid` | `u_stg_admin_004` | `is_ops=true` · `role=tasu_admin` · `platform_role=ops` | MATCH admin Edge · **本番 OFF 相当の header fallback は staging のみ** |
| **T5** | `missing_talk_user_id` | `auth-hook-t5-missing@tasful.invalid` | **（意図的に未設定）** | **backfill 禁止** | U-7 WARN 検証 · login は可能（staging） |

**共通ルール**

- 1 auth_user_id → 1 talk_user_id（T5 を除く）
- **`u_me` / `stub-user-current` を恒久 ID にしない**
- UUID は作成後に管理表へ · mapping CSV に `source=staging_test` · `confidence=high`
- T5 を除き `member_id` = `talk_user_id`（D-3）

---

## 11. Auth Hook OFF 状態での確認

**タイミング:** ref 作成 → テストユーザー作成 → **backfill 前/後** · Hook **常に OFF**

| # | 確認 | 期待 | チェック |
|---|------|------|----------|
| HOFF-1 | Dashboard → Hooks | Custom Access Token Hook **無効** | [ ] |
| HOFF-2 | T1 backfill **前** login | session 取得可 · JWT に `talk_user_id` **無** | [ ] |
| HOFF-3 | T1 Admin API backfill 後 · Hook OFF | JWT decode に `app_metadata.talk_user_id` = `u_stg_normal_001` | [ ] |
| HOFF-4 | `refreshSession()` | 新 token にも同一 claim | [ ] |
| HOFF-5 | Postgres `auth.jwt()`（authenticated） | coalesce 第一候補 = T1 ID | [ ] |
| HOFF-6 | T5 login · Hook OFF | JWT に `talk_user_id` **無** · login **成功** | [ ] |
| HOFF-7 | T4 backfill 後 · Hook OFF | `is_ops` / `role` が JWT `app_metadata` に存在 | [ ] |

**SQL 監査（READ · service_role）:** dry-run §5.1–5.2 · T5 のみ missing。

**ゲート:** HOFF-3–HOFF-5 PASS → §13 Hook ON 候補。

---

## 12. backfill dry-run 手順

**目的:** 書込手順のリハーサル · **本チェックリスト作成時は実行しない**

| 順 | 作業 | 対象 | 方法 |
|----|------|------|------|
| B0 | mapping CSV 更新 | T1–T4 | §10 列 + `auth_user_id` |
| B1 | READ 監査 | 全 5 件 | §5.1 dry-run SQL |
| B2 | **T1 のみ** merge | 1 uuid | Admin API（dry-run §3.4）· **SQL UPDATE は ops 承認後** |
| B3 | JWT decode | T1 | Hook OFF · §11 HOFF-3 |
| B4 | `refreshSession` | T1 | claim 維持 |
| B5 | T2 → T3 → T4 順次 | 各 1 件 | B2 同手順 · **各段ゲート** |
| B6 | T5 **スキップ確認** | T5 | metadata 欠落のまま |
| B7 | 重複監査 | 全体 | §5.2 → **0 rows** |
| B8 | TALK/MATCH seed 整合 | T1–T3 | buyer/seller/ban/verified と ID 一致 |

**dry-run 記録:** `reports/tasful-auth-hook-backfill-result.md`（**後続**）

**ロールバック訓練:** T1 metadata キー削除 → B2 再実行（§17）。

---

## 13. Hook ON 後の JWT 実測手順

**前提:** §11 PASS · Hook migration **CREATE 済み** · U-7 = **WARN（staging）**

| 順 | 作業 | 確認 |
|----|------|------|
| J1 | Dashboard → Hooks → function 選択 → **ON** | 担当 2 名確認 |
| J2 | T1 `refreshSession` | `talk_user_id` = Hook OFF 時と **同一** |
| J3 | T4 refresh | `is_ops=true` · `role=tasu_admin` |
| J4 | T5 login + refresh | token **発行** · Dashboard/Postgres **WARNING ログ** |
| J5 | `auth.jwt()` SQL | T1/T4 一致 · T5 NULL |
| J6 | `TasuAuthCurrentUser`（preview/local） | T1 `talkUserId` 一致 |
| J7 | Hook **OFF** リハーサル（§17） | login 継続 |
| J8 | Hook **ON** 再開 · 24h | error rate 正常 |

**禁止:** jwt.io · 本番 token · Hook ON と RLS ENABLE **同日**。

**成果物:** `reports/tasful-auth-hook-staging-jwt-result.md`（**後続**）

---

## 14. Edge smoke 再実行手順

**前提:** §13 PASS · `verifyJwt` 実装 PR merged · MATCH 7 functions **staging deploy のみ**

| 順 | 作業 | 参照 |
|----|------|------|
| E0 | ローカル回帰 | `node scripts/test-match-local-edge-smoke.mjs` PASS |
| E1 | staging deploy | `match-record-swipe` 等 7 件 |
| E2 | T1 `access_token` | §13 J2 |
| E3 | `Authorization: Bearer` · **no** `x-match-user-id` | |
| E4 | 7 functions 疎通 | 200/422 |
| E5 | T2 verified · T3 banned | 期待 status（ban は 403 等 · 設計どおり） |
| E6 | T4 admin JWT | `match-admin-review` · **no** prod header fallback |
| E7 | T5 token | 401/403 または WARN 継続（verify 実装次第 · 文書化） |
| E8 | 記録 | `match-staging-edge-smoke-result-signed-jwt.md` |

**凍結:** MATCH 新 Function · UI デフォルト `edge_stub` 変更 **禁止**。

---

## 15. RLS D2 適用前ゲート

`20260621140000_match_rls_d2_talk_user_id_draft.sql` 適用 **禁止** until ALL PASS:

| # | ゲート | 確認 |
|---|--------|------|
| G1 | JWT に `talk_user_id` | §13 J2–J5 |
| G2 | JWT = `TasuAuthCurrentUser.talkUserId` | §13 J6 |
| G3 | JWT = TALK `buyer_id`/`seller_id` | §12 B8 |
| G4 | JWT = `match_profiles.user_id` | T1–T3 seed |
| G5 | Edge `requireUser` = 同一 ID | §14 E4 |
| G6 | Hook ON · refresh 後も維持 | §13 J8 |
| G7 | cohort で `match_current_user_id()` NULL **0**（T5 除外定義） | SQL 監査 |

**適用順:** schema → seed → backfill → Hook → Edge smoke → `20260621130000` → `20260621140000` → RLS ENABLE（別 migration）。

---

## 16. Cloudflare preview / local 接続方針

| 項目 | 方針 | チェック |
|------|------|----------|
| **本番 `tasful.jp`** | staging ref **接続しない** | [ ] |
| **`chat-supabase-config.js`** | 本番 ref 固定 · **変更禁止** | [ ] |
| **ローカル** | `chat-supabase-config.staging.local.js` + pages dev | [ ] |
| **Preview branch** | `auth-hook-staging` 等 · env に staging anon のみ | [ ] |
| **切替** | 将来 `?supabaseStaging=1`（**本 PR 未実装**） | — |
| **talkProductionMode** | preview でも本番同等 lockdown 維持 | [ ] |
| **demo `u_me`** | localhost UI のみ · staging JWT 正ではない | [ ] |

---

## 17. rollback 方針

| シナリオ | 手順 | 目標時間 |
|----------|------|----------|
| **Hook 障害** | Dashboard → Hooks → **OFF** | **< 1 分** |
| **U-7 過剰 WARN** | Hook OFF → metadata 確認 | < 5 分 |
| **backfill 誤り** | Admin API merge 修正 · 影響 uuid のみ | < 15 分 |
| **T5 誤 backfill** | `talk_user_id` キー削除 | < 5 分 |
| **Edge verify 障害** | stub revert · staging redeploy | < 30 分 |
| **RLS 誤適用** | DISABLE migration · helper revert | 計画済み SQL |
| **staging 全体** | project pause/delete（**本番無影響**） | infra 判断 |

**Hook OFF 後:** backfill 済み metadata は JWT に残る · Hook 障害と metadata 欠落を **混同しない**。

---

## 18. 本番 ref `ddojquacsyqesrjhcvmn` を触らない確認

**ref 作成前 · 作成時 · 作成後 · 各検証フェーズで再確認**

| # | 確認項目 | 方法 |
|---|----------|------|
| P0 | Dashboard URL の ref | 目視 · `ddojquacsyqesrjhcvmn` でない |
| P1 | `chat-supabase-config.js` の ref | diff / `YOUR_PROJECT_REF` ≠ staging のみ local |
| P2 | `supabase link` project | `.supabase/project-ref` が staging のみ |
| P3 | Edge deploy target | `--project-ref {STAGING_REF}` 明示 |
| P4 | Admin API backfill URL | `https://{STAGING_REF}.supabase.co` |
| P5 | CI / GitHub secrets | `STAGING_*` と `PROD_*` 分離 |
| P6 | Cloudflare 本番 env | staging anon **未設定** |
| P7 | SQL 接続文字列 | staging DB のみ |
| P8 | 本番 Auth Hooks | **OFF のまま**（本番移行前） |

**チェックリスト:** 各フェーズ完了時に §18 を **全項目 [ ] 再実行**。

---

## 19. 実行禁止事項

1. 本番 ref で Custom Access Token Hook **ENABLE**
2. 本番 ref への **backfill / metadata 一括更新**
3. 本番 DB dump · seed · `\copy`
4. 本番 secrets を staging / repo に **平文コピー**
5. 本番ユーザー PII · チャット · KYC · 決済 · 通報 · storage 画像のコピー
6. `chat-supabase-config.js` への staging key **commit**
7. `tasful.jp` 本番 Pages / DNS / env **変更**
8. RLS D2 **本番適用**（G1–G7 前）
9. Hook ON と RLS ENABLE **同日**（staging 含む）
10. `user_metadata.talk_user_id` の使用
11. `sub` を `talk_user_id` として設定
12. T5 への `talk_user_id` backfill
13. `u_me` を staging 恒久 ID にする
14. MATCH **新機能** · UI デフォルト変更 · 凍結解除（Auth 検証以外）
15. jwt.io 等への token 送信
16. service_role を browser / client に露出
17. 本チェックリスト **未完了**のまま Hook ON
18. confidence ≠ `high` の自動 backfill
19. 本番 Stripe / LINE webhook を staging project に登録
20. staging 検証結果を **無ゲートで本番に適用**

---

## 20. 次ステップ

| 順 | アクション | 担当 | 成果物 | 本書との関係 |
|----|------------|------|--------|--------------|
| **1** | **本チェックリスト §2 完了** | ops + dev | 署名付き GO | **今ここ** |
| **2** | **手動: Supabase project 作成** | infra | §3 `[ ]` 実行 | `READY_FOR_STAGING_REF_CREATE_MANUAL` 後 |
| **3** | §4 作成後チェック · secrets 管理表 | ops | ref created レポート |
| **4** | migration + synthetic seed 適用 | dev | seed result |
| **5** | テストユーザー 5 + §12 backfill | dev | backfill result |
| **6** | §11 HOFF · §13 Hook ON（WARN） | dev | jwt result |
| **7** | Edge verify + §14 smoke | dev | signed JWT smoke |
| **8** | §15 G1–G7 → RLS D2 staging | dev | RLS apply result |
| **9** | 本番移行計画 | product | `staging-setup-plan.md` §15 |

**本書作成時:** §2–§20 は **計画・チェック項目のみ** · Supabase project **未作成**。

---

## 判定

### **READY_FOR_STAGING_REF_CREATE_MANUAL**

**理由**

- U-5 / U-7 · staging setup plan · dry-run 成果を **作成前/時/後** チェックに分解
- 5 ロール（T1 normal · T2 verified · T3 banned · T4 tasu_admin · T5 missing）を seed/backfill/検証に **明示マップ**
- コピー可/禁止 · secrets · 本番非接触（§18）· 禁止事項（§19）を **手動 ref 作成直前**に実行可能
- Hook OFF 確認 · backfill · JWT · Edge · RLS ゲートを **時系列**で固定

**NEEDS_DECISION:** なし

**次の人間作業:** Supabase Dashboard で **新規 project 作成**（§3）— 本 AI セッションでは **実施しない**。

---

## 参照

| ファイル | 用途 |
|----------|------|
| `reports/tasful-auth-hook-staging-setup-plan.md` | U-5/U-7 · 全体計画 |
| `reports/tasful-auth-hook-implementation-plan.md` | Phase 0–10 · G1–G7 |
| `reports/tasful-auth-hook-dry-run-review.md` | SQL/Hook 草案 · mapping |
| `supabase/migrations/202606211*.sql` | schema / RLS |
| `chat-supabase-config.example.js` | client テンプレート |
