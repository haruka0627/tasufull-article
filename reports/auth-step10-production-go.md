# P1-A5 STEP 10 — 本番 Auth GO 判定準備

**作成日:** 2026-06-18  
**種別:** 計画・判定準備（**コード / DB 変更は本 STEP では未実施**）  
**スコープ:** **AUTH-RB-1** · **AUTH-RB-2** の解消のみ（STEP 9 の他 BLOCKER は対象外）  
**参照:** [`auth-step9-e2e-final.md`](auth-step9-e2e-final.md) · [`auth-step8b-legacy-rls-fix.md`](auth-step8b-legacy-rls-fix.md)

---

## 現状サマリ

| BLOCKER | 内容 | 現状 |
|---------|------|------|
| **AUTH-RB-1** | legacy RLS 本番未適用 | linked DB `ddojquacsyqesrjhcvmn` へ **STEP 8B SQL 適用済**（2026-06-18）。`tasful.jp` 向け **inventory 再確認・別プロジェクト有無の確認** が未完了 |
| **AUTH-RB-2** | `tasful.jp` 実機 Auth smoke 未実施 | **NB-1**（DNS / 静的ホスト）未稼働のため実機検証 **未着手** |

### 本 STEP の位置づけ

STEP 10 は **実行計画 + 判定条件の固定**。実際の本番適用・実機 smoke は **STEP 10-EXEC**（別作業）で実施する。

---

# Phase A — legacy RLS 本番適用計画

## A-0. 前提確認（適用前必須）

| # | 確認項目 | コマンド / 方法 | 期待 |
|---|----------|-----------------|------|
| 1 | 本番 Supabase プロジェクト ref | Dashboard / デプロイ設定 | `ddojquacsyqesrjhcvmn` と同一か別 ref かを文書化 |
| 2 | `talk_current_user_id()` / `talk_is_admin()` 存在 | `select proname from pg_proc where proname like 'talk_%'` | 2 関数あり |
| 3 | `transaction_rooms` スキーマ | `\d transaction_rooms` 相当 | `buyer_id` / `seller_id` あり。**`partner_id` 無し**（8B 修正済 SQL 前提） |
| 4 | `*_dev` ポリシー | `sql/dev-rls-p0-post-check.sql` | **0 件** |
| 5 | AUTH-H-1 パッチ | Phase C 参照 | **本番適用 SQL に同梱または先行適用** |

**同一プロジェクトの場合:** 8B は適用済みのため Phase A は **inventory 再監査 + prod 向け probe** が中心。  
**別プロジェクトの場合:** 以下 A-1〜A-5 をその DB に対して実施。

---

## A-1. 適用順（推奨）

```
[0] メンテ告知（任意 · 読取中心のためダウンタイムほぼなし）
[1] 適用前 inventory 保存
      node scripts/verify-auth-step8-rls-inventory.mjs
      → reports/auth-step10-prod-pre-inventory.json
[2] pg_policies スナップショット（ロールバック用）
      npx supabase db query --linked --yes \
        "SELECT tablename, policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname='public' ORDER BY 1,2;"
[3] AUTH-H-1 パッチ適用（Phase C — 本番前必須）
      sql/auth-step10-review-scores-public-read.sql（新規 · 下記 §Phase C）
[4] legacy RLS 本体適用
      npx supabase db query --linked --yes \
        -f sql/auth-step8-legacy-chat-rls-proposal.sql
[5] 適用後 inventory
      → reports/auth-step10-prod-post-inventory.json
[6] legacy 専用 probe
      node scripts/verify-auth-step8b-legacy-rls.mjs
[7] 横断 RLS 回帰（ステージングと同セット）
      verify-talk-rls-staging.mjs
      verify-marketplace-rls.mjs
      verify-anpi-rls-real-db.mjs
[8] 本番 JWT で transaction chat / favorites / review 手動 smoke（Phase B 一部）
```

