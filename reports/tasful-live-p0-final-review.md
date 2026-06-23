# TASFUL LIVE / Short & Live P0 — 最終統合レビュー

| 項目 | 内容 |
|------|------|
| 日付 | **2026-06-23** |
| 対象 | TASFUL LIVE P0（Phase 1〜7 完了後） |
| 環境 | staging `ddojquacsyqesrjhcvmn` · ローカル dist `http://127.0.0.1:8788` |
| 判定 | **Go（P0 技術完了）** — 本番公開は別途「規約・本番テスト」ゲート必須 |

**P0 目的（再確認）:** ショート + ライブ + TALK + 投げ銭 stub + 通知土台

---

## 16. Go / No-Go 判定

| 基準 | 結果 |
|------|------|
| すべての LIVE verify PASS | ✅（p0〜p7 すべて FAIL=0） |
| TALK / MATCH smoke PASS | ✅ |
| console error 0（追加 10 ページ × 3 viewport） | ✅ 30/30 |
| 既存機能への影響なし | ✅（p0-schema 未変更テーブル確認 · talk/match smoke PASS） |
| P0 除外機能の混入なし | ✅（Stripe 実決済・Stream 本接続・PK 等なし） |

### 総合判定: **Go（P0 完了）**

- **意味:** 設計どおりの P0 スコープは実装・検証済み。ステージングでの機能検証・デモ・次フェーズ設計に進める。
- **本番公開 Go ではない:** 規約・本人確認運用・実決済・Stream 本接続・本番テストは未完了（§15 参照）。

---

## 1. 実装済み機能一覧

| Phase | 機能 | 状態 |
|-------|------|------|
| **P0 schema** | `live_*` 9 テーブル · Storage 4 bucket · RLS 52 policies | ✅ 適用済み |
| **P1** | クリエイタープロフィール CRUD · フォロー/解除 · フォロワー数表示 | ✅ |
| **P2** | TALK 相談導線（`service_type=live` · `ensure-talk-room`） | ✅ |
| **P3** | ショートフィード · MP4 アップロード · いいね · owner signed URL | ✅ |
| **P4** | Edge `live-short-signed-url`（published のみ · TTL 300s） | ✅ デプロイ済み |
| **P5** | ライブ一覧/視聴/作成/スタジオ · コメント（live のみ）· status 遷移（stub 映像） | ✅ |
| **P6** | ギフト UI · `live_tips` stub insert · 送受信履歴 | ✅ |
| **P7** | Edge `live-notify` · `talk_notifications type=live` · 集計トリガー | ✅ デプロイ済み |

### 画面（実装 URL）

| 画面 | URL | 備考 |
|------|-----|------|
| LIVE ホーム | `live/index.html` | 配信セクション |
| ショートフィード | `live/shorts.html` | |
| ショート投稿 | `live/short-upload.html` | 日次/総数制限あり |
| ライブ視聴 | `live/watch.html?broadcast_id=` | stub プレビュー可 |
| 配信作成 | `live/create.html` | 権限ゲート |
| 配信スタジオ | `live/studio.html` | 開始/終了 = status 更新のみ |
| ギフト | `live/gifts.html` | stub 決済 |
| 応援履歴 | `live/tips.html` | |
| プロフィール | `live/profile.html?userId=` | フォロー · TALK CTA |
| 設定 | `live/settings.html` | |

---

## 2. 未実装 / P1 送り一覧

### P0 設計で明示除外（未実装 ✓）

Stripe Checkout 実決済 · Cloudflare Stream 本接続 · 料金/手数料確定 · 出金/残高/税務 · PK · コラボ · ランキング · レベル · 称号 · ガチャ · アバター · 事務所

### レビューで P1 送りと明記する項目

