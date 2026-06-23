# TASFUL — Auth Hook / JWT Claim linked ref 段階適用チェックリスト

| 項目 | 内容 |
|------|------|
| 版 | v1.0（チェックリストのみ · **SQL 未適用**） |
| 作成日 | 2026-06-21 |
| ステータス | **計画確定 · 実行未着手** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`**（現 linked · 開発兼本番予定） |
| 前提 | `tasful-auth-hook-dry-run-review.md`, `tasful-auth-hook-implementation-plan.md`, `tasful-auth-hook-staging-setup-plan.md` |
| 方針変更 | **専用 staging ref 新規作成 → 保留** · linked ref で段階適用 |
| 本書の範囲 | 適用順 · 事前 backup · rollback · 確認項目。**SQL 適用 · Hook 有効化 · Dashboard 変更は行わない** |

---

## 使い方

| 記号 | 意味 |
|------|------|
| `[ ]` | 未実施（各フェーズ実行時にチェック） |
| **ゲート** | 次フェーズへ進む条件（ALL PASS） |
| **禁止** | 該当フェーズで実施しない |
| **後続** | 本書作成後の手動/ops 作業 |

**原則:** 1 フェーズずつ · ゲート未達なら **停止** · Hook ON 中は担当 2 名 + `#ops-auth` 宣言。

**凍結継続:** MATCH 新機能追加禁止 · RLS D2 は G1–G7 通過まで適用禁止。

---

## 0. 方針変更サマリ

| 項目 | 旧（保留） | 新（本チェックリスト） |
|------|------------|------------------------|
| **U-5 infra** | A: 専用 staging ref | **保留** · linked ref `ddojquacsyqesrjhcvmn` で段階適用 |
| **環境** | staging / 本番分離 | **開発兼本番予定** · 同一 Auth/DB |
| **影響半径** | テスト ref のみ | **テストユーザー allowlist 限定** → 段階拡大 |
| **U-7** | staging WARN → 本番 P1/P2 | linked ref 上で **P1 WARN+監査 → P2 EXCEPTION**（専用 ref 無しでも同ロジック） |
| **リスク低減** | ref 分離 | backup · rollback · 変更窗口 · 全量禁止 |

**残存リスク（受容明示）:** Auth Hook SPOF が **本番 Auth と同一 project** · TALK RLS **既適用** — claim 順位整合を各ゲートで再確認。

---

## 1. 対象環境

| 項目 | 値 |
|------|-----|
| Project ref | `ddojquacsyqesrjhcvmn` |
| URL | `https://ddojquacsyqesrjhcvmn.supabase.co` |
| Client 設定 | `chat-supabase-config.js`（**本番 key 変更は別 PR · 本フェーズでは触らない**） |
| TALK RLS | **既適用** — `scripts/verify-talk-rls-staging.mjs` を各 Auth ゲート前に再実行推奨 |
| MATCH | schema/RLS **未適用**（migration 草案のみ） |
| Auth Hook | **未デプロイ · 未有効化** |

---

## 2. テストユーザー allowlist（linked ref）

**本番全ユーザー backfill 禁止。** 最初は **新規テスト専用アカウント** または **product 承認済み既存 1 件** のみ。

| ID | ロール | email（例 · `@tasful.invalid` 推奨） | talk_user_id（例） | backfill |
|----|--------|--------------------------------------|---------------------|----------|
| T1 | `normal_user` | `auth-hook-t1-normal@tasful.invalid` | `u_auth_test_001` | Phase L3 から |
| T2 | `match_verified_user` | `auth-hook-t2-verified@tasful.invalid` | `u_auth_test_002` | L3b 以降 |
| T3 | `banned_match_user` | `auth-hook-t3-banned@tasful.invalid` | `u_auth_test_003` | L3b 以降 |
| T4 | `tasu_admin` | `auth-hook-t4-admin@tasful.invalid` | `u_auth_test_ops` | L3b 以降 · `is_ops` |
| T5 | `missing_talk_user_id` | `auth-hook-t5-missing@tasful.invalid` | **常に未設定** | **禁止** |

- [ ] allowlist UUID を **repo 外** mapping CSV + secrets 管理表に記録
- [ ] `u_me` / demo ID を allowlist に **含めない**
- [ ] 既存本番ユーザーを T1 に **指定しない**（除非 product 書面承認）

---

## 3. 段階適用順（全体）