**重要:** `[3]` を省略すると、公開詳細の信頼スコア表示と `review_scores` upsert が壊れる（Phase C 参照）。

---

## A-2. ロールバック計画

| 段階 | 操作 | 所要 |
|------|------|------|
| **判断** | legacy テーブルで当事者が READ 不可 / 全面拒否が 15 分継続 | — |
| **即時** | 新規ポリシー DROP + 旧 `Allow all` 復元 | 5〜10 分 |
| **根拠** | `[2]` の pg_policies スナップショット | — |
| **復元後** | inventory 再取得 · 障害記録 | 10 分 |

### ロールバック SQL（テンプレート）

`reports/auth-step10-prod-pre-policies.json` から復元。代表例:

```sql
-- 緊急時のみ · 8B で DROP した Allow all を復元（セキュリティ後退）
-- create policy "Allow all transaction_rooms" on public.transaction_rooms for all using (true) with check (true);
-- … 他テーブル同様 …
```

**注意:** ロールバックは **anon 全公開に戻る** ため一時措置のみ。復旧後は AUTH-H-1 パッチ込みで再適用。

### 部分ロールバック（テーブル単位）

| 症状 | 対象 | 操作 |
|------|------|------|
| 取引チャットのみ不通 | `transaction_rooms` / `transaction_messages` | 当該ポリシーのみ DROP → 旧 policy 復元 |
| お気に入りのみ | `favorites` | `favorites_*_own` DROP → 旧 public favorites 復元 |
| 信頼スコア表示のみ | `review_scores` | `review_scores_select_authenticated` DROP → Allow all 復元 **または** public view のみ修正 |

---

## A-3. 所要時間（見積）

| フェーズ | 作業者 | 時間 |
|----------|--------|------|
| 前提確認 A-0 | 1 名 | 15〜30 分 |
| inventory + スナップショット | 自動 + 1 名 | 10 分 |
| SQL 適用（H-1 + 8B） | 1 名 | 5〜10 分 |
| probe + RLS 回帰 | 自動 | 15〜20 分 |
| 手動 transaction / review smoke | 1 名 | 20〜30 分 |
| **合計** | | **約 1〜2 時間**（ロールバック含めず） |

**メンテナンスウィンドウ推奨:** 低トラフィック帯 2 時間枠（実ダウンタイムは想定 **0 分** · ポリシー切替のみ）。

---

## A-4. 影響範囲

### 直接影響（意図した変更）

| テーブル | anon | authenticated 一般 | ops/admin | service_role |
|----------|------|-------------------|-----------|--------------|
| `transaction_rooms` | **拒否** | buyer/seller 当事者のみ | `talk_is_admin()` 可 | バイパス |
| `transaction_messages` | **拒否** | room 参加者 + sender insert | admin 経由 participant | バイパス |
| `transaction_reads` | **拒否** | 本人 `user_id` | admin read | バイパス |
| `reviews` | **拒否** | 当事者 / room 参加者 | admin | バイパス |
| `favorites` | **拒否** | 本人 CRUD | admin select/delete | バイパス |
| `review_scores` | **拒否**（H-1 パッチ後は **view 経由のみ公開**） | SELECT（パッチ後は行単位 or view） | — | upsert 推奨 |
| `chats` / `ai_messages` | **拒否** | **拒否**（ポリシーなし） | — | バイパス |
| `blocked_users` / `monthly_usage` | **拒否** | **拒否** | — | バイパス |

### 機能別影響

| 機能 | 影響 | 緩和 |
|------|------|------|
| 取引チャット（`chat-supabase.js`） | JWT `talk_user_id` 必須 · 未ログインは room 不可 | 既存 Auth ログイン導線 |
| レビュー投稿 | `reviews` insert は当事者ポリシー · `review_scores` upsert は **H-1 パッチ必須** | Edge / trigger / 限定 upsert policy |
| 商品詳細の信頼スコア | anon 直 READ 不可 → **H-1 パッチで public view** | `detail-trust-score.js` は view 向けに切替 |
| お気に入り | ログイン必須 | 既存会員導線 |
| レガシー AI `chats` 直読み | 全面 deny | コードベースに直参照 **なし**（Phase C） |
| TALK 通知 / 市場公開閲覧 / 安否 | **影響なし**（別 RLS · STEP 9 PASS） | — |

