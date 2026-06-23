# TASFUL MATCH — RLS / Policy / Public View Draft Review

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 作成日 | 2026-06-21 |
| DDL ファイル | `supabase/migrations/20260621130000_match_rls_draft.sql` |
| 前提 | `supabase/migrations/20260621120000_match_schema_draft.sql` |
| 適用状況 | **未適用**（草案のみ） |

---

## 1. 作成ファイル

| ファイル | 内容 |
|----------|------|
| `supabase/migrations/20260621130000_match_rls_draft.sql` | ヘルパー関数、`match_profiles_public`、RLS 有効化（コメント）、全 policy 草案（コメント） |
| `reports/match-rls-draft-review.md` | 本書 |

---

## 2. RLS 対象テーブル

| テーブル | RLS 草案 | 備考 |
|----------|----------|------|
| `match_profiles` | ○ | 本人 SELECT/INSERT/UPDATE |
| `match_profile_photos` | ○ | 本人 CRU（論理削除） |
| `match_profile_hobby_tags` | ○ | 本人 SELECT/INSERT/DELETE |
| `match_swipes` | ○ | 本人 SELECT；INSERT は Edge 推奨（client 案はコメント） |
| `match_pairs` | ○ | 参加者 SELECT のみ |
| `match_blocks` | ○ | ブロック実行者のみ |
| `match_reports` | ○ | 通報者のみ |
| `match_verifications` | ○ | 本人 INSERT/SELECT |
| `match_sanctions` | ○ | client ポリシーなし |
| `match_moderation_logs` | ○ | client ポリシーなし |
| `match_daily_limits` | ○ | 本人 SELECT のみ |
| `match_hobby_tags` | ○ | 全員 SELECT（active のみ） |

**補助オブジェクト**

| オブジェクト | 役割 |
|--------------|------|
| `match_current_user_id()` | `auth.uid()::text` 統一 |
| `match_has_active_match_ban(text)` | 公開ビュー用 BAN 判定（SECURITY DEFINER） |
| `match_users_are_blocked(text, text)` | 双方向ブロック判定（SECURITY DEFINER） |
| `match_profiles_public` | スワイプ・探索用公開ビュー |

---

## 3. `match_profiles_public` の公開項目

| 列 | ソース | 説明 |
|----|--------|------|
| `profile_id` | `match_profiles.id` | 内部参照用（UI で必要なら使用） |
| `user_id` | `match_profiles.user_id` | 会員 ID（text） |
| `display_name` | `nickname` | 表示名 |
| `age` | `birth_date` から算出 | 年齢のみ（生年月日は非公開） |
| `prefecture` | `prefecture` | 都道府県 |
| `city` | `city` | 市区町村（任意） |
| `bio` | `bio` | 自己紹介 |
| `verification_status` | `verification_status` | バッジ表示用 |
| `main_photo_url` | `match_profile_photos.storage_path` | 署名 URL はアプリ層 |
| `hobby_tags` | join 集約 `label_ja[]` | 趣味タグ表示用 |
| `last_active_at` | `last_active_at` | 最終アクティブ |
| `created_at` | `created_at` | 作成日時 |

---

## 4. 非公開項目（ビューに含めない）

| カテゴリ | 例 |
|----------|-----|
| PII | `birth_date`、電話・メール |
| 本人確認 | `phone_hash`、`id_document_storage_path`、`metadata_json`、`reviewed_by` |
| 安全・運営 | 通報内容、BAN 詳細、`match_moderation_logs` |
| 内部 | `profile_status` 生値、審査メモ、外部 eKYC ID |
| 住所 | 番地・詳細住所（スキーマ上も未保持） |

---

## 5. 公開条件（ビュー `WHERE`）

| 条件 | 実装 |
|------|------|
| アクティブプロフィール | `profile_status = 'active'` |
| 論理削除なし | `archived_at IS NULL` |
| 表示フラグ | `is_visible` 列は未実装 → **`profile_status = 'active'` で代替**（コメント記載） |
| MATCH BAN なし | `NOT match_has_active_match_ban(user_id)` |
| 認証済み | `match_current_user_id() IS NOT NULL` |
| 自分以外 | `user_id <> current user` |
| ブロックなし | `NOT match_users_are_blocked(viewer, user_id)` |
| メイン写真 | `moderation_status = 'approved'` の写真のみ |

---

## 6. Client 許可操作（`authenticated`）

| テーブル | SELECT | INSERT | UPDATE | DELETE |
|----------|--------|--------|--------|--------|
| `match_profiles_public` | ○ | — | — | — |
| `match_hobby_tags` | ○（active） | — | — | — |
| `match_profiles` | 本人 | 本人 | 本人※ | — |
| `match_profile_photos` | 本人 | 本人 | 本人 | — |
| `match_profile_hobby_tags` | 本人 | 本人 | — | 本人 |
| `match_swipes` | 本人（swiper） | △コメント案 | — | — |
| `match_pairs` | 参加者 | — | — | — |
| `match_blocks` | ブロック実行者 | 本人 | 解除のみ | — |
| `match_reports` | 通報者 | 本人 | — | — |
| `match_verifications` | 本人 | 本人 | — | — |
| `match_daily_limits` | 本人 | — | — | — |
| `match_sanctions` | — | — | — | — |
| `match_moderation_logs` | — | — | — | — |