```text
L0  READ-ONLY 棚卸し · mapping CSV        ← 本書時点の次アクション候補
L1  事前 backup ベースライン
L2  allowlist 確定 · テストユーザー作成/確認
L3  backfill: T1 のみ · Hook OFF
L4  JWT refresh 実測 · Hook OFF
L5  Hook 関数 SQL CREATE · Dashboard OFF
L6  Hook ENABLE · U-7 P1（WARN + 監査）· 変更窗口
L7  backfill 拡大: T2–T4 → 10 → 100 → cohort（各段ゲート）
L8  Edge verifyJwt deploy（MATCH 7 のみ）
L9  Edge smoke（署名 JWT）
L10 MATCH schema migration（必要時 · synthetic seed）
L11 RLS helper + D2（G1–G7 後）
L12 U-7 P2: EXCEPTION / login 拒否（G-U7 後）
```

| フェーズ | SQL / Dashboard | 影響範囲 |
|----------|-----------------|----------|
| L0–L2 | **なし** | なし |
| L3–L4 | Admin API のみ | allowlist 1 件 |
| L5 | migration CREATE · Hook **OFF** | DB 関数追加 · token 挙動不变 |
| L6 | Dashboard Hook **ON** | **全 Auth ユーザー**（token 発行経路） |
| L7 | Admin API | allowlist 拡大単位 |
| L8–L9 | Edge deploy | MATCH Functions |
| L10–L11 | migration | MATCH テーブル/RLS |
| L12 | Hook SQL 差替 | 欠落 user login 拒否 |

**絶対順序:** L6 以前に RLS D2 **禁止** · L6 と L11 **同日禁止** · L7 全量 **L6 安定後**。

---

## 4. フェーズ別 — 事前 backup チェックリスト

### 4.1 共通 backup（L1 · 初回 1 回 + 各 WRITE フェーズ前に更新）

| # | 項目 | 方法 | 保管 |
|---|------|------|------|
| B1 | **Supabase logical backup / PITR 確認** | Dashboard → Database → Backups · Pro PITR 有無確認 | ops 記録 |
| B2 | **`auth.users` metadata スナップショット** | READ: `id, email, raw_app_meta_data, updated_at` · allowlist + 直近 100 件 | repo 外 · 暗号化 storage |
| B3 | **mapping CSV 版固定** | dry-run §2 形式 · git tag または dated ファイル | repo 外 |
| B4 | **Hook OFF 手順書** | §6.1 印刷/ピン留め | 担当全員 |
| B5 | **rollback migration 草案** | Hook DROP · RLS DISABLE 案を PR 上でレビュー済み | repo migrations |
| B6 | **Dashboard 設定スクショ** | Auth → Hooks · URL · Providers | ops 記録 |
| B7 | **Edge Functions リビジョン** | `supabase functions list` または Dashboard | L8 前 |

- [ ] B1–B7 完了 · 日時 · 担当者記録
- [ ] backup 復元手順（PITR または metadata リスト）を **1 段落で** 文書化

### 4.2 フェーズ別 backup（追加）

| フェーズ | 追加 backup | チェック |
|----------|-------------|----------|
| **L3** backfill 前 | T1 の `raw_app_meta_data` 単行 export | [ ] |
| **L5** Hook CREATE 前 | `pg_proc` / migration 前 DB スキーマ export（public） | [ ] |
| **L6** Hook ON 前 | B1–B7 **再実行** · 変更窗口開始宣言 | [ ] |
| **L7** 各拡大段 | 対象 uuid リスト + 各 user metadata スナップショット | [ ] |
| **L10** schema 前 | public テーブル一覧 · 既存 TALK 関連 policy 一覧 export | [ ] |
| **L11** RLS 前 | policy 定義 export · `verify-talk-rls-staging.mjs` 結果保存 | [ ] |

### 4.3 backup 禁止

| 禁止 | 理由 |
|------|------|
| service_role / JWT secret を backup ファイルに **平文同梱** | 漏洩 |
| チャット本文・KYC 画像の **不要 full dump** | 最小収集原則 |
| backup を **public repo** に commit | セキュリティ |

---

## 5. フェーズ別 — rollback チェックリスト

### 5.1 即時 rollback（優先度順）

| トリガー | 第 1 手 | 第 2 手 | 目標 |
|----------|---------|---------|------|
| login 急増失敗 | Dashboard Hook **OFF** | Auth logs 確認 | **< 1 分** |
| 誤 mapping 1 件 | Admin API metadata 修正 | 対象 user refresh | < 15 分 |
| Hook SQL 例外多発 | Hook **OFF** | migration revert 検討 | < 5 分 |
| TALK RLS 異常 | **Hook OFF では直らない** — policy/migration revert | `verify-talk-rls-staging.mjs` | 計画済み SQL |
| Edge 5xx | Functions 前リビジョン redeploy | verify 一時 stub 化 | < 30 分 |