### 影響外（本 STEP スコープ外）

- Builder MVP localStorage（NB-2）
- Stripe Connect 実 API（NB-6/7）
- `shop_orders` 未デプロイ（NB-5）
- TALK 通話 Push / TURN（NH-1/2）

---

# Phase B — `tasful.jp` 実機 Auth Smoke 計画

## B-0. 前提

| 項目 | 要件 |
|------|------|
| Origin | `https://tasful.jp`（`www` も 1 回確認） |
| `talkDev=1` / `?userId=` | **使用禁止**（本番 fallback 遮断の検証目的） |
| Supabase | 本番 `chat-supabase-config.js` · **実 Auth ログイン** |
| テストユーザー | 事前に `app_metadata.talk_user_id` / `member_id` / `is_ops` を設定済み |
| 記録 | スクリーンショット + `reports/auth-step10-prod-smoke-results.json`（EXEC 時） |

**NB-1 未解消時:** Phase B は **実施不可** → AUTH-RB-2 は **NO-GO** のまま。

### 推奨テストユーザー（例）

| ロール | talk_user_id | claims |
|--------|--------------|--------|
| 一般会員 A | `prod_smoke_member_a` | `talk_user_id`, `member_id` |
| 一般会員 B | `prod_smoke_member_b` | 同上 |
| ops | `prod_smoke_ops` | `is_ops: true` または `role: tasu_admin` |
| Connect 未完了 | `prod_smoke_connect_pending` | DB: payout 未 ready |
| Connect 完了 | `prod_smoke_connect_ready` | DB: `payout_enabled` / active |
| Builder 当事者 | `prod_smoke_builder_owner` | DB: 案件 owner / applicant |
| Builder 非当事者 | `prod_smoke_builder_stranger` | 同上案件に無関係 |
| 市場 seller | `prod_smoke_seller` | 自出品あり |
| 市場 buyer | `prod_smoke_buyer` | 他者出品閲覧のみ |

---

## B-1. シナリオ別期待結果

### 1. 未ログイン

| 確認 | 操作 | 期待結果 |
|------|------|----------|
| Fallback 遮断 | `tasful.jp` で `?userId=u_me` / `?talkAdmin=1` を付与 | **無視** · LS に userId を書かない · `getCurrentUser()` は null |
| 市場公開閲覧 | `index.html` / 商品詳細（公開 listing） | **閲覧可** · safe view 経由 · draft は不可 |
| 信頼スコア | 公開 seller 詳細 | **H-1 パッチ後:** `public_review_scores` から集計表示。**パッチ前:** 新規ユーザー表示 or デモ fallback のみ |
| 取引チャット | `chat-detail.html` 直打ち | **メッセージ読込不可**（JWT なし · RLS 拒否）またはログイン誘導 |
| お気に入り | favorites API / UI | **操作不可** |
| ops 画面 | `admin-operations-dashboard.html` | **ガードで拒否** · データ非表示 |
| payment-settings | 直アクセス | **未ログイン UI** · Connect ready を LS で偽装不可 |

### 2. 一般会員（会員 A）

| 確認 | 操作 | 期待結果 |
|------|------|----------|
| Identity | ログイン後 `getCurrentUser().talkUserId` | JWT と一致 · URL で上書き不可 |
| 自分の通知 | `talk-home.html?tab=notify` | **自分の通知のみ** |
| 他人の通知 | REST で B の `user_id` 指定 | **0 件** |
| 取引 room | A が buyer/seller の room | **READ/WRITE 可** |
| 他人の room | B の room を A が参照 | **0 件 / 403** |
| お気に入り | 自分の favorites CRUD | **可** |
| 安否 | 自分の context | **可** · 他人は不可 |

