# TASFUL MATCH — RLS D2 talk_user_id 修正 migration 草案レビュー

| 項目 | 内容 |
|------|------|
| 版 | v1.0（草案レビューのみ） |
| 作成日 | 2026-06-21 |
| ステータス | 未適用・Supabase 未接続 |
| 前提 | `match-auth-boundary-design.md`, `match-auth-stub-review.md`, `20260621130000_match_rls_draft.sql` |
| 本書の範囲 | D2 修正 migration 草案の静的レビュー。**DB 適用 / RLS 有効化 / Auth 変更 / UI 変更は行わない** |

---

## 1. 作成ファイル

| ファイル | 役割 |
|----------|------|
| `supabase/migrations/20260621140000_match_rls_d2_talk_user_id_draft.sql` | D2 修正: `match_current_user_id()` を JWT `talk_user_id` 読み取りに差し替え |
| `reports/match-rls-d2-talk-user-id-draft-review.md` | 本レビュー |

**変更していないもの**

- `supabase/migrations/20260621130000_match_rls_draft.sql`（原文維持）
- `auth-current-user.js` / Edge Functions / MATCH UI / JS

---

## 2. D2 問題の要点

| 項目 | 内容 |
|------|------|
| 症状 | `match_current_user_id()` が `auth.uid()::text`（Supabase UUID）を返す |
| 期待 | MATCH `user_id` = `TasuAuthCurrentUser.talkUserId` = TALK `buyer_id` / `seller_id`（text、例: `u_me`） |
| 影響 | RLS 適用後、本人ポリシー `user_id = match_current_user_id()` が **常に false** になり、本人 SELECT/INSERT/UPDATE が失敗 |
| 根本原因 | Auth の正（JWT `talk_user_id`）と Postgres RLS の正（`auth.uid()`）が別 ID 空間 |

`match-auth-boundary-design.md` §2.1 で指摘済み。本草案は RLS 適用**前**の helper 修正として位置づける。

---

## 3. 採用した JWT claim 取得方法

### 採用: `auth.jwt()`（jsonb ペイロード）

```sql
coalesce(
  auth.jwt() -> 'app_metadata' ->> 'talk_user_id',
  auth.jwt() ->> 'talk_user_id',
  auth.jwt() -> 'app_metadata' ->> 'member_id'
)
```

| 理由 | 説明 |
|------|------|
| Supabase 標準 | RLS / SQL 内で JWT ペイロードを読む公式 helper |
| TASFUL 整合 | `auth-current-user.js` が `app_metadata.talk_user_id` を第一候補とするのと同順 |
| 将来 hook | Custom Access Token Hook が root に `talk_user_id` を載せた場合も 2 番目で拾える |

### 不採用（主経路）: `current_setting('request.jwt.claims', true)::jsonb ->> 'talk_user_id'`

| 理由 | 説明 |
|------|------|
| 可搬性 | PostgREST / 設定文字列依存で、Supabase RLS ドキュメントの主経路ではない |
| 等価性 | 実体は同じ JWT だが、`auth.jwt()` の方が意図が明確 |
| メンテ | 将来 Supabase が helper 側で claim 正規化した場合に追従しやすい |

### 意図的に使わない fallback

| 候補 | 理由 |
|------|------|
| `auth.uid()::text` | UUID ≠ TALK/MATCH text ID。**本番 fallback 禁止** |
| `auth.jwt() ->> 'sub'` | 通常 UUID。TASFUL では `talk_user_id` が正 |

SQL 内に staging-only fallback の議論コメントのみ記載（未実装）。

---

## 4. match_current_user_id() 修正内容

**Before（`20260621130000`）**

```sql
select nullif(auth.uid()::text, '');
```

**After（`20260621140000`）**

```sql
select nullif(
  trim(
    coalesce(
      auth.jwt() -> 'app_metadata' ->> 'talk_user_id',
      auth.jwt() ->> 'talk_user_id',
      auth.jwt() -> 'app_metadata' ->> 'member_id'
    )
  ),
  ''
);
```

| 属性 | 値 |
|------|-----|
| 戻り値 | text（会員 ID）または NULL（未認証 / claim 欠落） |
| security | `security invoker`（変更なし） |
| COMMENT | JWT 由来であること、`auth.uid()` 単独不可を明記 |

---

## 5. 影響する helper / view / policy

### Helper 関数

| 関数 | D2 修正での変更 | 依存関係 |
|------|-----------------|----------|
| `match_has_active_match_ban(p_user_id)` | **なし**（引数渡し） | `match_profiles_public` が `p.user_id` を渡す |
| `match_users_are_blocked(p_user_a, p_user_b)` | **なし**（引数渡し） | view が `(match_current_user_id(), p.user_id)` を渡す |

関数本体に `auth.uid()` は含まれない。`match_current_user_id()` 修正のみで view / policy 側が正しい ID を得る。

### View

| オブジェクト | 変更 |
|--------------|------|
| `match_profiles_public` | **DDL 再作成なし**（既に `match_current_user_id()` 呼び出し）。`COMMENT ON VIEW` のみ D2 向けに更新 |

### Policy 草案（`20260621130000` 内コメント）