### 5.2 フェーズ別 rollback 手順

| フェーズ | rollback | 確認 |
|----------|----------|------|
| **L3** backfill | Admin API: `talk_user_id` / `member_id` キー削除または B2 スナップショット復元 | T1 JWT 旧状態 |
| **L4** | L3 rollback · refresh | — |
| **L5** Hook CREATE | `DROP FUNCTION public.custom_access_token_hook(jsonb)` migration（事前草案） | Hook OFF のまま |
| **L6** Hook ON | Dashboard **OFF** · 監視 15 分 | login 率回復 |
| **L7** 拡大 | 当該段 uuid の metadata revert（CSV 正値） | 重複 SQL §7.2 = 0 |
| **L8–L9** Edge | git revert + redeploy · client `client_stub` 維持 | smoke PASS |
| **L10** schema | DROP TABLE 順序 migration（**事前レビュー必須**） | TALK 無影響確認 |
| **L11** RLS | DISABLE policy migration · `match_current_user_id` revert | TALK verify PASS |
| **L12** U-7 P2 | Hook SQL を P1 `warn_audit` に差替 · redeploy | 欠落 user login 再開 |

- [ ] 各フェーズ開始前に **当該 rollback 行を読み上げ**（担当 2 名）
- [ ] L6 前: Hook OFF リハーサル **1 回実施済み**（ゲート）

**Hook OFF 後の JWT:** `app_metadata` は Supabase 標準で JWT に含まれる · backfill 済みなら `talk_user_id` **残る** · Hook 障害 ≠ metadata 欠落。

---

## 6. フェーズ別 — 確認項目チェックリスト

### L0 — READ-ONLY 棚卸し（**次アクション · SQL 適用なし**）

| # | 確認 | 方法 | 期待 |
|---|------|------|------|
| L0-1 | auth.users 件数 · 既存 `app_metadata` キー | READ SQL dry-run §5.1 | ベースライン記録 |
| L0-2 | TALK buyer/seller 母集団 | READ §5.3–5.4 | mapping 入力 |
| L0-3 | `talk_user_id` 重複 | READ §5.2 | **0 rows**（既存に重複あれば **停止**） |
| L0-4 | demo / `u_me` 本番 cohort | READ §5.6 | product 判断記録 |
| L0-5 | mapping CSV 草案 | dry-run §2 | confidence 付与 |
| L0-6 | TALK RLS 現状 | `node scripts/verify-talk-rls-staging.mjs` | PASS または既知差分記録 |

- [ ] L0-1 … L0-6
- [ ] **ゲート:** mapping CSV レビュー GO · 重複なし · allowlist 方針合意

---

### L1 — 事前 backup ベースライン

- [ ] §4.1 B1–B7
- [ ] **ゲート:** backup 日時記録 · 復元手順 1 段落 · 担当 2 名確認

---

### L2 — allowlist · テストユーザー

| # | 確認 | 期待 |
|---|------|------|
| L2-1 | T1–T5 作成または既存確認 | UUID 管理表記録 |
| L2-2 | T5 metadata 欠落 | `talk_user_id` NULL |
| L2-3 | 本番一般ユーザー backfill | **未実施** |

- [ ] L2-1 … L2-3
- [ ] **ゲート:** §2 allowlist 確定

---

### L3 — backfill T1 のみ · Hook OFF

**事前:** §4.2 L3 backup · Dashboard Hook **OFF** 確認

| # | 確認 | 期待 |
|---|------|------|
| L3-1 | Admin API merge T1 のみ | `talk_user_id` = mapping |
| L3-2 | `member_id` = `talk_user_id` | D-3 |
| L3-3 | 他 uuid metadata | **不変** |
| L3-4 | READ §5.5 T1 | `member_id_check=ok` |

- [ ] L3-1 … L3-4
- [ ] **ゲート:** 単一 uuid のみ変更 · rollback L3 手順確認済み

---

### L4 — JWT refresh · Hook OFF

| # | 確認 | 期待 |
|---|------|------|
| L4-1 | T1 login · 旧 token decode | 旧 claim の可能性 → refresh 必須 |
| L4-2 | `refreshSession()` | 新 token に `app_metadata.talk_user_id` |
| L4-3 | `auth.jwt()` SQL（T1 セッション） | 同一 ID |
| L4-4 | `TasuAuthCurrentUser`（該当端末） | `talkUserId` 一致 |
| L4-5 | T5 login | JWT に `talk_user_id` **無** · login **成功** |

