# TASFUL MATCH — P15 追加機能 実装計画

| 項目 | 内容 |
|------|------|
| 版 | v1.0（計画のみ · **コード未着手**） |
| 作成日 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`**（linked ref · Hook ON · RLS D2） |
| 前提 | post-auth final smoke PASS · prod URL review **`BLOCKED_WITH_REASON`**（本番 DNS 未到達 · 8月まで保留） |
| 検証基準 | **prod-parity / local / linked ref**（`tasful.jp` 本番確認は別途） |

---

## 1. プロダクト方針（確定）

### 1.1 役割分担

| プロダクト | 役割 | MATCH との関係 |
|------------|------|----------------|
| **TASFUL MATCH** | 出会う · 探す · マッチする · 話す | 利用者獲得 · マッチング導線 · 安全基盤 |
| **TASFUL AI** | 相談 · 改善 · 課金導線 | MATCH から **CTA・リンク・文脈付き遷移のみ** |

**原則:** MATCH 内に本格的 AI（プロフィール作成/添削 · メッセージ補助 · 恋愛/婚活/相性診断の完結 UI）を **内蔵しない**。詳細分析・改善提案は TASFUL AI 側で提供する。

### 1.2 初期リリースに入れる 7 機能

| # | 機能 | 表示例 |
|---|------|--------|
| 1 | お気に入り | 「お気に入り」/「気になる」一覧 |
| 2 | 足あと | 誰が · いつ頃（今日/昨日/3日前） |
| 3 | 活動状況表示 | 24h以内 / 3日以内 / 1週間以内 / しばらく未活動 |
| 4 | 検索条件保存 | 名前付き保存 · 前回条件再利用 |
| 5 | 簡易相性スコア | 相性 78% · 共通点 3件（ルールベース） |
| 6 | プロフィール完成度 | 完成度 80%（項目チェックリスト） |
| 7 | TASFUL AI 誘導導線 | 6 種 CTA → `ai-workspace.html` |

### 1.3 初期リリースに入れないもの

| 機能 | 理由 |
|------|------|
| スーパーいいね | 利用者増加後 · 既に `phase_not_enabled` |
| 音声 / 動画プロフィール | 運営・モデレーション負荷 |
| TALK 通話 / ビデオ通話 | TALK 側機能 · MATCH 初期スコープ外 |
| MATCH 専用 AI チャット | TASFUL AI へ分離 |
| AI 診断の MATCH 内完結 | TASFUL AI へ分離 |
| 「現在オンライン中」表示 | 返信トラブル防止 · 初期非実装 |

---

## 2. 現状棚卸し（ベースライン）

### 2.1 適用済み DB（L10–L11）

**8 テーブル** — `20260621160000_create_match_schema.sql` + `20260621170000_match_rls_d2.sql`

| テーブル | 用途 | P15 関連 |
|----------|------|----------|
| `match_profiles` | プロフィール · `last_active_at` のみ活動関連 | 拡張カラム必要 |
| `match_profile_photos` | 写真 | 完成度判定に使用 |
| `match_swipes` | like/skip（相互マッチ前履歴） | **お気に入りとは別概念** |
| `match_pairs` | 相互マッチ | 変更なし |
| `match_blocks` | ブロック | 一覧フィルタに使用 |
| `match_reports` | 通報 | 変更なし |
| `match_verifications` | 本人確認 | 完成度判定に使用 |
| `match_moderation_logs` | モデレーション | 変更なし |

**RLS ヘルパー:** `match_current_user_id()` · `match_is_admin()` · `match_users_are_blocked(a,b)`

**identity:** JWT `talk_user_id`（text）— legacy 7 `@tasful-dev.test` metadata **不変** · allowlist T1–T5

**ギャップ（draft のみ · 未適用）:**

- `match_hobby_tags` / `match_profile_hobby_tags` — 相性・検索・完成度に必要
- `match_profiles_public` VIEW — スワイプ/探索の他者プロフィール読取
- `match_sanctions` / `match_daily_limits` — 将来 · P15 初期は任意

### 2.2 Edge Functions（7 · stub 段階）

| Function | 状態 |
|----------|------|
| `match-record-swipe` | stub · remote smoke 200 |
| `match-ensure-talk-room` | stub |
| `match-submit-report` | stub |
| `match-block-user` | stub |
| `match-submit-verification` | stub |
| `match-admin-review` | stub · 一般 403 |
| `match-moderation-log` | stub · UI 未配線 |

**P15 で追加予定:** 下記 §5 · 既存 7 件は DB 接続実装と並行

### 2.3 UI / API（現状）

| 項目 | 状態 |
|------|------|
| HTML | 11 ページ（`match-top` 〜 `match-review` · `match-mypage` 含む） |
| API モード | デフォルト **`client_stub`** · `edge_stub` は検証スクリプトのみ |
| Auth | `match-auth.js` stub · `TasuAuthCurrentUser` 同期設計済み |
| TASFUL AI リンク | **MATCH 内 0 件** · サイト共通は `ai-workspace-links.js` |
| 本番 UI | prod-parity PASS · `tasful.jp` は BLOCKED |

### 2.4 影響を受ける既存資産

```
match/*.html · match-api.js · match-wiring.js · match-data-stub.js
deploy/cloudflare/dist/match/*
supabase/migrations/202606211{60000,70000}_*.sql
supabase/functions/match-* · _shared/match-auth.ts
scripts/verify-match-* · sql/match-post-auth-final-smoke-readonly.sql
ai-workspace-links.js · ai-workspace.html / gen-ai-workspace.html
```

---

## 3. 追加機能一覧と目的

| 機能 | 目的 | MATCH 内 AI | 備考 |
|------|------|-------------|------|
| **お気に入り** | マッチ前候補の保存 · 後から比較 | なし | `match_swipes.like` と独立 |
| **足あと** | 関心シグナル · 再アプローチきっかけ | なし | 将来プレミアム/非表示 |
| **活動状況** | 返信期待値の調整 · 幽霊会員の見分け | なし | オンライン中は出さない |
| **検索条件保存** | 再検索の手間削減 · 継続利用 | なし | 名前付き複数保存 |
| **簡易相性スコア** | スワイプ判断の補助 | **なし**（ルール計算） | 詳細 → TASFUL AI |
| **プロフィール完成度** | 入力促進 · マッチ率向上 | **なし**（チェックリスト） | 改善詳細 → TASFUL AI |
| **TASFUL AI 誘導** | 相談・改善の課金導線 | **MATCH はリンクのみ** | 6 CTA · 文脈 query |

---

## 4. DB 設計案

### 4.1 プロフィール拡張（`match_profiles` ALTER）

相性・完成度・検索に必要な項目（draft/MVP 設計書に未反映分を追加）:

| カラム | 型 | 用途 |
|--------|-----|------|
| `purpose` | text | `love` / `marriage` / `friend` / `undecided` |
| `relationship_view` | text | 恋愛観（短文 or enum · 500字以内） |
| `weekend_style` | text | 休日の過ごし方 |
| `activity_visibility` | text | `visible` / `hidden`（将来 · デフォルト `visible`） |
| `footprint_visibility` | text | `visible` / `hidden`（将来 · デフォルト `visible`） |
| `completeness_cached` | smallint | 0–100 · 任意キャッシュ（トリガー更新可） |

**draft から昇格（新 migration）:**

| テーブル | 用途 |
|----------|------|
| `match_hobby_tags` | 趣味マスタ |
| `match_profile_hobby_tags` | プロフィール ↔ 趣味（最大 5） |

### 4.2 新規テーブル

#### `match_favorites`

| カラム | 型 | 制約 |
|--------|-----|------|
| `id` | uuid PK | |
| `owner_user_id` | text | = `talk_user_id` |
| `target_user_id` | text | ブロック/自己不可 |
| `source` | text | `swipe` / `profile` / `search` |
| `note` | text | 任意 · 将来 |
| `archived_at` | timestamptz | 論理削除 |
| `created_at` | timestamptz | |

**UNIQUE** `(owner_user_id, target_user_id)` where `archived_at is null`

#### `match_profile_views`（足あと）

| カラム | 型 | 制約 |
|--------|-----|------|
| `id` | uuid PK | |
| `viewer_user_id` | text | 閲覧者 |
| `viewed_user_id` | text | 被閲覧者 |
| `source` | text | `swipe_card` / `profile_detail` / `favorites` |
| `viewed_at` | timestamptz | 集約用 |
| `dedupe_bucket` | date | 同一日同一ペア 1 行（UPSERT 用） |

**INDEX** `(viewed_user_id, viewed_at desc)` · `(viewer_user_id, viewed_at desc)`

**将来:** `match_user_settings.footprint_enabled` · プレミアム tier で incoming 非表示

#### `match_saved_searches`

| カラム | 型 | 制約 |
|--------|-----|------|
| `id` | uuid PK | |
| `user_id` | text | 所有者 |
| `name` | text | 1–40 字 · 「前回の条件」デフォルト可 |
| `filters_json` | jsonb | 下記スキーマ |
| `is_default` | boolean | 最大 1 件/ユーザー |
| `last_used_at` | timestamptz | |
| `archived_at` | timestamptz | |
| `created_at` / `updated_at` | timestamptz | |

**`filters_json` 例:**

```json
{
  "age_min": 25,
  "age_max": 35,
  "prefectures": ["東京都", "神奈川県"],
  "purpose": ["love", "marriage"],
  "hobby_tag_ids": ["uuid", "uuid"],
  "verified_only": true,
  "distance_km": null
}
```

#### `match_user_settings`（拡張性 · P15 最小）

| カラム | 型 | デフォルト |
|--------|-----|------------|
| `user_id` | text PK | |
| `show_activity_status` | boolean | true |
| `show_footprints_to_others` | boolean | true |
| `receive_footprint_notifications` | boolean | true |
| `updated_at` | timestamptz | |

### 4.3 計算ロジック（DB 関数 · AI 不使用）

#### `match_activity_label(p_last_active_at timestamptz) → text`

| 条件 | ラベル |
|------|--------|
| `now() - last_active_at < 24h` | `24時間以内に活動` |
| `< 3 days` | `3日以内に活動` |
| `< 7 days` | `1週間以内に活動` |
| else / null | `しばらく未活動` |

#### `match_footprint_label(p_viewed_at timestamptz) → text`

| 条件 | ラベル |
|------|--------|
| 今日（JST） | `今日` |
| 昨日 | `昨日` |
| `< 7 days` | `N日前`（3日前など） |
| else | `1週間以上前` |

#### `match_profile_completeness(p_user_id text) → jsonb`

| 項目 | 重み | 判定 |
|------|------|------|
| 写真（approved ≥1） | 20 | `match_profile_photos` |
| 自己紹介 | 15 | `bio` 非空 |
| 年齢 | 10 | `birth_date` |
| 地域 | 10 | `prefecture` |
| 趣味 | 15 | hobby tags ≥1 |
| 目的 | 10 | `purpose` |
| 恋愛観 | 10 | `relationship_view` |
| 本人確認 | 10 | `verification_status in (verified, phone_verified)` |

返却: `{ "percent": 80, "items": [{ "key": "photo", "done": true }, ...] }`

#### `match_compatibility_score(p_viewer_id, p_target_id) → jsonb`

**ルールベース（サーバー or クライアント同一式）:**

| 一致項目 | 点数 |
|----------|------|
| 趣味タグ 1 件一致 | +12（上限 36） |
| `purpose` 一致 | +20 |
| 同都道府県 | +15 |
| 隣接都道府県 | +8 |
| `weekend_style` 一致 | +10 |
| `relationship_view` 類似（同一 enum） | +15 |
| 年齢差 ≤3 歳 | +10 · ≤7 歳 +5 |

**表示:** `percent = min(99, round(total))` · `common_points[]` 最大 5 件

**保存しない**（都度計算）— キャッシュは将来 `match_compatibility_cache` 任意

### 4.4 探索 VIEW（draft 昇格 · 必須）

`match_profiles_public` — SECURITY DEFINER · スワイプ/検索/相性表示用

- 除外: 自己 · 双方向 block · `profile_status != active` · sanction（将来）
- 含める: nickname · age · prefecture · purpose · hobby slugs · `last_active_at`（→ label 変換は Edge/UI）
- **足あと記録は VIEW 経由ではなく Edge `match-record-profile-view`**

---

## 5. RLS 方針

**継承:** `match_current_user_id()` · `anon` revoke · `service_role` bypass · legacy metadata 不変

| テーブル | SELECT | INSERT | UPDATE | DELETE |
|----------|--------|--------|--------|--------|
| `match_favorites` | `owner_user_id = me` | own · not blocked target | own archive | — |
| `match_profile_views` | `viewed_user_id = me`（incoming） | — | — | — |
| `match_profile_views` | `viewer_user_id = me`（outgoing · 任意） | Edge のみ INSERT | — | — |
| `match_saved_searches` | `user_id = me` | own | own | own archive |
| `match_user_settings` | own | own upsert | own | — |
| `match_hobby_tags` | authenticated 全員 | admin/service | admin | admin |
| `match_profile_hobby_tags` | own profile | own profile | own | own |
| `match_profiles`（拡張列） | 既存 own · 他者は VIEW/Edge | 既存 | own · verification guard 維持 | — |

**足あとプライバシー:**

- incoming SELECT: `viewed_user_id = me` AND `match_user_settings.show_footprints_to_others` on viewer side（viewer が非表示設定なら INSERT 自体を Edge でスキップ）
- ブロック済みユーザーからの view は記録しない

**活動状況:**

- `last_active_at` は base table にのみ · 他者は VIEW 経由で **label のみ**（生 timestamp は返さない · または bucket enum のみ）

---

## 6. Edge / API 案

### 6.1 新規 Edge Functions

| Function | メソッド | 役割 |
|----------|----------|------|
| `match-toggle-favorite` | POST | add/remove · `{ target_user_id, action: "add"\|"remove" }` |
| `match-list-favorites` | GET/POST | ページング · block 除外 · public profile join |
| `match-record-profile-view` | POST | 足あと UPSERT（日次 dedupe） |
| `match-list-footprints` | GET/POST | incoming · label 付き |
| `match-bump-activity` | POST | `last_active_at = now()` · スロットル 15min |
| `match-get-activity-label` | GET/POST | 対象 user の bucket label（設定 respect） |
| `match-save-search` | POST | create/update · `{ name, filters, is_default? }` |
| `match-list-saved-searches` | GET/POST | 一覧 |
| `match-run-saved-search` | POST | filters → candidate user_ids（将来 `match-get-candidates` と統合） |
| `match-get-compatibility` | POST | `{ target_user_id }` → score json |
| `match-get-profile-completeness` | GET/POST | 自分 or admin |

**既存関数の拡張（別 migration フェーズ）:**

| Function | 追加 |
|----------|------|
| `match-record-swipe` | DB write · `match_bump_activity` 連鎖 · favorite 連動なし |
| `match-get-candidates` | **新規** · saved search + block + swiped 除外 |

### 6.2 Client API（`match-api.js` 追加メソッド）

| メソッド | edge_stub 先 | client_stub 挙動 |
|----------|--------------|------------------|
| `toggleFavorite` | `match-toggle-favorite` | stub リスト更新 |
| `listFavorites` | `match-list-favorites` | stub 3 件 |
| `recordProfileView` | `match-record-profile-view` | no-op ok |
| `listFootprints` | `match-list-footprints` | stub 日付ラベル |
| `bumpActivity` | `match-bump-activity` | no-op |
| `getActivityLabel` | ローカル計算可 | `match_activity_label` 同等 |
| `saveSearch` / `listSavedSearches` / `runSavedSearch` | 各 function | stub |
| `getCompatibility` | `match-get-compatibility` | 固定 78% / 3件 |
| `getProfileCompleteness` | `match-get-profile-completeness` | 固定 80% |

**Auth:** 既存と同様 · Bearer JWT · `auth_required` · block/sanction guard

### 6.3 活動状況更新トリガー（Edge/UI）

| タイミング | 処理 |
|------------|------|
| スワイプ like/skip | `match-bump-activity`（debounce） |
| プロフィール保存 | bump |
| お気に入り add | bump |
| マイページ表示 | bump（1回/セッション） |
| **リアルタイム heartbeat** | **実装しない** |

---

## 7. UI 導線

### 7.1 新規 / 拡張ページ

| ページ | パス案 | 導線 |
|--------|--------|------|
| お気に入り一覧 | `match-favorites.html` | スワイプ card ♡ · マイページ · タブバー検討 |
| 足あと一覧 | `match-footprints.html` | マイページ · 通知バッジ（将来） |
| 検索条件 | `match-search-saved.html` | スワイプ上部フィルタ icon · マイページ |
| （既存）スワイプ | `match-swipe.html` | 相性 % · 活動 label · ♡ お気に入り |
| （既存）マイページ | `match-mypage.html` | 完成度バー · AI CTA 群 · 各一覧リンク |
| （既存）profile create | `match-profile-create.html` | 完成度リアルタイム · purpose/恋愛観 step 追加 |

### 7.2 コンポーネント（`data-*` 案）

| 属性 | 用途 |
|------|------|
| `data-match-favorite-toggle` | お気に入り ON/OFF |
| `data-match-activity-label` | 活動 bucket 表示 |
| `data-match-compat-score` / `data-match-compat-common` | 相性 UI |
| `data-match-completeness-bar` | 完成度 % |
| `data-match-ai-cta` | AI 誘導（`data-ai-mode` · `data-ai-q`） |
| `data-match-footprint-list` | 足あと一覧 |
| `data-match-saved-search-list` | 保存条件一覧 |

### 7.3 タブバー（案）

現行 4 タブ（スワイプ / マッチ / 安心 / マイページ）を維持。**お気に入り・足あとはマイページ配下**（初期）。利用データを見てタブ昇格可。

### 7.4 文言

| 機能 | 推奨文言 |
|------|----------|
| お気に入り | **「お気に入り」**（一覧）· ボタンは **「気になる」** も可 |
| 足あと | **「足あと」** · 「〇〇さんがプロフィールを見ました」 |
| 活動 | bucket ラベルそのまま（オンライン中は使わない） |
| 相性 | **「相性 78%」** · **「共通点 3件」** |
| 完成度 | **「プロフィール完成度 80%」** |

---

## 8. TASFUL AI 誘導リンク設計

### 8.1 共通仕様

- **ヘルパー:** 既存 `ai-workspace-links.js` の `TasuAiWorkspaceLinks.buildUrl()` を MATCH から読み込む
- **ベース URL:** `../ai-workspace.html`（MATCH からの相対パス）
- **必須 query:** `mode` · `q`（初期プロンプト）· `returnTo`（MATCH ページ URL · breadcrumb 用）
- **MATCH 内に AI iframe / chat UI を置かない**

### 8.2 CTA 一覧

| 導線 | 配置 | `mode`（案） | 初期 `q`（案） |
|------|------|--------------|----------------|
| プロフィール改善 | マイページ · profile create 完成度下 | `match-profile-coach` | 「マッチング用プロフィールを改善したいです。現在の完成度は{percent}%です。」 |
| 恋愛相談 | マイページ · safety 下 | `match-love-consult` | 「恋愛の悩みを相談したいです。」 |
| 婚活相談 | マイページ · top 婚活向け | `match-marriage-consult` | 「婚活のアドバイスが欲しいです。」 |
| メッセージ相談 | talk-bridge · list（マッチ後） | `match-message-coach` | 「マッチ相手へのメッセージの書き方を相談したいです。」 |
| 相性詳細分析 | swipe card · 相性 % タップ | `match-compatibility-deep` | 「{nickname}さんとの相性を詳しく分析してください。簡易スコアは{percent}%で共通点{count}件です。」 |
| デート相談 | list · talk-bridge | `match-date-coach` | 「初デートのプランやマナーについて相談したいです。」 |

**実装例（計画）:**

```javascript
TasuAiWorkspaceLinks.buildUrl({
  mode: "match-profile-coach",
  q: "マッチング用プロフィールを改善したいです。",
  returnTo: location.pathname + location.search,
});
```

**TASFUL AI 側 TODO（別チーム / 別フェーズ）:** 上記 `mode` 6 種のプロンプトテンプレ · 課金ゲート · MATCH コンテキスト表示。**P15 MATCH スコープ外**だが mode 名は事前共有する。

### 8.3 やらないこと（再確認）

| 機能 | 提供場所 |
|------|----------|
| AI プロフィール作成 / 添削 UI | TASFUL AI |
| AI メッセージ補助（送信 UI） | TASFUL AI |
| AI 恋愛 / 婚活 / 相性診断の完結フロー | TASFUL AI |
| MATCH 専用 AI チャット画面 | **作らない** |

---

## 9. 初期リリース対象 / 後回し

### 9.1 P15 初期（MATCH 側）

| 含む | 含まない |
|------|----------|
| 7 機能すべて（DB + Edge + UI + stub 互換） | スーパーいいね |
| 簡易相性 · 完成度（ルール） | 音声/動画プロフィール |
| AI CTA 6 種（リンクのみ） | TALK/ビデオ通話 |
| 活動 bucket · 足あと柔らか表示 | オンライン中 |
| 検索条件 名前付き保存 | MATCH 内 AI チャット |
| `match_user_settings` 最小 | 足あと完全非表示 UI（DB のみ準備） |

### 9.2 後回し（利用者増加後）

| 項目 | 備考 |
|------|------|
| 足あとプレミアム · 非表示課金 | `footprint_visibility` 済み |
| 活動状況 OFF | `show_activity_status` 済み |
| 相性スコアキャッシュ | 負荷見て判断 |
| プッシュ通知（足あと・お気に入り） | ANPI/TALK 基盤流用検討 |
| `match-get-candidates` 本番 feed | swipe 実データ依存 |
| `tasful.jp` prod URL 全件確認 | **8 月まで保留** |

---

## 10. 実装順序（推奨）

| Phase | 内容 | 依存 | 検証 |
|-------|------|------|------|
| **P15-L1** | Migration: profile 拡張 · hobby tags · 4 新表 · SQL 関数（completeness/activity/footprint label） | L10–L12 | `verify-match-p15-schema.mjs`（新規） |
| **P15-L2** | RLS: 新表 policies · `match_profiles_public` VIEW · settings | L1 | `verify-auth-hook-l11` 拡張 or P15 RLS script |
| **P15-L3** | Edge: favorites · footprints · activity bump · saved search · compatibility/completeness read | L2 · JWT 本番化 | linked ref smoke |
| **P15-L4** | Client: `match-api.js` メソッド · `match-data-stub` · `match-wiring` | L3 | client_stub UI smoke |
| **P15-L5** | UI: 新 2 ページ + 既存 4 ページ拡張 · AI CTA · dist sync | L4 · `ai-workspace-links.js` | Playwright 390/768/1280 |
| **P15-L6** | 統合 smoke · レポート · prod-parity gate | L5 | `verify-match-p15-integration.mjs` |

**並行可能:** TASFUL AI 側 `mode` 6 種受け口（MATCH L5 より前でも可）

**既存 Edge DB 接続（swipe/report/block 等）:** P15 とは別トラックだが **L3 前に完了推奨** — 否则 favorites/footprints だけ先行すると UX 不整合

---

## 11. 検証項目

### 11.1 SQL / RLS

| # | 項目 | 期待 |
|---|------|------|
| 1 | legacy 7 metadata diff なし | count=7 · 内容不変 |
| 2 | allowlist T1–T5 | talk/member 維持 |
| 3 | 新表 RLS | 他ユーザー CRUD 拒否 |
| 4 | 足あと | viewer≠blocked · dedupe 1/day |
| 5 | favorites | self/block 不可 · 解除で archived |
| 6 | saved search | 他 user 参照不可 |
| 7 | activity | 生 `last_active_at` が他者 API で漏れない |

### 11.2 Edge / API

| # | 項目 | 期待 |
|---|------|------|
| 8 | T1 toggle favorite | 200 · list に反映 |
| 9 | T1 record view → T2 incoming | T2 list に label |
| 10 | bump activity | label が 24h 以内に |
| 11 | save search → run | 200 · 空結果も 200 |
| 12 | compatibility | 0–99 · common_points 配列 |
| 13 | completeness | 8 項目 · percent 一致 |
| 14 | guest / 未ログイン | auth_required |
| 15 | admin functions | 既存 403 維持 |

### 11.3 UI（prod-parity）

| # | 項目 | 期待 |
|---|------|------|
| 16 | 9+2 ページ HTTP 200 | dist sync |
| 17 | お気に入り add/remove | toast · 一覧 |
| 18 | 足あと表示 | 今日/昨日/N日前 |
| 19 | 活動 label | オンライン文言 **なし** |
| 20 | 相性 · 完成度 | 数値表示 · AI CTA リンク有効 |
| 21 | AI CTA 6 種 | `ai-workspace.html?mode=...` 遷移 |
| 22 | console error | 0（既知 warning のみ） |
| 23 | 390/768/1280 | 横スクロールなし |

### 11.4 自動化（計画）

```bash
node scripts/verify-match-p15-schema.mjs          # L1–L2
node scripts/verify-match-p15-edge-smoke.mjs        # L3 · T1 JWT
node scripts/verify-match-p15-ui-prod-parity.mjs    # L5 · --base http://127.0.0.1:8788
```

**本番:** 8 月以降 · 既存 `verify-match-ui-prod-url-review.mjs` に P15 ルート追加

---

## 12. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| 足あとによるストーカー不安 | 離脱 · 通報増 | 柔らか表示 · 将来非表示/プレミアム · block 連動 · 法務文言 |
| 活動状況の誤解 | 返信催促 | **オンライン中禁止** · bucket のみ · settings OFF 準備 |
| お気に入りと like の混乱 | UX | UI 文言分離 · DB 分離 · like は swipe 専用 |
| 相性 % の過信 | トラブル | 「簡易スコア」明示 · 詳細は AI へ · 免責 in safety |
| プロフィール項目不足 | 相性/完成度が薄い | L1 で purpose/恋愛観/hobby 昇格 · wizard step 追加 |
| RLS 複雑化 | 情報漏洩 | VIEW 経由探索 · base table は own only · Edge で view 記録 |
| Edge 増加 | 運用負荷 | 一覧系は GET+POST 統一 · stub 段階を維持してから DB |
| TASFUL AI mode 未実装 | CTA 遷移先が汎用 | `q` で文脈確保 · AI 側 mode は段階追加 · MATCH はリンクのみ |
| legacy metadata 破壊 | 本番事故 | migration 前 SQL gate · legacy 7 login 非触 · hook 回帰 |
| prod-parity のみ検証 | 本番差分 | 8 月 tasful.jp 再実行 · dist sync CI 継続 |
| スコープクリープ（AI 内蔵） | 方針逸脱 | 本計画 §1 · PR チェック · Builder AI policy 参照 |

---

## 13. 既存フェーズとの関係

| フェーズ | 状態 | P15 との関係 |
|----------|------|--------------|
| L10 schema | 適用済 | ALTER + 新表で拡張 |
| L11 RLS | 適用済 | 新 policies 追加 |
| L12 Hook EXCEPTION | 適用済 | 変更なし |
| Edge stubs → DB | 未完了 | **並行必須** · P15 前に swipe 等 |
| prod URL review | BLOCKED | P15 検証は prod-parity 基準 |
| Release candidate | 手前 | P15 完了 + prod URL PASS で RC |

---

## 14. 成果物（本フェーズ）

| ファイル | 状態 |
|----------|------|
| `reports/tasful-match-p15-feature-plan.md` | **本レポート（計画確定）** |
| `supabase/migrations/20260622*_match_p15_*.sql` | 未作成（L1 以降） |
| `scripts/verify-match-p15-*.mjs` | 未作成（L1 以降） |
| `match/match-favorites.html` 等 | 未作成（L5 以降） |

**次アクション:** P15-L1 migration ドラフト作成 → RLS レビュー → **legacy 7 / allowlist SQL gate 付き** linked ref 適用。**コード実装は本レポート承認後に開始。**

---

## 15. 参照

| 文档 | 路径 |
|------|------|
| MVP 画面設計 | `docs/match-mvp-design.md` |
| L10 schema | `supabase/migrations/20260621160000_create_match_schema.sql` |
| L11 RLS | `supabase/migrations/20260621170000_match_rls_d2.sql` |
| Schema draft | `supabase/migrations/20260621120000_match_schema_draft.sql` |
| AI リンク共通 | `ai-workspace-links.js` |
| prod URL review | `reports/tasful-match-ui-prod-url-review.md` |
| post-auth smoke | `reports/tasful-match-post-auth-final-smoke.md` |