※ `verification_status` の client 更新は **トリガーで拒否推奨**（コメント記載）

---

## 7. service_role 専用操作（Edge Function）

| 処理 | 理由 |
|------|------|
| 日次いいね上限チェック・消費 | `match_daily_limits` の整合性 |
| 相互いいね判定 | レースコンディション防止 |
| `match_pairs` 作成 | 原子性 |
| `transaction_rooms` 作成 | TALK 連携 |
| `match_pairs.status` 変更 | blocked / unmatched |
| `match_sanctions` 作成・解除 | 運営判断 |
| `match_reports.status` 更新 | 運営キュー |
| `match_verifications` 審査結果反映 | ステータス改ざん防止 |
| `match_moderation_logs` 作成 | ログ改ざん防止 |
| スワイプ INSERT（本番推奨） | 上限・マッチ判定と一体 |

Supabase の `service_role` は RLS をバイパスするため、**専用 Edge Function からのみ**使用すること。

---

## 8. 危険ポイント

| # | リスク | 対策（草案 / 次 migration） |
|---|--------|------------------------------|
| 1 | `match_profiles_public` が SECURITY DEFINER 相当で基底テーブルを読む | `WHERE` で厳格フィルタ + `GRANT SELECT` は `authenticated` のみ |
| 2 | client が `verification_status` を自己昇格 | UPDATE トリガーで拒否（コメント案） |
| 3 | `match_verifications` の SELECT で `phone_hash` 等が見える | API レスポンスで列除外 / 将来 owner 用ビュー |
| 4 | client 直 `match_swipes` INSERT | 本番は Edge のみ；開発用 policy はコメント |
| 5 | `auth.uid()` NULL（未ログイン） | 公開ビューは 0 件；anon には grant しない |
| 6 | `main_photo_url` が storage 生パス | 署名 URL・バケット RLS は Storage migration で別途 |
| 7 | RLS 有効化のみ先行すると全拒否 | **schema → 本 migration の順**で policy 適用を同時に |

---

## 9. 適用前の確認事項

| # | 確認 |
|---|------|
| 1 | `20260621120000_match_schema_draft.sql` が staging に適用済みか |
| 2 | Supabase Auth の JWT で `auth.uid()` が TASFUL `user_id`（text）と 1:1 か |
| 3 | `is_visible` 列を追加するか、`profile_status` 代替で進めるか |
| 4 | スワイプ INSERT を client policy で許すか Edge のみか（**本番は Edge 推奨**） |
| 5 | Storage bucket（プロフィール写真）の RLS |
| 6 | `GRANT` / `REVOKE` を本番ロールに合わせて展開 |
| 7 | policy コメントアウト解除時は **一括適用**（テーブル単位で RLS のみ有効化しない） |

### 既存テーブル参照の存在確認（適用時）

```sql
-- staging で schema migration 適用後:
select to_regclass('public.match_profiles');
select to_regclass('public.match_sanctions');
-- いずれも null でなければ本 RLS migration を適用可能
```

`transaction_rooms` は本 RLS 草案では**参照しない**（TALK optional ALTER は schema 草案側）。

---

## 10. 構文チェック

| 項目 | 結果 |
|------|------|
| 方法 | 目視 + SQL 構造レビュー（**Supabase / リモート DB 未適用、SQL 未実行**） |
| 対象 | 関数 3 件、`VIEW` 1 件、コメント policy 草案 |
| 既知の適用時依存 | `auth.uid()`（Supabase Auth）、`age()` / `extract()`（PostgreSQL 標準） |
| 結果 | **構造 OK**（適用は staging で schema 後に実施） |

---

## 11. 次ステップ

| 順 | 作業 |
|----|------|
| 1 | staging: schema migration 適用 |
| 2 | policy コメント解除版を別ファイル化 or 同一ファイルの下半分を有効化 |
| 3 | `match_profiles_guard_verification_status` トリガー migration |
| 4 | Storage bucket RLS |
| 5 | Edge Function 設計（`match-record-swipe`, `match-ensure-talk-room` 等） |
| 6 | `match-api.js` 接続（別フェーズ） |

---

## 12. 判定

| チェック | 結果 |
|----------|------|
| 全 RLS 対象テーブルの方針定義 | OK |
| `match_profiles_public` 公開/非公開の分離 | OK |
| client / service_role 分離 | OK |
| 既存 TASFUL / TALK 非破壊 | OK |
| 適用リスクのコメント | OK |

### 総合判定

```
READY_FOR_EDGE_FUNCTION_DESIGN
```

`is_visible` 列の要否とスワイプ client INSERT の可否は運用判断だが、**Edge 推奨デフォルトで Edge 設計に進める**。

---

## 13. 改訂履歴

| 版 | 日付 | 内容 |
|----|------|------|
| v1.0 | 2026-06-21 | 初版（RLS / policy / public view 草案） |