| 項目 | 備考 |
|------|------|
| Cloudflare Stream Live 本接続 | `stream_provider=stub` のみ運用 |
| Stripe Checkout / Connect 本接続 | `payment_status=stub` |
| 配信者開放条件の本決定 | `live_permission_status` は schema のみ |
| 料金 / 手数料 / 認定 / 専属制度 | `fee_rate` 等は placeholder |
| 通知 fanout 50 件超・リトライ | `BROADCAST_FANOUT_MAX=50` |
| 動画審査 / 通報運用 | `live_moderation_logs` は admin のみ |
| ショート圧縮 / サムネ生成 / CDN 最適化 | 生 MP4 アップロード |
| 規約 / ガイドライン / 本人確認運用 | 未整備 |
| 本番テスト | staging 検証のみ |
| `platform-notify-action-labels.js` LIVE CTA 統一 | 通知は DB 到達 · UI ラベル未統一 |
| `live/following.html` · `live/search.html` | 設計案のみ |
| ショート単体 `short.html` · 縦スワイプ全画面 | P0 はカードフィード |
| HLS.js / 実映像プレイヤー | stub プレースホルダ |
| `live-archives` Storage bucket | 設計 deferred |
| dashboard / talk-home からの LIVE 導線タイル | 未接続（任意 P0 後半） |
| プロフィール `tip_total` カラム | `live_tips` SUM 表示のみ |

---

## 3. 作成ファイル一覧

### `live/`（ソース）

**HTML（10）:** `index.html`, `shorts.html`, `short-upload.html`, `watch.html`, `create.html`, `studio.html`, `gifts.html`, `tips.html`, `profile.html`, `settings.html`

**JS（13）:** `live-config.js`, `live-profile.js`, `live-follow.js`, `live-talk-bridge.js`, `live-notify.js`, `live-shorts.js`, `live-short-upload.js`, `live-broadcasts.js`, `live-create.js`, `live-comments.js`, `live-tips.js`, `live-gifts.js`, `live.css`

### Edge Functions

- `supabase/functions/live-short-signed-url/index.ts`
- `supabase/functions/live-notify/index.ts`

### 検証スクリプト

- `scripts/verify-live-p0-schema.mjs`
- `scripts/verify-live-p1-profile-follow.mjs`
- `scripts/verify-live-p2-talk-link.mjs`
- `scripts/verify-live-p3-shorts.mjs`
- `scripts/verify-live-p4-short-signed-url.mjs`
- `scripts/verify-live-p5-broadcasts.mjs`
- `scripts/verify-live-p6-tips.mjs`
- `scripts/verify-live-p7-notify-counts.mjs`

### Phase 結果レポート

- `reports/tasful-live-p1-profile-follow-result.md` 〜 `tasful-live-p7-notify-counts-result.md`
- `reports/tasful-live-p0-design.md` · `tasful-live-p0-migration-review.md` ほか

### dist 同期

`deploy/cloudflare/dist/live/*` および Edge / migration の mirror あり

---

## 4. DB migration 一覧

| ファイル | 内容 | 適用 |
|----------|------|------|
| `20260628100000_live_p0_schema.sql` | 9 テーブル · RLS · Storage · helper functions | ✅ staging |
| `20260629100000_live_p0_counts.sql` | 集計 RPC · トリガー · guard bypass | ✅ staging（`db query --linked` で個別適用） |

**変更なし（確認済み）:** `talk_notifications`, `transaction_rooms`, `match_profiles`, `listings`, `builder_projects`

---

## 5. Edge Function 一覧

| 名前 | 役割 | JWT | デプロイ |
|------|------|-----|----------|
| `live-short-signed-url` | 公開ショートの signed URL（300s） | 要 Bearer | ✅ `ddojquacsyqesrjhcvmn` |
| `live-notify` | follow/tip/broadcast 通知 fanout · 集計 RPC | 要 Bearer（`--no-verify-jwt`） | ✅ 同上 |

**未作成（P0 対象外）:** `live-notify-fanout`（設計案名）· Stream ingest · Stripe webhook for tips

---

## 6. Storage bucket 一覧

| bucket | public | 用途 |
|--------|--------|------|
| `short-videos` | false | ショート MP4 · signed URL |
| `short-video-thumbnails` | false | サムネ（P0 最小） |
| `live-avatars` | true | クリエイターアバター |
| `live-thumbnails` | true | 配信サムネ |
| `live-archives` | — | **未作成（P1）** |

パス規約: `{talk_user_id}/{asset_id}.{ext}`

---

## 7. TALK 連携確認

