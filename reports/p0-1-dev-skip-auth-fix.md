# P0-1 — DEV_SKIP_AUTH 本番経路無効化

**判定:** FIXED  
**対象:** C-1 `member-auth.js`

---

## 問題

`const DEV_SKIP_AUTH = true` がビルド定数として全 host で有効だった。

| 影響箇所 | 挙動 |
|----------|------|
| `guardMemberPage()` | 未ログインでも即 `true` |
| `isAuthenticatedSync()` / `isAuthenticated()` | 常に `true` |
| `guardLoginPage()` | ログイン済みリダイレクトもスキップ |
| `login.js` | `TasuMemberAuth.DEV_SKIP_AUTH` で開発用ショートカット表示 |

**ガード対象ページ（`MEMBER_GUARD_PAGES`）:** dashboard, profile-settings, payment-settings, notification-settings, my-listings, listing-management, sales-fees, chat-list, demo-* 系

---

## 対応

`isDevSkipAuthAllowed()` を追加し、host ベースで判定。

| host / 条件 | `DEV_SKIP_AUTH` |
|-------------|-----------------|
| `tasful.jp` / `www.tasful.jp` | **false** |
| `*.pages.dev` | **false** |
| `TASU_CHAT_SUPABASE_CONFIG.talkProductionMode === true` | **false** |
| `localhost` / `127.0.0.1` / `file:` | **true** |
| その他 + `?devSkipAuth=1` | **true** |

`TasuMemberAuth.DEV_SKIP_AUTH` は getter で実行時評価。`isDevSkipAuthAllowed` を export。

---

## 変更ファイル

- `member-auth.js`

---

## 検証

| コマンド | 結果 |
|----------|------|
| `npm run build:pages` | PASS |
| `npm run verify:pages-stage` | PASS |
| dist `member-auth.js` | `isDevSkipAuthAllowed` あり · `DEV_SKIP_AUTH = true` 定数なし |

**手動確認（推奨）**

1. pages.dev / tasful.jp で `dashboard.html` 直アクセス → `login.html?return=...` へリダイレクト
2. localhost で `dashboard.html` → 開発スキップ継続（従来どおり）

---

## 残課題

なし（本 P0-1 スコープ内）