- [ ] L4-1 … L4-5
- [ ] **ゲート:** L4-2–L4-4 同一値 · NULL なし（T5 除く）

---

### L5 — Hook 関数 CREATE · Dashboard OFF

**事前:** §4.2 L5 backup · migration PR merged

| # | 確認 | 期待 |
|---|------|------|
| L5-1 | `custom_access_token_hook` EXISTS | `pg_proc` または Dashboard |
| L5-2 | GRANT `supabase_auth_admin` | 公式どおり |
| L5-3 | Dashboard Hook | **まだ OFF** |
| L5-4 | T1 refresh · Hook OFF | L4 と **同じ** claim |

- [ ] L5-1 … L5-4
- [ ] **ゲート:** token 挙動 **変化なし**（CREATE のみ）

---

### L6 — Hook ENABLE · U-7 P1（WARN + 監査）

**事前:** §4.2 L6 backup · 変更窗口 · `#ops-auth` 宣言 · rollback リハーサル済み

| # | 確認 | 期待 |
|---|------|------|
| L6-1 | Dashboard Hook **ON** | 担当 2 名 |
| L6-2 | T1 refresh | claim = L4 と同一 |
| L6-3 | T4 refresh | `is_ops` / `tasu_admin` |
| L6-4 | T5 refresh | token **発行** · **監査ログ**に WARNING |
| L6-5 | Auth error rate · login 成功率 | 15 分 · 30 分 · 24h 監視 |
| L6-6 | `verify-talk-rls-staging.mjs` | PASS または差分説明 |

- [ ] L6-1 … L6-6
- [ ] **ゲート:** L6-5 異常なし · L6-2–L6-3 維持 · **即 OFF 手順待機**

---

### L7 — backfill 段階拡大

| 段 | 対象 | 事前 backup | ゲート |
|----|------|-------------|--------|
| L7a | T2–T4 | 各 uuid metadata | L4 相当 + 重複 0 |
| L7b | +10 uuid（confidence high） | 10 件 snapshot | 同上 |
| L7c | +100 uuid | バッチ snapshot | 同上 |
| L7d | 残 cohort | 段階ごと | G-U7-1: missing=0 |

- [ ] 各段: READ §5.2 · §5.3 · T5 **未 backfill**
- [ ] **禁止:** L6 不安定時の拡大 · 全量一括

---

### L8 — Edge verifyJwt（MATCH のみ）

| # | 確認 | 期待 |
|---|------|------|
| L8-1 | `match-auth.ts` verifyJwt 本実装 | PR merged |
| L8-2 | MATCH 7 functions redeploy | linked ref のみ |
| L8-3 | Stripe/GenAI functions | **未変更** |

- [ ] L8-1 … L8-3
- [ ] **ゲート:** ローカル回帰 PASS

---

### L9 — Edge smoke（署名 JWT）

| # | 確認 | 期待 |
|---|------|------|
| L9-1 | T1 Bearer token · no `x-match-user-id` | 200/422 |
| L9-2 | 7 functions 疎通 | 計画どおり |
| L9-3 | T4 admin JWT | admin function |
| L9-4 | 記録 | `match-staging-edge-smoke-result-signed-jwt.md` |

- [ ] L9-1 … L9-4
- [ ] **ゲート:** G5 相当 PASS

---

### L10 — MATCH schema（必要時）

**事前:** §4.2 L10 backup · **TALK テーブル無変更** 確認

- [ ] `20260621120000_match_schema_draft.sql` 適用
- [ ] synthetic seed（allowlist ID のみ · §8 staging-setup 相当）
- [ ] TALK 行数・policy **不変** 確認

---

### L11 — RLS D2（G1–G7 必須）

| # | ゲート | 確認 |
|---|--------|------|
| G1 | JWT `talk_user_id` | L4/L6 |
| G2 | TasuAuthCurrentUser | L4 |
| G3 | TALK buyer/seller | L7 + session |
| G4 | match_profiles.user_id | L10 seed |
| G5 | Edge requireUser | L9 |
| G6 | Hook ON refresh | L6 |
| G7 | `match_current_user_id()` NULL cohort 0 | SQL · T5 除外定義 |

- [ ] G1–G7 ALL PASS
- [ ] `20260621130000` → `20260621140000` → RLS ENABLE（別 migration）
- [ ] `verify-talk-rls-staging.mjs` **再 PASS**
- [ ] **禁止:** G 未達で ENABLE

