# TASFUL MATCH — Schema Draft Review

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 作成日 | 2026-06-21 |
| DDL ファイル | `supabase/migrations/20260621120000_match_schema_draft.sql` |
| 参照 | `reports/match-db-api-design-review.md` |
| 適用状況 | **未適用**（草案のみ） |

---

## 1. 作成したテーブル一覧

| # | テーブル | 説明 |
|---|----------|------|
| 1 | `match_profiles` | 恋活・婚活プロフィール（`user_id` 1:1） |
| 2 | `match_profile_photos` | 写真メタ（`display_order`、モデレーション） |
| 3 | `match_profile_hobby_tags` | プロフィール × 趣味タグ（join） |
| 4 | `match_hobby_tags` | 趣味タグマスタ |
| 5 | `match_swipes` | いいね / スキップ履歴 |
| 6 | `match_pairs` | マッチ成立（`user_low_id` / `user_high_id`） |
| 7 | `match_blocks` | ブロック（MATCH スコープ） |
| 8 | `match_reports` | 通報 |
| 9 | `match_verifications` | 本人確認申請・審査 |
| 10 | `match_sanctions` | BAN・制限（`scope = 'match'` 固定） |
| 11 | `match_moderation_logs` | AI / ルール監視ログ |
| 12 | `match_daily_limits` | 日次いいね上限 |

**補助オブジェクト**

| オブジェクト | 説明 |
|--------------|------|
| `match_set_updated_at()` | `updated_at` 自動更新トリガー関数 |

---

## 2. 主な制約

### 2.1 一意制約（重複防止）

| テーブル | 制約 |
|----------|------|
| `match_profiles` | `user_id` UNIQUE |
| `match_hobby_tags` | `slug` UNIQUE |
| `match_profile_hobby_tags` | PK `(profile_id, hobby_tag_id)` |
| `match_profile_photos` | 部分 UNIQUE `(profile_id, display_order)` ※ active 写真のみ |
| `match_swipes` | `(swiper_user_id, target_user_id)` UNIQUE |
| `match_pairs` | `(user_low_id, user_high_id)` UNIQUE + `user_low_id < user_high_id` |
| `match_blocks` | `(blocker_user_id, blocked_user_id)` UNIQUE |
| `match_daily_limits` | PK `(user_id, limit_date)` |

### 2.2 CHECK 制約（status / enum）

| テーブル | 主な CHECK |
|----------|------------|
| `match_profiles` | `gender`, `verification_status`, `profile_status`, nickname 1–20, bio ≤500 |
| `match_profile_photos` | `moderation_status`, `photo_status`, `display_order` 0–9 |
| `match_swipes` | `action IN ('like','skip')`, 自己スワイプ禁止 |
| `match_pairs` | `status IN ('active','blocked','unmatched')`, blocked 時 `blocked_by_user_id` 必須 |
| `match_blocks` | `block_status`, `source`, 自己ブロック禁止 |
| `match_reports` | `reason`, `context_type`, `status`, 自己通報禁止 |
| `match_verifications` | `verification_type`, `status`, `provider`, `id_document_type` |
| `match_sanctions` | `sanction_type`, `scope = 'match'`, `ends_at > starts_at` |
| `match_moderation_logs` | `content_type`, `level`, `engine` |

### 2.3 外部キー

| From | To | ON DELETE |
|------|-----|-----------|
| `match_profile_photos.profile_id` | `match_profiles.id` | CASCADE |
| `match_profiles.main_photo_id` | `match_profile_photos.id` | SET NULL |
| `match_profile_hobby_tags` | `match_profiles`, `match_hobby_tags` | CASCADE / RESTRICT |
| `match_blocks.match_pair_id` | `match_pairs.id` | SET NULL |

**意図的に未設定（optional セクションへ分離）**

- `match_pairs.talk_room_id` → `transaction_rooms.id`（既存 TALK テーブル非改変のため）

### 2.4 論理削除方針

| テーブル | カラム | 用途 |
|----------|--------|------|
| `match_profiles` | `archived_at` | 退会・非表示 |
| `match_profile_photos` | `photo_status`, `archived_at` | 写真の論理削除 |
| `match_pairs` | `status`, `archived_at` | unmatched / blocked |
| `match_blocks` | `block_status`, `archived_at` | ブロック解除は UPDATE |
| `match_reports` | `archived_at` | 履歴整理 |
| `match_verifications` | `archived_at` | 旧申請の退避 |
| `match_sanctions` | `revoked_at`, `archived_at` | BAN 解除 |

---

## 3. 主なインデックス

| 用途 | インデックス |
|------|--------------|
| スワイプ候補 / 公開プロフィール | `match_profiles (profile_status, verification_status)` |
| アクティブユーザー | `match_profiles (last_active_at desc)` |
| 写真表示順 | `match_profile_photos (profile_id, display_order)` |
| いいね履歴 | `match_swipes (swiper_user_id, created_at desc)` |
| マッチ一覧（双方） | `match_pairs (user_low_id, …)`, `(user_high_id, …)` |
| アクティブマッチ | `match_pairs (status, matched_at)` WHERE `archived_at IS NULL` |
| ブロックフィルタ | `match_blocks` 部分索引（active のみ） |
| 通報キュー | `match_reports (status, created_at)` |
| 本人確認審査 | `match_verifications (status, submitted_at)` |
| 有効制裁 | `match_sanctions (user_id, starts_at)` WHERE `revoked_at IS NULL` |
| 監視ログ分析 | `match_moderation_logs (level, created_at)` WHERE warning/blocked |