| テーブル | 比較式 | D2 後 |
|----------|--------|-------|
| `match_profiles` | `user_id = match_current_user_id()` | 自動修正（helper 差替） |
| `match_profile_photos` 等 | `mp.user_id = match_current_user_id()` | 同上 |
| `match_swipes` | `swiper_user_id = match_current_user_id()` | 同上 |
| `match_pairs` | `match_current_user_id() in (...)` | 同上 |
| `match_blocks` / `match_reports` / `match_verifications` / `match_daily_limits` | 各 `*_user_id = match_current_user_id()` | 同上 |

---

## 6. auth.uid()::text 単独利用の残存チェック結果

### `supabase/migrations/` 全体

| ファイル | `auth.uid()` 出現 | 評価 |
|----------|-------------------|------|
| `20260621130000_match_rls_draft.sql` | 3 箇所（ヘッダコメント、関数本体、view 注記） | **旧草案のまま**。適用順 3 で本 D2 ファイルが上書き |
| `20260621140000_match_rls_d2_talk_user_id_draft.sql` | 0 箇所（実行 SQL）。fallback **議論コメントのみ** | **OK** |

### Policy 草案（コメント内 CREATE POLICY）

- `auth.uid()::text = user_id` 形式: **0 件**
- すべて `public.match_current_user_id()` 使用: **確認済み**

### 結論

実行される D2 修正 SQL に `auth.uid()::text` 単独比較は**含まれない**。旧 migration は歴史参照として残し、staging では **30000 → 40000 の順**で helper を置換する。

---

## 7. 適用前ゲート

本 migration は以下がすべて確認できるまで **適用不可**（SQL ヘッダにも記載）。

1. Supabase JWT に `talk_user_id` claim が入る（`app_metadata` および/または root）
2. JWT `talk_user_id` = `TasuAuthCurrentUser.talkUserId`
3. JWT `talk_user_id` = TALK `buyer_id` / `seller_id`
4. JWT `talk_user_id` = `match_profiles.user_id`
5. RLS 統合テスト
   - 本人 SELECT（base `match_profiles`）
   - 他人行 SELECT 拒否
   - `match_profiles_public` が期待どおり（他人表示・自分除外・block/ban 除外）

**本草案ではゲート 1 が未達** — JWT に claim を載せる Edge / Hook 設計が別途必要。

---

## 8. リスク

| リスク | 内容 | 緩和 |
|--------|------|------|
| claim 未設定 | `match_current_user_id()` が NULL → 全 authenticated policy 拒否 | ゲート 1–4 + Hook 実装後に適用 |
| claim 改ざん | クライアントが JWT を書き換え可能（anon key セッション） | Supabase が署名検証。claim は **server-side hook / admin API** でのみ設定 |
| member_id フォールバック | `talk_user_id` 欠落時に別 ID 空間の可能性 | 本番は `talk_user_id` 必須をゲートで固定。member_id は 3 番目のみ |
| 適用順ミス | 30000 のみ適用で旧 helper が残る | ドキュメント化済み apply order |
| view owner RLS | `security_invoker = false` の view は別 hardening 議論 | 既存草案通り。D2 範囲外 |

---

## 9. 次ステップ

| 順 | 作業 | 成果物イメージ |
|----|------|----------------|
| 1 | **Custom Access Token Hook / Edge JWT 設計** — `talk_user_id` を access token に載せる | Hook SQL / Edge 設計書 |
| 2 | staging で JWT claim 実測（`auth.jwt()` デバッグ RPC またはログ） | ゲート 1–4 エビデンス |
| 3 | `match-auth.ts`（Edge）を mock から JWT `talk_user_id` 抽出へ | Edge 実装 migration |
| 4 | RLS 有効化 migration（policy uncomment + ENABLE RLS） | 別ファイル |
| 5 | RLS 統合テスト | CI / manual checklist |

---

## 10. 静的検証

| 項目 | 結果 |
|------|------|
| SQL 構文 | 目視確認（`CREATE OR REPLACE FUNCTION`, `COMMENT ON` — 標準 PostgreSQL / Supabase 構文） |
| pg-mem 実行 | **未実施**（`auth.jwt()` は Supabase 拡張。ローカル in-memory では再現不可） |
| Supabase 適用 | **未実施**（本タスクスコープ外） |
| 既存 migration 改変 | **なし** |

---

## 判定

**READY_FOR_MATCH_EDGE_JWT_DESIGN**

理由:

- D2 問題（`auth.uid()` vs `talk_user_id`）に対する helper 修正草案が完成
- helper / view / policy への影響整理済み
- `auth.uid()::text` 単独比較は policy 草案に残存なし
- 適用前ゲートと JWT claim 前提が SQL / 本書に明記済み
- **次のボトルネックは JWT に `talk_user_id` を載せる Edge / Hook 設計**であり、RLS 本体適用より先に解決すべき

NEEDS_DECISION となる条件（現時点では該当なし）:

- `talk_user_id` を root claim のみに限定する等、解決順序の product 決定が必要になった場合
- `member_id` fallback を本番から除外する明示決定が必要な場合（現草案は auth-current-user.js 整合のため 3 番目に残置）
