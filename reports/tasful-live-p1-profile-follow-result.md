# TASFUL LIVE Phase 1 — プロフィール / フォロー実装結果

| 項目 | 内容 |
|------|------|
| 実行日 | **2026-06-23** |
| スコープ | LIVE プロフィール · クリエイターフォロー · 最小 UI · Supabase 接続 |
| 対象外 | ショート投稿 · ライブ配信 · 投げ銭 · Edge Function · TALK ルーム生成 |
| DB | `20260628100000_live_p0_schema.sql` ステージング適用済み |

---

## 判定

| 判定 | **Phase 1 完了 — smoke / 回帰 PASS** |
|------|--------------------------------------|
| 意味 | 最小 LIVE UI と Supabase CRUD（プロフィール / フォロー）が動作。TALK / MATCH 回帰問題なし |

---

## 1. 実装ファイル一覧

### HTML（`live/`）

| ファイル | 役割 |
|----------|------|
| [`live/index.html`](../live/index.html) | LIVE ハブ（設定 / プロフィール導線 · Phase 2 機能は disabled） |
| [`live/profile.html`](../live/profile.html) | クリエイタープロフィール表示（`?userId=`） |
| [`live/settings.html`](../live/settings.html) | 自分のプロフィール作成 / 更新 |

### JavaScript

| ファイル | 役割 |
|----------|------|
| [`live/live-config.js`](../live/live-config.js) | テーブル名 · ステータスラベル · `ensureSupabaseSession()` |
| [`live/live-profile.js`](../live/live-profile.js) | `live_creator_profiles` 取得 / upsert · 画面マウント |
| [`live/live-follow.js`](../live/live-follow.js) | `live_creator_follows` フォロー / 解除 |

### CSS / 共通

| ファイル | 役割 |
|----------|------|
| [`live/live.css`](../live/live.css) | LIVE 最小スタイル（ダーク · モバイルファースト） |
| [`breadcrumb-config.js`](../breadcrumb-config.js) | `live/*` パンくず追加 |
| [`scripts/verify-live-p1-profile-follow.mjs`](../scripts/verify-live-p1-profile-follow.mjs) | Phase 1 smoke（390 / 768 / 1280） |
| [`package.json`](../package.json) | `verify:live-p1` npm script |

---

## 2. 機能

| 機能 | 実装 | 備考 |
|------|------|------|
| プロフィール作成 / 更新 | `live/settings.html` | `bio` · 通知設定 · 初回のみ `creator_status` 選択 |
| `creator_status` 表示 | バッジ（下書き / 公開中 等） | 更新後は owner 変更不可（DB trigger） |
| `live_permission_status` 表示 | バッジ（未申請 / 本人確認済み 等） | 運営 / 本人確認フロー用 · 表示のみ |
| フォロー / 解除 | `live/profile.html` | 公開クリエイター（`active`）のみ RLS 許可 |
| `follower_count` 表示 | プロフィールカード | DB 値を表示（カウンタ同期は次 Phase / Edge） |
| TALK 相談導線 | `TALKで相談` ボタン | **UI のみ** · クリックで「次 Phase」アラート |
| ショート / 配信 / 投げ銭 | 未実装 | index で disabled カード表示 |

### Supabase 接続

- `chat-supabase-config.js` + `tasu-supabase-client.js`
- `TasuLiveConfig.ensureSupabaseSession()` で JWT を `auth.setSession` に反映
- RLS: `talk_current_user_id()` 前提（`auth-current-user.js` / `talkDev=1`）

---

## 3. 検証結果

### Phase 1 smoke

```bash
npm run verify:live-p1
```

| 区分 | PASS | FAIL | SKIP |
|------|------|------|------|
| 静的ファイル | 8 | 0 | 0 |
| 390 / 768 / 1280 UI + console | 21 | 0 | 3 |
| **合計** | **31** | **0** | **3** |
| exit | **0** | | |

SKIP: `u_store` プロフィール未作成のため TALK CTA / フォロー UI 未表示（想定内）

### P0 schema

```bash
npm run verify:live-p0-schema
```

**PASS** 68 / SKIP 38 / FAIL 0

### TALK / MATCH 回帰

| コマンド | 結果 |
|----------|------|
| `node scripts/verify-talk-chat-unify-p1.mjs` | **PASS** 22/22 |
| `node scripts/smoke-match-talk-room.mjs` | **PASS** 16 checks |

---

## 4. ローカル確認手順

```bash
# dist に live/ を反映後（または build:pages）
npm run dev
# ブラウザ
http://127.0.0.1:8788/live/index.html?talkDev=1
http://127.0.0.1:8788/live/settings.html?talkDev=1
http://127.0.0.1:8788/live/profile.html?userId=u_me&talkDev=1
```

JWT セッションがある場合は `talkDev` なしでも DB 読み書き可能。

---

## 5. 既知の制限（Phase 1）

| 項目 | 内容 |
|------|------|
| `follower_count` | フォロー操作後も DB カウンタは自動増減しない（Edge / trigger は次 Phase） |
| TALK ルーム | ボタンのみ · `ensure-talk-room` 未接続 |
| アバター / バナー upload | Storage + Edge 未実装（パス列のみ DB 予約） |
| `chat-supabase-config.js` | Pages build では env 注入 · ローカル dist には手動コピーが必要な場合あり |

---

## 6. 次ステップ（Phase 2 候補）

1. Edge: プロフィール画像 · signed URL
2. `follower_count` 同期（trigger または Edge）
3. `ensure-talk-room` + `service_type=live`
4. ショート投稿 UI
5. ライブ配信 UI（stub provider）

---

## 参照

- [tasful-live-p0-design.md](tasful-live-p0-design.md)
- [tasful-live-p0-schema-apply-result.md](tasful-live-p0-schema-apply-result.md)
- [tasful-live-p0-verify-script-result.md](tasful-live-p0-verify-script-result.md)
