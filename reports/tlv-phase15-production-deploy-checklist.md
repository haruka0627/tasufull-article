# TLV Phase 15 — 非公開本番デプロイ前 最終チェックリスト

**目的:** Phase 14 の非公開本番テスト準備後、手動デプロイ〜Cloudflare Access 有効化〜smoke 確認まで漏れなく安全に進める。  
**許可ユーザー:** `rubi.hiro0613@gmail.com` のみ  
**関連:** [tlv-cloudflare-access-private-test-guide.md](./tlv-cloudflare-access-private-test-guide.md) · [talk-youtube-phase14-private-production-test-result.md](./talk-youtube-phase14-private-production-test-result.md)

---

## 使い方

1. **デプロイ前** — セクション A〜C をすべてチェック
2. **ビルド・デプロイ** — セクション D を順番に実施
3. **Access 有効化** — セクション E（要約 + 詳細は Access 手順書）
4. **本番 smoke** — セクション F
5. **事故防止** — セクション G を常に遵守

自動検証（デプロイ前に必ず実行）:

```bash
npm run verify:live-youtube-p15   # Phase 15 最終チェック + Phase 14 回帰
npm run verify:live-youtube-p14   # 非公開設定の単体確認（任意 · p15 に含まれる）
```

---

## A. デプロイ前チェック（環境・秘密情報）

### A-1. Cloudflare Pages 環境変数（Production）

| 変数 | 必須値 / 内容 | 確認 |
|------|---------------|------|
| `TASFUL_SUPABASE_URL` | 本番 Supabase プロジェクト URL | [ ] |
| `TASFUL_SUPABASE_ANON_KEY` | anon / publishable key のみ | [ ] |
| `TLV_PUBLIC_ENABLED` | **`false`** | [ ] |
| `TLV_PRIVATE_TEST_ENABLED` | **`true`** | [ ] |
| `TLV_ALLOWED_TEST_EMAILS` | **`rubi.hiro0613@gmail.com`** | [ ] |

**禁止:** `SUPABASE_SERVICE_ROLE_KEY` や `sb_secret_` を Pages 環境変数・クライアントに入れない。

### A-2. Supabase（本番）

| 項目 | 確認 |
|------|------|
| URL / anon key が本番プロジェクトを指している | [ ] |
| Edge Functions デプロイ済み: `live-video-admin` | [ ] |
| Edge Functions デプロイ済み: `live-monetization-admin` | [ ] |
| Edge Functions デプロイ済み: `live-security-events` | [ ] |
| Edge Function **secrets**（service role 等）が Dashboard にのみ存在 | [ ] |
| Phase 12/13 マイグレーション適用済み | [ ] |
| Storage バケット `live-videos` 等が本番で利用可能 | [ ] |
| RLS ポリシーが staging と同等 | [ ] |

### A-3. クライアントに service role が出ていないこと

| 確認対象 | 期待 |
|----------|------|
| `chat-supabase-config.js` | `anonKey` のみ · `service_role` / `sb_secret_` なし | [ ] |
| `deploy/cloudflare/dist/chat-supabase-config.js`（ビルド後） | 同上 | [ ] |
| `live/*.js` · HTML 内インライン | service role 文字列なし | [ ] |
| リポジトリにコミットされた `.env` | service role なし | [ ] |

### A-4. SEO・非公開設定（ソース）

| 項目 | 期待 | 確認 |
|------|------|------|
| `deploy/cloudflare/robots.txt` | `Disallow: /` | [ ] |
| TLV 8 ページ | `<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">` | [ ] |
| sitemap | リポジトリ / dist に `sitemap*.xml` なし、または `/live/` 非掲載 | [ ] |
| 一般導線 | `dashboard.html` · `index-top.html` · `company/*` に `/live/` 直リンクなし | [ ] |
| OGP / canonical | TLV ページに production live URL なし | [ ] |
| SNS シェア | TLV に本番 URL を載せるシェアボタンなし | [ ] |

### A-5. 自動検証（デプロイ前ゲート）