| 項目 | 確認 |
|------|------|
| `live-talk-bridge.js` | `service_type=live` · `service_ref_id=creator` · `ensure-talk-room` |
| プロフィール CTA | 「TALKで相談」ボタン（他ユーザー閲覧時） |
| `transaction_rooms` スキーマ | **変更なし** |
| `verify-talk-chat-unify-p1` | **22/22 PASS** |
| `smoke-match-talk-room` | **PASS 16 checks** |

---

## 8. 通知連携確認

| 項目 | 確認 |
|------|------|
| `talk_notifications.type=live` | service_role insert 確認済み（p0-schema · p7） |
| `source=tasful_live` | Edge 経由 |
| payload | `body` 2 行目 JSON: `service_type`, `service_ref_id`, `event`, `actor_id` |
| dedupe | `live_notify_dedupe.event_key` |
| イベント | `follow_created` · `tip_created` · `broadcast_started` |
| クライアント直 fanout | **不可**（RLS）→ Edge のみ |
| `talkDev=1` | Edge スキップ（開発 stub） |

---

## 9. 集計確認

| 集計 | 更新方式 | 検証 |
|------|----------|------|
| `live_creator_profiles.follower_count` | follows INSERT/DELETE トリガー + RPC | p7 PASS |
| `live_shorts.like_count` | likes INSERT/DELETE トリガー + RPC | p7 PASS |
| `live_broadcasts.tip_total_yen_stub` | tips INSERT トリガー（broadcast 対象） | p7 PASS |
| プロフィール応援合計 | `live_tips` クライアント SUM | 表示のみ |

`follower_count` はオーナー直接 UPDATE 不可（guard + SECURITY DEFINER）。

---

## 10. RLS / セキュリティ確認

| 項目 | 結果 |
|------|------|
| `live_*` 全テーブル RLS enabled | migration 静的確認 + テーブル到達性 |
| anon による `live_shorts` 読取 | **拒否**（p0-schema） |
| `live_tips` クライアント UPDATE | **拒否**（p0 · p6 静的） |
| `live_moderation_logs` | admin のみ（ユーザー insert/read 拒否） |
| `live_notify_dedupe` | admin/service_role のみ |
| フォロー insert | `live_is_public_creator` 必須（active creator） |
| signed URL | published のみ · Edge 発行 |
| P0 除外コード | `live/` に Stripe Checkout / 実 Stream API なし |

---

## 11. UI smoke（390 / 768 / 1280px）

### 自動検証（phase scripts）

各 phase verify が担当画面を 3 viewport で smoke。console error 0（許容パターン除く）。

### 追加確認（最終レビュー実施）

`talkDev=1` · JWT `u_me` · base `http://127.0.0.1:8788`

| ページ | 390 | 768 | 1280 |
|--------|-----|-----|------|
| `live/index.html` | ✅ | ✅ | ✅ |
| `live/shorts.html` | ✅ | ✅ | ✅ |
| `live/short-upload.html` | ✅ | ✅ | ✅ |
| `live/watch.html?broadcast_id=stub` | ✅ | ✅ | ✅ |
| `live/create.html` | ✅ | ✅ | ✅ |
| `live/studio.html` | ✅ | ✅ | ✅ |
| `live/gifts.html` | ✅ | ✅ | ✅ |
| `live/tips.html` | ✅ | ✅ | ✅ |
| `live/profile.html?userId=u_creator` | ✅ | ✅ | ✅ |
| `live/settings.html` | ✅ | ✅ | ✅ |

**結果: 30/30 PASS · console error 0**

---

## 12. console error 0 確認

- phase verify 全 PASS（各 console:* チェック）
- 追加 10 ページ smoke 30/30 PASS
- 許容除外: favicon 404 · TasuLive* warn · CORS（検証スクリプト既定）

---

## 13. MATCH / Marketplace / Builder / TALK 回帰確認

| コマンド | 結果 |
|----------|------|
| `npm run verify:live-p0-schema` | PASS 68 / FAIL 0 / SKIP 38 |
| `node scripts/verify-talk-chat-unify-p1.mjs` | **22/22 PASS** |
| `node scripts/smoke-match-talk-room.mjs` | **PASS 16 checks** |

`verify:live-p0-schema` で `match_profiles` · `listings` 未変更到達確認済み。

---

