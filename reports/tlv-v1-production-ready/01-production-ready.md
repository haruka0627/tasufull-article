# TLV Production Ready — 最終確認レポート

**生成日時:** 2026-06-25  
**対象 URL:** https://tasufull-article.pages.dev  
**前提:** Release Candidate 到達済み / コード変更なし（監査スクリプト追加のみ）

---

## Production Ready 判定

# **Production Ready**

**Critical: 0 件**

---

## 1. 本番 URL 監査

### 環境制約（重要）

本番 `tasufull-article.pages.dev` は **Cloudflare Access** で保護されています。  
未認証の Playwright / curl アクセスは TLV 本体ではなく **ログイン画面**（`rubi-hiro0613.cloudflareaccess.com`）に到達します。

| 項目 | 結果 |
|---|---|
| HTTP 404（TLV パス） | 未認証では CF Access 200（TLV 未到達） |
| TLV アプリの Console Error | **自動監査では評価不可**（CF Access 画面のみ観測） |
| Network Error（TLV API） | 同上 |
| Mixed Content | 検出なし（観測範囲内） |
| Layout / Scroll overflow | CF Access 画面で overflow なし |

**CF Access 画面で観測された console（全ページ共通）:**

| 分類 | 内容 |
|---|---|
| **Info** | `Loading the image 'data:image/svg+xml...'` — Cloudflare Access ロゴ SVG の CSP 通知。TLV アプリ起因ではない |

**認証後に実施推奨（手動）:** 11 ページの目視 + DevTools console/network 確認

---

## 2. localhost コード漏れ確認

### 本番ホストでのランタイム挙動（コードレビュー + localhost 上 prod シミュレーション）

| チェック | 本番期待 | 検証 |
|---|---|---|
| `shouldUseTlvDevDemo()` | `false` | ✅ `test-tlv-dev-auth-security.mjs` |
| `shouldUseTlvFollowLocalFallback()` | `false` | ✅ `test-tlv-prod-guest-check.mjs` |
| `shouldUseTlvNotifyLocalFallback()` | `false` | ✅ 同上 |
| `getTalkUserId()`（ゲスト） | `""` | ✅ 同上 |
| `talkDev=1` リンク露出 | なし（ゲスト） | ✅ prod-guest-check |
| `system-notify-dev` 動作 | localhost のみ | ✅ `isLocalTlvDevHost()` でブロック |

`tlv-dev-auth.js` の `isLocalTlvDevHost()` は `localhost` / `127.0.0.1` のみ `true`。  
`pages.dev` / `tasful.jp` では demo・localStorage fallback・force guest はすべて無効。

---

## 3. セキュリティ最終確認

| 領域 | 状態 | 根拠 |
|---|---|---|
| **JWT** | ✅ | `live-notify` Edge: `Valid user JWT required` (401) |
| **system 通知** | ✅ | `isOpsOrAdminFromClaims()` で 403 |
| **target_user_id** | ✅ | 必須バリデーション (400) |
| **follow / comment / live_started / video_published** | ✅ | 各 handler で actor JWT + DB 操作 |
| **RLS** | ✅ | Supabase migration 経由（変更なし） |
| **認証バイパス** | なし | P0/P1 修正維持、dev-auth-security PASS |

---

## 4. Production Build 確認（`deploy/cloudflare/dist`）

| 項目 | 結果 | 分類 |
|---|---|---|
| `localhost` / `127.0.0.1` 参照 | `tlv-dev-auth.js` 等に **ガード用**として存在 | **Info**（runtime で無効化） |
| `talkDev=1` 文字列 | `isTalkDevStubMode()` 経由のみ動作 | **Info** |
| `system-notify-dev.html` | dist に含まれる | **Low**（runtime localhost ガード + CF Access） |
| `debugger` | なし | ✅ |
| 有害 debug console | なし | ✅ |

**注:** `system-notify-dev` は dist に含まれるが、本番ホストではエラーメッセージのみ表示。将来的な hardening として dist から除外可能（non-blocker）。

---

## 5. Lighthouse 簡易確認

| ページ | 結果 |
|---|---|
| `videos.html` | **スキップ** — lighthouse パッケージ未インストール |
| `watch-video.html` | **スキップ** — 同上 |

**分類: Info** — 重大問題の有無は未計測。必要時は `npx lighthouse` で手動実行。

---

## 6. 最終 Playwright 結果（localhost :8788）

| スクリプト | Exit |
|---|---|
| `test-tlv-prod-guest-check.mjs` | ✅ 0 |
| `test-tlv-dev-auth-security.mjs` | ✅ 0 |
| `test-tlv-follow-dev-fallback.mjs` | ✅ 0 |
| `test-tlv-follow-notify-dev.mjs` | ✅ 0 |
| `test-tlv-comment-notify-dev.mjs` | ✅ 0 |
| `test-tlv-live-started-notify-dev.mjs` | ✅ 0 |
| `test-tlv-video-published-notify-dev.mjs` | ✅ 0 |
| `test-tlv-system-notify-dev.mjs` | ✅ 0 |
| `test-tlv-channel-audit.mjs` | ✅ 0 |

**9/9 PASS** — 有害 console 0（通知・フォロー・prod guest・dev auth）

---

## 7. Remaining Issues 一覧

| 分類 | 項目 | 説明 |
|---|---|---|
| **Info** | CF Access による自動本番監査制限 | 未認証では TLV ページ本体に到達不可。認証後の手動スモーク推奨 |
| **Info** | CF Access SVG console | Playwright 観測の CSP 通知。TLV 起因ではない |
| **Info** | Lighthouse 未実行 | パッケージ未導入 |
| **Low** | `system-notify-dev.html` が dist に同梱 | runtime localhost ガードあり。除外は optional hardening |
| **Low** | `videos.html` title が `VIEW` | 意図的英語表記（文字化けではない） |

### Critical / High / Medium

**なし**

---

## 修正ファイル一覧

| ファイル | 変更 |
|---|---|
| `scripts/audit-tlv-production-ready.mjs` | **新規** — 本番 URL 監査用（read-only） |
| `scripts/tmp-tlv-production-ready/report.json` | 監査出力 |
| アプリコード | **変更なし** |

---

## 結論

- **Critical 0 件** → **Production Ready**
- 通知 5 種・フォロー・prod guest・dev auth security・チャンネル audit すべて PASS
- 本番は CF Access + runtime dev ガード + Edge JWT/ops 制限で多層防御
- リリース後推奨: CF Access 認証済みセッションで主要 11 ページの手動スモーク + Lighthouse 任意実行
