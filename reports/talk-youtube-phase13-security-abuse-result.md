# TASFUL LIVE YouTube型 TLV — Phase 13 セキュリティ・不正対策 結果

**日付:** 2026-06-23  
**対象:** TLV Phase 13 — 本番前セキュリティ / 不正利用抑止  
**ステージング:** `ddojquacsyqesrjhcvmn`

## 概要

収益化 DB 化（Phase 12）後の不正利用を抑止するため、再生・広告・通報に DB + Edge ベースの検証層を追加し、管理画面にリスクタブを実装しました。

## 成果物

| 種別 | パス |
|------|------|
| Migration | `supabase/migrations/20260703100000_live_security_p13.sql` |
| Edge Function | `supabase/functions/live-security-events/index.ts` |
| 視聴ページ | `live/live-watch-video.js` |
| 管理画面 | `live/live-admin-videos.js` |
| 収益リスク | `live/live-monetization-service.js` |
| 設定 / device_key | `live/live-config.js` |
| スタイル | `live/live.css` |
| 検証 | `scripts/verify-live-youtube-p13-security-abuse.mjs` |
| dist 同期 | `deploy/cloudflare/dist/live/` |

## DB スキーマ

### `live_video_view_events`
- 視聴秒数・比率・`counted`・拒否理由
- `user_id` / `device_key`（SHA-256 ハッシュのみ）で重複防止

### `live_ad_impression_events`
- 広告枠ごとの impression 記録・5分 dedup

### `live_risk_flags`
- `target_type`: user / video / ad / report
- `severity`: low / medium / high
- `status`: open / watching / resolved

### 通報重複防止
- `live_video_reports (video_id, reporter_talk_user_id)` に UNIQUE 制約追加

## Edge Function: `live-security-events`

| action | 権限 | 内容 |
|--------|------|------|
| `record_view_event` | ログイン必須 | 10秒 or 30% 視聴で加算・30分 dedup |
| `record_ad_impression` | 任意（JWT あれば紐づけ） | 5分 dedup・過多時 risk flag |
| `record_report_signal` | ログイン必須 | 重複拒否・詳細検証・burst 検知 |
| `list_risk_flags` | admin | 一覧 |
| `update_risk_flag` | admin | 確認 / 監視 / 収益化停止 / 非表示 / メモ |
| `resolve_risk_flag` | admin | 解決 |

`live-video-view` は Phase 2 回帰用に維持。視聴ページは **マウント時の即時加算を廃止**し、`record_view_event` のみ使用。

## クライアント変更

### 視聴 (`live-watch-video.js`)
- `<video>` の `timeupdate` / `pause` / `ended` で qualified view を送信
- 広告要素の `IntersectionObserver` で impression 記録（`data-ad-id` 付与）
- 通報は Edge 経由（失敗時のみ REST fallback）

### device_key (`live-config.js`)
- `tlv-anon-device-v1` に UUID 保存 → SHA-256 ハッシュして送信
- 個人情報は含めない

### 収益リスク (`live-monetization-service.js`)
- DB risk flags マージ
- `shouldExcludeFromRevenueEstimate()` — high / ad_over 等で推定収益ゼロ化可能
- 急増再生・端末 burst 等の判定強化

### 管理画面 (`live-admin-videos.js`)
- **リスク** タブ追加（5タブ目）
- 通報一覧に「通報荒らし疑い」バッジ
- リスク対応: 確認済み / 監視中 / 収益化停止 / 動画非表示 / メモ

## 検証

```bash
npm run verify:live-youtube-p13   # PASS（p12 回帰含む）
npm run verify:live-youtube-p12   # 回帰 PASS
```

| 区分 | 結果 |
|------|------|
| 静的コード / migration / Edge | PASS |
| 管理 UI リスクタブ | PASS |
| 390 / 768 / 1280 console | PASS |
| Phase 12 回帰 | PASS |
| Security API（動画 seed 時） | 視聴閾値 / dedup / 通報重複 / admin 権限 |

## 適用手順（staging）

```bash
npx supabase db query --linked -f supabase/migrations/20260703100000_live_security_p13.sql
npx supabase functions deploy live-security-events \
  --project-ref ddojquacsyqesrjhcvmn --no-verify-jwt --use-api --yes
```

## 完了条件

- [x] 再生・広告・通報の不正対策（DB + Edge）
- [x] 管理画面でリスク確認・対応操作
- [x] 収益化判断用 risk flag 蓄積
- [x] Phase 0〜12 回帰（p12 verify 経由）

## 既知の注意

- `live-video-view` はレガシー API テスト（p2/p4）用に残存。本番視聴 UI は qualified view のみ加算。
- IP は収集・保存しない（device_key ハッシュのみ）。
- 公開動画が staging に無い場合、verify は service role で seed してから API テストを実行。