### 3. ops（`is_ops` / `tasu_admin`）

| 確認 | 操作 | 期待結果 |
|------|------|----------|
| 司令塔 | `admin-operations-dashboard.html` | **表示可** · LS/URL 昇格なし |
| ops テーブル | `support_tickets` / `ai_ops_cases` / `connect_issues` | **READ 可** |
| 一般画面 | 通常 TALK / 市場 | **一般会員と同様**（データは ops 権限分のみ追加） |
| なりすまし | `?talkAdmin=1` のみ（JWT なし） | **拒否** |

### 4. Connect 未完了

| 確認 | 操作 | 期待結果 |
|------|------|----------|
| 状態源 | `payment-settings.html` | **DB snapshot** · `connect-state.js` · LS `sellerStatus` **無視** |
| UI step | onboarding | `top` / `identity` / `reviewing` 等 · **`ready` にならない** |
| 売上受取 CTA | payout 導線 | **非表示 or ガード** |
| Connect ready 偽装 | LS に `ready` 書込 | **本番 host で無効** |

### 5. Connect 完了

| 確認 | 操作 | 期待結果 |
|------|------|----------|
| DB 状態 | `payout_enabled` / active | **ready 表示** |
| 売上導線 | payout / sales-fees | **表示可**（Stripe 実 API は別 BLOCKER） |
| 未完了ユーザー | 上記 DB でないユーザー | **ready にならない** |

### 6. Builder 当事者

| 確認 | 操作 | 期待結果 |
|------|------|----------|
| Actor | `builder-actor-identity.js` | JWT `talk_user_id` + DB 応募/掲載で role 解決 |
| Owner 画面 | `board-project-detail.html?view=applications` | **操作可** |
| 応募 / 採用 / 完了 | 当事者フロー | **可**（LS の `role=` 単独では不可） |
| MVP 状態 | localStorage | **依然 LS**（NB-2 · 本 STEP 外）だが **actor は JWT 基準** |

### 7. Builder 非当事者

| 確認 | 操作 | 期待結果 |
|------|------|----------|
| Owner URL 直打ち | 他人案件の owner view | **操作不可** · 空 / エラー |
| 応募者として | 自分が applicant の案件 | ** applicant として可**（別シナリオ） |
| JWT 偽装 | URL `role=owner` のみ | **拒否** |

### 8. 市場 buyer

| 確認 | 操作 | 期待結果 |
|------|------|----------|
| Identity | `market-identity.js` | buyer = JWT `talk_user_id` |
| 公開商品 | 一覧 / 詳細 | **閲覧可** |
| 他者 draft | seller B の下書き | **不可** |
| 他人名義出品 | INSERT `user_id` ≠ JWT | **拒否** |
| payment_url | 非 owner | **safe view に非表示** |

### 9. 市場 seller

| 確認 | 操作 | 期待結果 |
|------|------|----------|
| Identity | seller 解決 | JWT + 自 `listings.user_id` |
| 自出品 CRUD | 下書き / 公開 | **可** |
| 自 `payment_url` | base `listings` | **owner のみ READ** |
| 他人出品 UPDATE | B の listing | **拒否** |

---

## B-2. Smoke 実施手順（EXEC 時）

```bash
# 1. 本番 origin 到達確認
curl -sI https://tasful.jp/

# 2. 認証ヘルパー（本番 host シミュレーション — ローカル補助）
node scripts/test-auth-step7-fallback-lockdown.mjs   # 回帰

# 3. 本番向け smoke（EXEC で新規スクリプト化推奨）
#    PROD_BASE=https://tasful.jp node scripts/test-auth-step10-production-smoke.mjs

# 4. RLS probe（本番 .env / --project-ref 切替）
node scripts/verify-auth-step8b-legacy-rls.mjs
```

