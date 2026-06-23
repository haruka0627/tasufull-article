# TLV Cloudflare Access — 非公開本番テスト手順書

**Phase 14** · 許可ユーザー: **`rubi.hiro0613@gmail.com` のみ**  
**重要:** Access 有効化前に本番 URL を SNS・README・一般 UI へ載せないこと。

---

## 1. 対象ホスト（いずれも保護必須）

| ホスト | 備考 |
|--------|------|
| `https://tasufull-article.pages.dev` | Pages デフォルト URL（DNS なしでも到達可能） |
| `https://tasful.jp` | 本番カスタムドメイン（利用時） |
| `https://www.tasful.jp` | www → apex リダイレクト推奨 |

`/live/*` だけでなく **サイト全体** を Access で保護すること（深層防御）。

---

## 2. 事前条件

- [ ] Cloudflare Zero Trust が有効
- [ ] Pages プロジェクト `tasufull-article` の Production デプロイ済み
- [ ] `robots.txt` · `noindex` · TLV feature flag がデプロイ済み（Phase 14）
- [ ] 本番 URL を外部に共有していない

---

## 3. IdP（認証方式）

### 推奨: One-time PIN（メール OTP）

1. Zero Trust → **Settings** → **Authentication**
2. **One-time PIN** を有効化
3. 許可メール `rubi.hiro0613@gmail.com` 宛に PIN が届く

### 代替: Google ログイン

- Google を IdP に追加
- Policy で **Emails** = `rubi.hiro0613@gmail.com` のみ Allow

---

## 4. Access Application 作成

### A. pages.dev（必須）

1. Zero Trust → **Access** → **Applications** → **Add an application**
2. Type: **Self-hosted**
3. Application name: `TASFUL TLV Private (pages.dev)`
4. **Session Duration:** `24 hours`（テスト期間 · 必要なら `8 hours` に短縮）
5. **Application domain:**
   - Subdomain: `tasufull-article`
   - Domain: `pages.dev`
   - Path: 空（サイト全体）または `/live/*`（TLV のみ · 推奨は全体）
6. **Policies** → Add policy:
   - Name: `Allow rubi only`
   - Action: **Allow**
   - Include: **Emails** → `rubi.hiro0613@gmail.com`
7. デフォルトは Block（Allow 以外拒否）

### B. カスタムドメイン（利用時）

同手順で Application を追加:

- Domain: `tasful.jp`
- Path: 空（全体保護）
- Policy: 上記と同一

### C. www

- `www.tasful.jp` 用に別 Application、または Redirect Rule で apex へ集約

---

## 5. 有効化後の確認手順

1. **シークレットウィンドウ**で `https://tasufull-article.pages.dev/live/videos.html` を開く
2. Cloudflare Access ログイン画面が表示されること
3. **未許可メール** → ログイン拒否
4. **`rubi.hiro0613@gmail.com`** → PIN / Google でログイン成功
5. TLV ページ表示 · 「非公開本番テスト中」バナー表示
6. `view-source:` で `<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">` を確認
7. `https://tasufull-article.pages.dev/robots.txt` → `Disallow: /`
8. 動画視聴 · 10秒以上視聴で view 加算 · 通報 · 管理画面を spot 確認

---

## 6. 無効化・緊急遮断

| 操作 | 手順 |
|------|------|
| **一時停止** | Access Application を **Disable** |
| **完全遮断** | Policy を Block only に変更、または DNS を一時停止 |
| **漏洩疑い** | Access ログ確認 · Supabase JWT ローテーション検討 · デプロイ通知先確認 |

---

## 7. Supabase 連携メモ

- Access 有効化**後**に Auth **Redirect URLs** へ本番 URL を追加
- **Site URL** を本番にするタイミング = Access と同時
- `service_role` キーはクライアントに注入しない（`chat-supabase-config.js` は anon のみ）

---

## 8. Pages 環境変数（ビルド時）

| 変数 | 非公開テスト推奨値 |
|------|-------------------|
| `TASFUL_SUPABASE_URL` | 本番 Supabase URL |
| `TASFUL_SUPABASE_ANON_KEY` | anon key |
| `TLV_PUBLIC_ENABLED` | `false` |
| `TLV_PRIVATE_TEST_ENABLED` | `true` |
| `TLV_ALLOWED_TEST_EMAILS` | `rubi.hiro0613@gmail.com` |

ビルド: `npm run build:pages`（`stage-cloudflare-pages.mjs` が `live/tlv-feature-flags.js` を生成）

---

## 9. 関連ドキュメント

- [talk-youtube-phase14-private-production-test-result.md](./talk-youtube-phase14-private-production-test-result.md) — 実装・smoke チェックリスト
- [tlv-phase15-production-deploy-checklist.md](./tlv-phase15-production-deploy-checklist.md) — **デプロイ前最終チェック（Phase 15）**
- [production-private-test-access-plan.md](./production-private-test-access-plan.md) — 横断モジュール計画（既存）