## 14. 既知制限

1. **映像:** ライブは stub プレースホルダ。ショートは Storage signed URL（トランスコードなし）。
2. **決済:** ギフトは DB 記録のみ。Stripe 連携なし。
3. **通知:** `talkDev=1` では Edge 未呼び出し。本番パスは JWT + Edge 必須。
4. **fanout:** 配信開始通知は最大 50 フォロワー。
5. **migration 履歴:** `supabase db push` は未適用 MATCH キューで停止。live migrations は個別 `db query` 適用済み — **本番前に migration 履歴の整合が必要**。
6. **検索・フォロー中タブ・単体 short URL:** 未実装。
7. **ショートコメント:** P0 対象外（いいね + tip stub のみ）。
8. **verify:live-p2** の `P2-notify-deferred` は Phase 7 実装後 SKIP（スクリプト未更新）。

---

## 15. 本番公開前に必要な作業

### A. 規約・ガイドライン移行（最優先）

- [ ] LIVE 利用規約・コミュニティガイドライン（投稿・配信・投げ銭・年齢制限）
- [ ] クリエイター向け配信者規約（開放条件 · 禁止事項 · 著作権）
- [ ] 投げ銭・ギフトに関する表示（特定商取引・資金決済法の要否判断）
- [ ] プライバシーポリシーへの LIVE データ（動画 · ログ · 通知）追記
- [ ] 本人確認（`live_permission_status`）運用フロー文書化

### B. 本番テスト移行

- [ ] staging → production Supabase への migration 適用手順（履歴整合含む）
- [ ] Edge `live-short-signed-url` · `live-notify` の production デプロイ
- [ ] `talkDev` なし E2E（フォロー → 通知 · tip → 通知 · 配信開始 fanout）
- [ ] Storage CORS · CDN · 帯域 · ファイルサイズ上限の本番設定
- [ ] 負荷・fanout 50 超の挙動確認
- [ ] ロールバック手順（Edge 旧版 · migration down 方針）

### C. 技術ゲート（P1 と並行可）

- [ ] Cloudflare Stream Live 接続設計確定
- [ ] Stripe tips 本番化（`stripe-live-production-plan.md`）
- [ ] 料金・手数料・出金ポリシー確定

---

## 検証実行ログ（最終レビュー実施分）

実施日時: 2026-06-23 · dev server `http://127.0.0.1:8788`

| コマンド | PASS | FAIL | SKIP | Result |
|----------|------|------|------|--------|
| `npm run verify:live-p7` | 42 | 0 | 2 | **PASS** |
| `npm run verify:live-p6` | 49 | 0 | 0 | **PASS** |
| `npm run verify:live-p5` | 59 | 0 | 0 | **PASS** |
| `npm run verify:live-p4` | 30 | 0 | 1 | **PASS** |
| `npm run verify:live-p3` | 36 | 0 | 0 | **PASS** |
| `npm run verify:live-p2` | 35 | 0 | 7 | **PASS** |
| `npm run verify:live-p1` | 31 | 0 | 3 | **PASS** |
| `npm run verify:live-p0-schema` | 68 | 0 | 38 | **PASS** |
| `verify-talk-chat-unify-p1` | 22 | 0 | 0 | **PASS** |
| `smoke-match-talk-room` | 16 | 0 | 0 | **PASS** |
| 追加 10 ページ smoke | 30 | 0 | 0 | **PASS** |

---

## 次に進むべき準備（規約・本番テスト移行）

1. **規約パック作成** — LIVE 専用条項を `company/legal/` または配信者向け PDF/HTML として起草し、ギフト画面・投稿画面に同意チェックを載せる設計。
2. **本人確認運用** — `identity_verified` → `ops_approved` の審査 SLA・却下理由テンプレート。
3. **本番 migration ランブック** — `20260628100000` + `20260629100000` の production 適用と `supabase migration repair` 方針。
4. **本番 E2E チェックリスト** — `talkDev` なしで p7 相当の通知・集計を再実行。
5. **告知制御** — 本番 Go までは LIVE URL を限定公開（staging のみ / feature flag）。

---

**署名:** TASFUL LIVE P0 最終統合レビュー — 実装変更なし · 検証のみ実施