**合格基準:** 上記 9 シナリオすべて期待結果一致 · **認証 fallback 経路 0 件**。

---

# Phase C — AUTH-H-1 / AUTH-H-2 判定

## AUTH-H-1 — `review_scores`

### 現状（8B 適用後）

| 項目 | 状態 |
|------|------|
| `Allow all review_scores` | **DROP 済** |
| 現行ポリシー | `review_scores_select_authenticated` — `(user_id IS NOT NULL OR IS NULL)` ≒ **authenticated 全行 READ** |
| anon SELECT | **不可** |
| INSERT / UPDATE ポリシー | **なし** → クライアント `upsert` **拒否** |

### コード依存

| ファイル | 動作 |
|----------|------|
| [`detail-trust-score.js`](../detail-trust-score.js) | anon / 未ログインで `review_scores` 直 SELECT |
| [`chat-supabase.js`](../chat-supabase.js) | レビュー後 `review_scores` **upsert** |

### 判定: **本番前修正必須**（8B 本番適用と同時または先行）

| 理由 | 深刻度 |
|------|--------|
| 公開商品詳細で信頼スコアが消える（anon 不可） | **機能退行** |
| レビュー完了後のスコア更新が RLS で失敗 | **機能退行** |
| authenticated 全行 READ は anon よりマシだが **横断閲覧可能** | **セキュリティ MEDIUM**（PII なし集計のみ） |

### 推奨パッチ（STEP 10-EXEC · 新規 SQL）

```
sql/auth-step10-review-scores-public-read.sql（計画）

1. CREATE VIEW public.public_review_scores AS
     SELECT user_id, average_rating, total_reviews, skipped_reviews, updated_at
     FROM public.review_scores;

2. GRANT SELECT ON public.public_review_scores TO anon, authenticated;

3. RLS on view または security_barrier view で行公開

4. review_scores 本体:
   - DROP review_scores_select_authenticated（全行 READ）
   - authenticated SELECT: user_id = talk_current_user_id() OR talk_is_admin()（任意）
   - INSERT/UPDATE: service_role のみ、または
     SECURITY DEFINER trigger ON reviews INSERT → review_scores 更新

5. detail-trust-score.js: .from('public_review_scores') へ切替（最小 1 行 · EXEC 時）
```

**後追い不可の理由:** 8B を本番（または未パッチ DB）に適用した時点で **即退行** するため。

---

## AUTH-H-2 — `chats` / `ai_messages`

### 現状（8B 適用後）

| 項目 | 状態 |
|------|------|
| RLS | **有効** |
| クライアント用ポリシー | **なし** → 全面 deny |
| service_role | バイパス可 |

### コード依存調査

| 調査 | 結果 |
|------|------|
| `.from('chats')` / `.from('ai_messages')` | **リポジトリ内 JS に直参照なし** |
| `dashboard-mobile-home.js` の `chats` | **変数名のみ**（mock threads） |
| `gen-ai-workspace.js` | Storage のみ · chats テーブル未使用 |

### 判定: **後追い可能**（本番 GO のブロック条件に含めない）

| 条件 | 内容 |
|------|------|
| 本番 GO 時 | 8B の deny 方針を維持して **問題なし** |
| 監視 | 適用後 1 週間 · Supabase log で `chats` / `ai_messages` REST 403 急増がないか |
| 将来 | レガシー AI 会話を Supabase 直読する場合は **user 列追加 + ポリシー設計** が別 Epic |

**本番前修正:** **不要**

---

# 最終出力 — GO / WARNING / NO-GO

## 判定条件（AUTH-RB-1 / RB-2 解消後）

### GO（本番 Auth 移行 GO）

すべて満たすこと:

