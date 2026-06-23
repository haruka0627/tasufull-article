# TLV 公開閲覧 RLS マイグレーション適用結果

適用日: 2026-06-24  
マイグレーション: `supabase/migrations/20260704100000_live_public_read_select.sql`  
適用方法: `npx supabase db query --linked --yes -f …`

## 適用内容

- `grant select` to `anon`: `live_shorts`, `live_creator_profiles`, `live_broadcasts`, `live_broadcast_messages`
- 公開 SELECT ポリシーを `anon, authenticated` に拡張
- `live_broadcasts` 公開条件に `scheduled` を追加
- insert / update / delete / admin ポリシーは未変更

## anon API 直接確認（適用後）

| テーブル | HTTP | permission denied | 件数 |
|----------|------|-------------------|------|
| live_videos | 200 | なし | 3（published） |
| live_shorts | 200 | なし | 0 |
| live_broadcasts | 200 | なし | 0 |

→ GRANT / RLS 修正は有効。ショート・配信は DB に公開データが未投入のため 0 件。

## ローカル UI 確認（`http://127.0.0.1:8788` + `?talkDev=1`）

| URL | permission denied 画面表示 | .live-error | 表示状態 | console permission warn |
|-----|---------------------------|-------------|----------|-------------------------|
| `/live/` | なし | なし | 配信セクション空状態 | なし |
| `/live/videos` | なし | なし | セクションフィード維持（動画カード 32） | なし |
| `/live/shorts` | なし | なし | 空状態 | なし |

### /live/videos セクションフィード

見出し: おすすめ → 人気の動画 → 新着動画 → その他のトピック（ショート棚はデータ 0 件のため非表示 — 正常）

## 確認項目チェックリスト

| # | 項目 | 結果 |
|---|------|------|
| 1 | permission denied が画面に出ない | ✅ |
| 2 | live_shorts 公開データありなら表示 | ⏳ DB 0 件のため空状態（API は 200） |
| 3 | live_broadcasts 公開データありなら表示 | ⏳ DB 0 件のため空状態（API は 200） |
| 4 | データ 0 件時は空状態 | ✅ |
| 5 | console は warn までで画面崩れなし | ✅（permission warn なし） |
| 6 | /live/videos セクションフィード維持 | ✅ |

## テストデータ投入（2026-06-24）

シード: [`sql/tlv-rls-verify-seed.sql`](../sql/tlv-rls-verify-seed.sql)  
クリエイター ID: `tlv_rls_verify_test`（既存本番行は未変更）

| 種別 | 投入件数 |
|------|----------|
| `live_creator_profiles` | 1（テスト用） |
| `live_shorts`（published） | **8** |
| `live_broadcasts` scheduled | 1 |
| `live_broadcasts` live | 1 |
| `live_broadcasts` ended | 1 |

タイトルはすべて `[TLV TEST]` プレフィックス付き。

### フロント修正（likes RLS は未変更）

`/live/shorts` が `talkDev` の仮ユーザー ID で `live_short_likes` を anon 照会していたため、`fetchUserLikes` は **Supabase セッションがある場合のみ** 実行するよう修正（`live-shorts.js`）。

## 実データ UI 確認（投入後）

| URL | 結果 |
|-----|------|
| `/live/` | 配信 3 件表示（live / scheduled / ended）· permission denied なし |
| `/live/videos` | セクションフィード維持 · ショート棚 2 段 × 各 6 件（計 12 カード/シェル） |
| `/live/shorts` | ショート 8 件表示 · 空状態ではない |

### チェックリスト（再確認）

| # | 項目 | 結果 |
|---|------|------|
| 1 | `/live/videos` ショート棚表示 | ✅ |
| 2 | `/live/shorts` 非空 | ✅（8件） |
| 3 | `/live` 配信セクション表示 | ✅（3件） |
| 4 | permission denied 画面なし | ✅ |
| 5 | console error なし | ✅（edge signed URL の warn のみ許容） |
| 6 | セクションフィード維持 | ✅ |
