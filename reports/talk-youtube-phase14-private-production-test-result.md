# TASFUL LIVE YouTube型 TLV — Phase 14 非公開本番テスト準備 結果

**日付:** 2026-06-23  
**対象:** TLV Phase 14 — 本番 URL / Edge / Storage / RLS での限定テスト準備  
**許可ユーザー:** `rubi.hiro0613@gmail.com` のみ（Cloudflare Access）

## 概要

一般公開せず、検索エンジン・一般導線から TLV を隔離し、Cloudflare Access 前提の非公開本番テストができる状態に整備しました。

## 成果物

| 種別 | パス |
|------|------|
| Feature flags | `live/tlv-feature-flags.js`（dev）· ビルド時 `dist/live/tlv-feature-flags.js` |
| 非公開バナー | `live/tlv-private-test-gate.js` |
| noindex HTML | `live/index.html` 他 7 ページ |
| robots.txt | `deploy/cloudflare/robots.txt` |
| Headers | `deploy/cloudflare/_headers`（`/live/*` + nosnippet） |
| ビルド注入 | `deploy/cloudflare/stage-cloudflare-pages.mjs` |
| Access 手順 | [tlv-cloudflare-access-private-test-guide.md](./tlv-cloudflare-access-private-test-guide.md) |
| 検証 | `npm run verify:live-youtube-p14` |

## 1. noindex / nofollow

対象 8 ページに以下を追加:

```html
<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">
```

- `live/index.html`
- `live/videos.html`
- `live/watch-video.html`
- `live/profile.html`
- `live/my-videos.html`
- `live/video-upload.html`
- `live/creator-dashboard.html`
- `live/admin-videos.html`

サイト全体ビルド時も `stage-cloudflare-pages.mjs` が全 HTML に robots meta を注入。

## 2. robots.txt

```
User-agent: *
Disallow: /
```

（非公開テスト中は全体拒否 · `/live/` 等はコメントで明示）

## 3. Feature flags

`window.TLV_FEATURE_FLAGS`:

| キー | 非公開テスト既定 |
|------|----------------|
| `publicEnabled` | `false`（`TLV_PUBLIC_ENABLED`） |
| `privateTestEnabled` | `true`（`TLV_PRIVATE_TEST_ENABLED`） |
| `allowedTestEmails` | `["rubi.hiro0613@gmail.com"]` |

挙動:

- `publicEnabled=false` → TLV ページに「非公開本番テスト中」バナー
- 一般導線（`dashboard.html` 等）に `/live/` 直リンクなし（grep 確認済み）
- 主ゲートは **Cloudflare Access**（クライアントはソフトチェックのみ）

## 4. 本番 URL 漏洩防止（確認結果）

| 項目 | 状態 |
|------|------|
| sitemap.xml | dist 内なし |
| OGP `og:url` on TLV pages | なし |
| canonical → live URL | なし |
| dashboard / index-top / company から `live/` リンク | なし |
| SNS シェアボタン on TLV | なし |

## 5. 環境変数・Secrets 整理

| 種別 | 配置 | クライアント露出 |
|------|------|----------------|
| `TASFUL_SUPABASE_URL` | Pages build env | `chat-supabase-config.js` |
| `TASFUL_SUPABASE_ANON_KEY` | Pages build env | `chat-supabase-config.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge secrets のみ | **不可** |
| Edge Function secrets | Supabase Dashboard | **不可** |
| `TLV_*` flags | Pages build env | `tlv-feature-flags.js`（メールのみ · 秘密ではない） |

開発: ローカル `chat-supabase-config.js` / `.env` · `talkDev=1` でバイパス可能。

## 6. 本番 smoke チェックリスト

Access 有効化**後**に実施:

### 入口・SEO

- [ ] Access 未認証 → TLV に入れない
- [ ] `rubi.hiro0613@gmail.com` → 入れる
- [ ] 未許可メール → 入れない
- [ ] noindex meta あり（8 ページ）
- [ ] `robots.txt` で Disallow
- [ ] sitemap 非掲載
- [ ] 一般導線に production live URL なし

### Supabase / Edge

- [ ] `live-video-admin` — admin JWT
- [ ] `live-monetization-admin` — admin JWT
- [ ] `live-security-events` — view / report / risk
- [ ] Storage — 動画アップロード · サムネイル

### RLS

- [ ] 投稿者本人 — 自分の動画 CRUD
- [ ] 一般ユーザー — 公開動画視聴 · いいね · 通報
- [ ] admin — 管理タブ · リスク · 収益化審査

### Phase 10–13 機能

- [ ] qualified view count（10秒 / 30%）
- [ ] ad impression dedup
- [ ] report duplicate block
- [ ] risk flag 表示・対応
- [ ] creator-dashboard
- [ ] admin-videos（動画 / 通報 / 広告 / 収益化 / リスク）

### UI

- [ ] 390 / 768 / 1280 · console error 0
- [ ] PC/スマホ TLV shell

## 7. 検証

```bash
npm run verify:live-youtube-p14   # noindex · robots · flags · 漏洩 · p13 回帰
npm run verify:live-youtube-p13   # セキュリティ回帰
```

**結果（2026-06-23）:** `verify:live-youtube-p14` — **PASS 49/49**

**Phase 15:** デプロイ前最終チェックは [tlv-phase15-production-deploy-checklist.md](./tlv-phase15-production-deploy-checklist.md) · `npm run verify:live-youtube-p15`

回帰修正（検証・安定化）:

- `live-admin-videos.js` — タブ切替の競合防止（非同期パネルに `isActive` ガード）
- `verify-live-youtube-p13-security-abuse.mjs` — `device_key` を 64 文字以内の別ハッシュに分離（Edge 400 回避）

## 8. デプロイ手順

```bash
# Pages 環境変数を設定後
npm run build:pages
# Cloudflare Pages Production デプロイ
# その後 Zero Trust Access を有効化（手順書参照）
```

## 完了条件

- [x] TLV が検索エンジンに出ない設定（meta · robots · headers）
- [x] 一般導線から本番 TLV へ露出しない
- [x] Cloudflare Access 手順書（許可メール 1 名）
- [x] 本番 smoke チェックリスト
- [x] Phase 13 回帰（verify 経由）

## 未実施（意図的）

- **Cloudflare Access の有効化そのもの** — 手順書のみ（本番 URL 漏洩防止のため実装フェーズでは実行しない）
- **一般公開** — `TLV_PUBLIC_ENABLED` は `false` のまま