---

## 4. RLS を今回入れなかった理由

| 理由 | 説明 |
|------|------|
| 適用リスク | 既存 Supabase プロジェクトでは `enable row level security` のみで既存クライアントが即座に失敗する可能性がある |
| 認証未接続 | JWT / `auth.uid()` と `user_id text` のマッピングが未実装 |
| 分離原則 | スキーマ草案とポリシー草案を別 migration に分けるとレビューしやすい |
| 設計レビュー指示 | `reports/match-db-api-design-review.md` §4 の方針を DDL コメント（`-- RLS TODO`）として残置 |

**次 migration で実施予定**

1. 全 `match_*` で `enable row level security`
2. 本人 / 参加者 / service_role ポリシー
3. `match_profiles_public` 等の SECURITY DEFINER ビュー

---

## 5. TALK 接続の optional ALTER 方針

本草案では **`transaction_rooms` への ALTER は実行しない**。migration 末尾にコメントアウトで記載。

| 項目 | 方針 |
|------|------|
| D5 `expires_at` | `nullable` 化（マッチルームは初期 `NULL` = 期限なし） |
| `match_pair_id` | `transaction_rooms` への任意列追加 |
| `listing_type = 'match'` | アプリ層の規約（列追加不要） |
| `match_pairs.talk_room_id` FK | optional migration で双方向整合後に追加 |
| 参加者 | `buyer_id = user_low_id`, `seller_id = user_high_id` を固定 |

既存 `reports` / `blocked_users` / `moderation_logs` は**変更しない**（MATCH は `match_*` のみ）。

---

## 6. 適用前に確認すべき点

| # | 確認事項 | 備考 |
|---|----------|------|
| 1 | `transaction_rooms` が本番 DB に存在するか | optional FK 追加の前提 |
| 2 | `expires_at NOT NULL` の既存データ | nullable 化時の既存行はそのまま維持 |
| 3 | Storage バケット（プロフィール写真・身分証） | DDL 外。別 migration / ダッシュボード設定 |
| 4 | `user_id text` と Auth UUID の変換規則 | Edge Function 実装時に固定 |
| 5 | 趣味タグ seed | コメントアウト seed を staging で実行するか |
| 6 | `match_profile_hobby_tags` と UI の最大5件 | `display_order` CHECK 0–4 |
| 7 | 法務（身分証画像の保持期間） | `id_document_storage_path` 運用ポリシー |
| 8 | 本 migration を staging → production の順で適用 | **本番直適用禁止** |

---

## 7. 構文チェック

| 項目 | 結果 |
|------|------|
| 方法 | ローカル in-memory（`pg-mem`）で DDL 文を分割実行。`CREATE TABLE` / `CREATE INDEX` / `ALTER TABLE` 38 文 |
| 除外 | `plpgsql` 関数・トリガー 10 文（pg-mem 未対応のため構文のみ目視確認） |
| Supabase / リモート DB 適用 | **未実施** |
| 結果 | **PASS** |

---

## 8. 次ステップ

| 順 | 作業 |
|----|------|
| 1 | `YYYYMMDDHHMMSS_match_rls_draft.sql` — RLS + ポリシー草案 |
| 2 | `match_profiles_public` ビュー + `match_get_candidates()` SECURITY DEFINER 関数 |
| 3 | optional `transaction_rooms` ALTER migration（TALK bridge） |
| 4 | Storage bucket + RLS（写真・身分証） |
| 5 | Edge Function スタブ（`match-record-swipe` 等） |
| 6 | staging 適用 → スキーマ検証 → UI `match-api.js` 接続（別フェーズ） |

---

## 9. 設計レビューとの差分メモ

| 項目 | 設計レビュー | 本草案 |
|------|--------------|--------|
| ペアユーザー列名 | `user_a_id` / `user_b_id` | **`user_low_id` / `user_high_id`**（指示準拠） |
| 写真順序列名 | `sort_order` | **`display_order`**（指示準拠） |
| 趣味 | `hobby_tags text[]` | **join テーブル** + マスタ |
| 通報理由列 | `reason_code` | **`reason`**（UIモック値を CHECK） |
| 本人確認 | 複数列中心 | **`verification_type` + `metadata_json`** 追加 |

---

## 10. 判定

| チェック | 結果 |
|----------|------|
| 全11+1テーブル作成 | OK |
| 既存テーブル非破壊 | OK |
| CHECK / UNIQUE / INDEX | OK |
| RLS はコメントのみ | OK |
| TALK ALTER は optional コメント | OK |
| SQL 構文チェック | OK |

### 総合判定

```
READY_FOR_RLS_DRAFT
```

次は RLS / ポリシー / SECURITY DEFINER ビューの migration 草案作成に進めます。

---

## 11. 改訂履歴

| 版 | 日付 | 内容 |
|----|------|------|
| v1.0 | 2026-06-21 | 初版（DDL 草案レビュー） |