---

### L12 — U-7 P2 EXCEPTION

| # | 確認 | 期待 |
|---|------|------|
| L12-1 | G-U7-1 missing `talk_user_id` = 0 | SQL |
| L12-2 | P1 WARN 7 日 0 件 | 監査 |
| L12-3 | product 書面 GO | 記録 |
| L12-4 | Hook SQL `reject` 切替 | T5 login **拒否** |
| L12-5 | rollback P1 リハーサル | 済み |

- [ ] L12-1 … L12-5

---

## 7. U-7（linked ref 上の段階移行）

| 段階 | Hook モード | 欠落 user | 適用フェーズ |
|------|-------------|-----------|--------------|
| **P1** | `warn_audit` | login **可** · 監査ログ必須 | **L6 から** |
| **P2** | `reject` / EXCEPTION | login **拒否** | **L12**（G-U7 後） |

- [ ] L6 では **P1 のみ** · P2 **禁止**
- [ ] 監査ログ項目: `auth_user_id`, `email`, `timestamp`, `hook_mode`

---

## 8. 横断 — 各 WRITE フェーズ前チェック（短表）

| チェック | L3 | L5 | L6 | L7 | L10 | L11 |
|----------|:--:|:--:|:--:|:--:|:---:|:---:|
| §4 backup 更新 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| rollback 読み上げ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 担当 2 名 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `#ops-auth` 宣言 | | | ✓ | ✓ | ✓ | ✓ |
| Hook OFF 確認 | ✓ | ✓ | | | ✓ | ✓ |
| verify-talk-rls | ✓ | | ✓ | | ✓ | ✓ |
| MATCH 凍結遵守 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 9. 実行禁止事項（linked ref 段階適用）

1. L0 ゲート前の **backfill / migration / Hook**
2. allowlist 外 uuid への metadata 更新
3. L6 前の Hook Dashboard **ON**
4. L6 と L11 **同日**実施
5. G1–G7 前の RLS D2 ENABLE
6. L6 監視異常時の L7 拡大
7. 全 auth.users **一括 backfill**
8. T5 への `talk_user_id` 設定
9. `user_metadata.talk_user_id` · `sub` を業務 ID に使用
10. backup 無しの L5/L6/L11
11. service_role の client 露出
12. MATCH 新機能 · UI デフォルト `edge_stub` 変更
13. jwt.io 等への token 送信
14. P2 EXCEPTION を G-U7 前に有効化
15. 専用 staging ref 前提の手順を **確認なく** 混在実行

---

## 10. 関連ドキュメント

| ファイル | 用途 |
|----------|------|
| `tasful-auth-hook-dry-run-review.md` | SQL/Hook 草案 · 検証 SQL |
| `tasful-auth-hook-implementation-plan.md` | §5 本番 ref 最小リスク · §11 G1–G7 |
| `tasful-auth-hook-staging-setup-plan.md` | U-7 · seed 方針（**ref 作成は保留**） |
| `tasful-auth-hook-staging-ref-checklist.md` | 専用 ref 用 · **保留** |

---

## 11. 次ステップ

| 順 | 作業 | フェーズ | SQL/WRITE |
|----|------|----------|-----------|
| **1** | **本チェックリスト §L0 実行** | 棚卸し READ | **なし** |
| 2 | mapping CSV · allowlist 確定 | L0–L2 | なし |
| 3 | §4.1 backup | L1 | なし |
| 4 | T1 backfill | L3 | Admin API のみ |
| 5 | 以降 L4→… | 段階 | ゲート順守 |

**本書作成時:** **SQL 適用なし** · Hook **OFF** · 次は **L0 READ-ONLY**。

---

## 判定

### **READY_FOR_LINKED_REF_L0_INVENTORY**

**理由**

- 専用 staging ref **保留** · linked ref 段階適用方針を **適用順 · backup · rollback · 確認** に分解
- 実装計画 §5（P0–P6）と dry-run 成果を **L0–L12** にマップ
- テスト allowlist · U-7 P1/P2 · TALK RLS 既存リスクを **ゲート化**
- **次アクションは L0（READ-ONLY）のみ** — SQL 適用はまだ不要

**NEEDS_DECISION**

| 項目 | 内容 |
|------|------|
| （任意） | 既存本番ユーザーを T1 に使うか **新規 `@tasful.invalid` のみ**か — product 確認推奨 |
| （任意） | Supabase Pro PITR の有無 — backup B1 で確定 |

**保留（触らない）:** 専用 staging ref 新規作成（`staging-ref-checklist.md`）