```bash
npm run verify:live-youtube-p15
```

- [ ] **PASS**（失敗時はデプロイしない）

---

## B. TLV feature flags 最終確認

ビルド後 `deploy/cloudflare/dist/live/tlv-feature-flags.js` を開き:

```javascript
publicEnabled: false
privateTestEnabled: true
allowedTestEmails: ["rubi.hiro0613@gmail.com"]
```

| フラグ | 非公開テスト中 |
|--------|----------------|
| `TLV_PUBLIC_ENABLED` | **false のまま** |
| `TLV_PRIVATE_TEST_ENABLED` | **true** |
| `TLV_ALLOWED_TEST_EMAILS` | **rubi.hiro0613@gmail.com のみ** |

- [ ] 上記 3 点をビルド成果物で確認した

---

## C. 本番 URL 漏洩防止（デプロイ前の最終確認）

- [ ] 本番 URL（`*.pages.dev` / `tasful.jp`）をチャット・メール・SNS に送っていない
- [ ] README / 社内 Wiki / OGP / footer / dashboard に production `/live/` を載せていない
- [ ] `TLV_PUBLIC_ENABLED=true` に変更していない
- [ ] `robots.txt` の `Disallow: /` を緩めていない
- [ ] noindex meta を外していない

---

## D. ビルド・Production デプロイ手順

**順番を守ること。** Access 有効化前に URL を広く開かない。

### D-1. 検証

```bash
npm run verify:live-youtube-p15
```

- [ ] PASS

### D-2. ビルド

```bash
npm run build:pages
```

- [ ] エラーなし
- [ ] `deploy/cloudflare/dist/robots.txt` に `Disallow: /`
- [ ] `deploy/cloudflare/dist/live/tlv-feature-flags.js` が private test 設定
- [ ] TLV 8 HTML に noindex meta

### D-3. Production デプロイ

- [ ] Cloudflare Pages **Production** ブランチへデプロイ
- [ ] デプロイ完了を Dashboard で確認
- [ ] **デプロイ直後、本番 URL を外部共有しない**
- [ ] **Cloudflare Access 有効化まで、URL を開く人を `rubi.hiro0613@gmail.com`（作業者）に限定**

### D-4. デプロイ直後（Access **前** · 作業者のみ）

シークレット以外のブラウザで開かない。作業者のみ spot 確認:

- [ ] `https://<production-host>/robots.txt` → `Disallow: /`
- [ ] `view-source:` で `/live/index.html` に noindex meta
- [ ] 一般導線（TOP / dashboard）に `/live/` リンクがない

---

## E. Cloudflare Access 有効化（要約）

**詳細:** [tlv-cloudflare-access-private-test-guide.md](./tlv-cloudflare-access-private-test-guide.md)

### E-1. Application

| 項目 | 値 |
|------|-----|
| Type | Self-hosted |
| Host | `tasufull-article.pages.dev`（+ カスタムドメイン利用時は `tasful.jp`） |
| **Path** | **`/live/*`**（深層防御でサイト全体も可） |
| Session | 24h（テスト期間 · 必要なら 8h） |

### E-2. Policy（必須）

| 項目 | 値 |
|------|-----|
| Action | **Allow** |
| Include | **Emails** = `rubi.hiro0613@gmail.com` |
| その他 | デフォルト **Block**（未許可は拒否） |

### E-3. 認証方式

- [ ] One-time PIN（推奨）または Google
- [ ] 許可メール以外はログインできないことを確認

### E-4. 有効化後の確認

| ケース | 期待 | 確認 |
|--------|------|------|
| Access 未認証 | TLV に入れない（ログイン画面） | [ ] |
| `rubi.hiro0613@gmail.com` | TLV に入れる | [ ] |
| 別メール | 入れない | [ ] |

### E-5. 緊急遮断

| 操作 | 手順 |
|------|------|
| 一時停止 | Access Application を **Disable** |
| 完全遮断 | Policy を Block only に変更、または DNS 一時停止 |
| 漏洩疑い | Access ログ確認 · JWT ローテーション検討 · デプロイ通知先確認 |

