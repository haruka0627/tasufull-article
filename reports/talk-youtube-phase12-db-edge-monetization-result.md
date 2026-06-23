# TASFUL LIVE YouTube型 TLV — Phase 12 収益化 DB + Edge 化 結果

**日付:** 2026-06-23  
**対象:** TLV Phase 12 — 収益化申請・審査・RPM を Supabase DB + Edge Function へ移行  
**ステージング:** `ddojquacsyqesrjhcvmn`

## 概要

Phase 10/11 の localStorage スタブを、本番運用可能な DB + RLS + Edge Function 構成へ移行しました。クライアントは **Supabase / Edge 優先**、ネットワーク障害時のみ localStorage にフォールバックします。

## 成果物

| 種別 | パス |
|------|------|
| Migration | `supabase/migrations/20260702100000_live_monetization_p12.sql` |
| Edge Function | `supabase/functions/live-monetization-admin/index.ts` |
| Service 層 | `live/live-monetization-service.js` |
| Creator UI | `live/live-creator-dashboard.js` |
| Admin UI | `live/live-admin-videos.js` |
| 設定 | `live/live-config.js` |
| 検証 | `scripts/verify-live-youtube-p12-db-edge-monetization.mjs` |
| dist 同期 | `deploy/cloudflare/dist/live/` 上記 JS 一式 |

## DB スキーマ

### `live_creator_monetization`

- `user_id` **text**（`talk_user_id` · `live_creator_profiles.user_id` FK）
- `status`: `not_applied` \| `pending` \| `approved` \| `rejected` \| `suspended`
- 申請日時 `applied_at`、審査 `reviewed_at` / `reviewed_by`、運営メモ `note`

### `live_ad_rpm_settings`

- `scope`: `global` \| `ad` \| `video`
- `rpm_yen`（デフォルト 100）、`active`
- グローバル active 行を seed（100 円 / 1000 表示）

### `live_monetization_audit_logs`

- `action`: apply / approve / reject / suspend / resume / save_note / update_rpm / create_rpm
- `metadata` jsonb（previous/new value, source_page, intent）

> **設計メモ:** 仕様書の `user_id uuid` は既存 LIVE テーブルとの整合のため **text `talk_user_id`** で実装。主キー `id` のみ uuid。

## RLS

| テーブル | 一般ユーザー | 運営 |
|----------|-------------|------|
| `live_creator_monetization` | 本人 read · `not_applied`/`rejected` → `pending` 申請のみ | 全操作 |
| `live_ad_rpm_settings` | active 設定 read | read / insert / update |
| `live_monetization_audit_logs` | — | read のみ（insert は Edge / trigger） |

トリガー:

- `live_creator_monetization_guard_owner_update` — 本人の不正 status 遷移を拒否
- `live_monetization_audit_on_apply` — 申請時に `apply` 監査ログを自動記録

## Edge Function: `live-monetization-admin`

- JWT 必須 + `tasu_admin` / `match_admin` / `is_ops`（`live-video-auth` 共有）
- anon → **401**、一般ユーザー → **403**、admin → OK

| action | 内容 |
|--------|------|
| `list_applications` | 申請一覧 + 動画集計 stats |
| `get_application_detail` | 詳細 + プロフィール + 監査ログ |
| `review_application` | approve / reject / suspend / resume / save_note |
| `list_rpm_settings` | RPM 一覧 |
| `update_rpm_setting` | RPM 更新 + 監査 |
| `create_rpm_setting` | RPM 新規（global は既存 active を無効化） |

デプロイ:

```bash
npx supabase functions deploy live-monetization-admin \
  --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes
```

（Gateway JWT は無効・関数内 `requireVerifiedAdmin` で検証 — `live-video-admin` と同パターン）

## クライアント変更

### `live-monetization-service.js`

- `getRecordAsync` / `applyMonetization` / `getGlobalRpmYenAsync` / `getAdRpmAsync`
- `listApplicationsViaEdge` / `reviewApplicationViaEdge` / RPM Edge API
- ネットワーク失敗時のみ `getRecordLocal` / localStorage RPM

### `live-creator-dashboard.js`

- DB からステータス取得・申請
- 申請可能: `not_applied` / `rejected` のみ（pending / approved / suspended は不可）
- 推定収益: `live_ad_rpm_settings` の global RPM 優先 → `CREATOR_ESTIMATED_RPM_YEN` fallback

### `live-admin-videos.js`

- 収益化審査タブ: Edge 経由一覧・審査操作
- 広告 RPM 保存: `setAdRpmAsync` → DB + Edge
- Edge 失敗時 localStorage フォールバック

### `live-config.js`

- `MONETIZATION_ADMIN_FUNCTION` / `fetchMonetizationAdminViaEdge`
- `normalizeMonetizationStatus`（`none` → `not_applied`）
- テーブル名定数追加

## 検証結果

```bash
npm run verify:live-youtube-p12   # PASS 36/36
npm run verify:live-youtube-p11   # 回帰 PASS（p12 内 regression 含む）
```

| 区分 | 結果 |
|------|------|
| Migration / SQL 静的確認 | PASS |
| Edge anon 401 / 非 admin 403 / admin OK | PASS |
| 申請一覧・詳細・承認・却下相当・停止・再開 | PASS |
| RPM 変更 + 監査ログ | PASS |
| 投稿者申請・重複拒否 | PASS |
| 390 / 768 / 1280 console error 0 | PASS |
| Phase 11 回帰 | PASS |

## 適用手順（staging）

```bash
npx supabase db query --linked -f supabase/migrations/20260702100000_live_monetization_p12.sql
npx supabase functions deploy live-monetization-admin --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes
```

## 既存機能への影響

- Phase 0〜11 の動画管理・通報・広告・チャンネル・投稿/再生/いいね・PC/スマホ UI は回帰テストで維持
- localStorage キー（`tlv-creator-monetization-v1` 等）は **fallback のみ** に整理
- Phase 10 `ui-apply-button` 検証は DB 上 pending 時もステータス表示で PASS するよう微調整

## 完了条件チェック

- [x] 収益化申請・審査・RPM が DB 管理
- [x] 運営操作が Edge + 権限チェック + 監査ログ付き
- [x] localStorage は fallback のみ
- [x] 既存 TLV 機能の回帰なし（p11 経由確認）