| # | 条件 |
|---|------|
| G-1 | 本番 DB で legacy 5 テーブル **anon READ = 0** |
| G-2 | `using(true)` / `Allow all` on legacy targets **= 0** |
| G-3 | `verify-auth-step8b-legacy-rls.mjs` **PASS**（本番 credentials） |
| G-4 | TALK / marketplace / anpi RLS 回帰 **PASS** |
| G-5 | **AUTH-H-1 パッチ適用済** + 公開詳細で信頼スコア表示確認 |
| G-6 | `https://tasful.jp` で Phase B **9/9 シナリオ PASS** |
| G-7 | 本番 host で `?userId` / `?talkAdmin` / LS 昇格 **すべて拒否** |
| G-8 | ops は JWT `is_ops` のみ · 一般ユーザーに ops データ **漏洩なし** |

### WARNING

| 条件 |
|------|
| G-1〜G-5 は PASS だが、G-6 の一部が **手動確認のみ** / 軽微な UI 差異 |
| または AUTH-H-2 監視項目のみ未着手（後追い許容） |
| **AUTH-RB-1 解消 · AUTH-RB-2 一部未完了** |

### NO-GO

いずれか該当:

| # | 条件 |
|---|------|
| N-1 | legacy **anon READ > 0**（本番） |
| N-2 | authenticated **他人データ READ 可** |
| N-3 | 本番 host で **LS/URL fallback が有効** |
| N-4 | **AUTH-H-1 未適用**のまま 8B 相当ポリシーが本番に存在 |
| N-5 | `tasful.jp` **未到達**（NB-1）で Phase B 未実施 |
| N-6 | 取引チャット / レビュー / お気に入りが **ログイン当事者で不通** |

---

## 現時点判定（準備完了時 · 2026-06-18）

# **WARNING**

| 項目 | 状態 |
|------|------|
| Phase A 計画 | ✅ 固定 |
| Phase B 計画 | ✅ 固定（**NB-1 待ち**） |
| Phase C | ✅ H-1 **本番前必須** · H-2 **後追い可** |
| AUTH-RB-1 実行 | ⚠️ 同一 DB なら再適用不要 · **prod inventory 未実施** |
| AUTH-RB-2 実行 | ❌ `tasful.jp` smoke 未実施 |
| AUTH-H-1 パッチ SQL | ❌ 未作成・未適用 |

**次アクション（STEP 10-EXEC）:**

1. `sql/auth-step10-review-scores-public-read.sql` 作成 + `detail-trust-score.js` 最小切替
2. 本番 DB inventory（pre/post）+ `verify-auth-step8b-legacy-rls.mjs`
3. NB-1 解消後 · Phase B 9 シナリオ実機 smoke
4. 全 G 条件満たしで **GO** 再判定 → `reports/auth-step10-production-go-exec.md`

---

## リスク一覧（STEP 10 スコープ）

| 重要度 | ID | 内容 | 本番前 |
|--------|-----|------|--------|
| **RELEASE BLOCKER** | AUTH-RB-1 | legacy RLS 本番確認未完了 | EXEC 必須 |
| **RELEASE BLOCKER** | AUTH-RB-2 | tasful.jp 実機 smoke 未実施 | EXEC 必須 |
| **HIGH** | AUTH-H-1 | review_scores 公開 read + upsert 経路 | **修正必須** |
| **LOW** | AUTH-H-2 | chats/ai_messages deny | 後追い監視 |

---

## 参照

| ファイル | 用途 |
|----------|------|
| `sql/auth-step8-legacy-chat-rls-proposal.sql` | legacy RLS 本体 |
| `scripts/verify-auth-step8b-legacy-rls.mjs` | prod probe |
| `scripts/test-auth-step7-fallback-lockdown.mjs` | fallback 回帰 |
| [`auth-step8b-legacy-rls-fix.md`](auth-step8b-legacy-rls-fix.md) | 8B ステージング実績 |
| [`users-profile-public-exposure-review.md`](users-profile-public-exposure-review.md) | review_scores 公開設計 |