- [ ] 緊急遮断手順を把握している

### E-6. Supabase Auth（Access 有効化と同時）

- [ ] Redirect URLs に本番 URL を追加
- [ ] Site URL を本番にするタイミング = Access 有効化と同時

---

## F. 本番 smoke チェック（Access 有効化後）

**実施者:** `rubi.hiro0613@gmail.com` でログインしたブラウザ  
**各ページ:** console error 0（DevTools · 403/404 関数ログは許容）

### F-1. 入口・Access

- [ ] 未認証 → TLV 不可
- [ ] `rubi.hiro0613@gmail.com` → 通過
- [ ] 別メール → 拒否
- [ ] 「非公開本番テスト中」バナー表示

### F-2. TLV ページ到達（8 ページ）

- [ ] `/live/index.html`
- [ ] `/live/videos.html`
- [ ] `/live/watch-video.html`（公開動画 ID 付き）
- [ ] `/live/profile.html`
- [ ] `/live/my-videos.html`
- [ ] `/live/video-upload.html`
- [ ] `/live/creator-dashboard.html`
- [ ] `/live/admin-videos.html`（管理者 JWT / ロール）

### F-3. コア機能

- [ ] **投稿** — アップロード · 公開
- [ ] **再生** — qualified view（10 秒以上 or 30% で加算）
- [ ] **いいね**
- [ ] **通報** — 重複ブロック（同一ユーザー再通報 → 409 等）
- [ ] **広告** — impression dedup（同一セッション再表示で二重カウントしない）
- [ ] **risk flag** — 管理画面リスクタブに表示 · 対応操作
- [ ] **収益化申請** — creator-dashboard から申請
- [ ] **収益化審査** — admin 収益化タブで承認/却下
- [ ] **RPM 変更** — admin 広告タブ
- [ ] **管理者権限** — 非 admin は admin-videos 403

### F-4. UI / 回帰

- [ ] 390 / 768 / 1280 viewport · レイアウト崩れなし
- [ ] console error 0
- [ ] Phase 7/8 shell · パンくず · 戻る導線

### F-5. SEO（本番 URL で再確認）

- [ ] noindex meta（8 ページ）
- [ ] `/robots.txt` → `Disallow: /`
- [ ] 検索コンソールに手動登録していない

---

## G. 事故防止ルール（常時）

| ルール | 理由 |
|--------|------|
| **Access 有効化前に production URL を誰にも送らない** | 無防備アクセス防止 |
| **SNS / OGP / sitemap / footer / dashboard に載せない** | 検索・拡散防止 |
| **`TLV_PUBLIC_ENABLED=true` にしない** | 一般導線開放防止 |
| **`robots.txt` `Disallow:/` を外さない** | クローラ拒否 |
| **noindex を外さない** | インデックス防止 |
| **smoke 完了まで広告・一般導線は開けない** | 未完成機能の露出防止 |
| **service role をクライアントに注入しない** | 全 DB 漏洩防止 |
| **smoke 完了まで `TLV_PUBLIC_ENABLED` を変更しない** | 意図しない公開 |

---

## H. 完了条件

- [ ] セクション A〜C すべてチェック済み
- [ ] `npm run verify:live-youtube-p15` PASS
- [ ] `npm run build:pages` → Production デプロイ完了
- [ ] Cloudflare Access 有効化（`/live/*` · 許可メール 1 名）
- [ ] セクション F smoke 完了
- [ ] 本番 URL を一般公開導線に載せていない

---

## I. 関連コマンド一覧

```bash
# デプロイ前（必須）
npm run verify:live-youtube-p15

# 非公開設定のみ再確認
npm run verify:live-youtube-p14

# セキュリティ回帰
npm run verify:live-youtube-p13

# ビルド
npm run build:pages

# Production デプロイ後（手動 · Dashboard または wrangler pages deploy）
```

---

*Phase 15 · 最終更新: 2026-06-23*
