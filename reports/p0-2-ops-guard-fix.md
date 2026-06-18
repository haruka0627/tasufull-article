# P0-2 — ops 系 auth-ops-guard 統一配線

**判定:** FIXED  
**対象:** C-2 `auth-ops-guard.js`

---

## 問題（配線前）

| 項目 | 状態 |
|------|------|
| `auth-ops-guard.js` | 実装済み · dist に同梱 |
| HTML 参照 | **0 件**（全 ops ページ未配線） |
| 直接 URL アクセス | 一般会員 / 未ログインでも ops UI 表示 |

**`OPS_GUARDED_PAGES` 定義（5 件）**

| `data-page` | HTML |
|-------------|------|
| `admin-operations-dashboard` | `admin-operations-dashboard.html` |
| `admin-ai-operations-center` | `admin-ai-operations-center.html` |
| `support-trouble-center` | `support-trouble-center.html` |
| `talk-ops-room` | `talk-ops-room.html` |
| `anpi-line-admin` | `anpi-line-admin.html` |

**スコープ外（C-3 / 別件）:** `anpi-line-healthcheck.js` の `?anpi_admin=1` / LS バイパス

---

## 対応

各 ops HTML に auth stack を `chat-supabase-config.js` 直後に追加:

```html
<script src="talk-runtime.js"></script>
<script src="auth-current-user.js"></script>
<script src="auth-ops-guard.js"></script>
```

`auth-ops-guard.js` は `DOMContentLoaded` で `guardOpsPageFromBody()` を自動実行。  
拒否時は 403 パネル（`tasu-ops-forbidden`）。

**付随修正:** `talk-runtime.js` — `isTalkAdminPreviewActive()` が本番モードでも `?talkAdmin=1` / LS を許可していたため、`isTalkProductionMode()` 時は preview を無効化（ops guard と整合）。

---

## 変更ファイル

| ファイル | 変更 |
|----------|------|
| `admin-operations-dashboard.html` | auth stack 追加 |
| `admin-ai-operations-center.html` | auth stack 追加 |
| `support-trouble-center.html` | auth stack 追加 |
| `talk-ops-room.html` | auth stack 追加 |
| `anpi-line-admin.html` | auth stack 追加 |
| `talk-runtime.js` | 本番 preview 無効化 |

---

## 検証

| コマンド | 結果 |
|----------|------|
| `npm run build:pages` | PASS |
| `npm run verify:pages-stage` | PASS（`auth-ops-guard.js` 同梱確認） |
| dist HTML grep | 上記 5 ページすべて `auth-ops-guard.js` 参照 |
| `node scripts/test-auth-ops-guard.mjs` | **コア PASS**（admin-operations-dashboard: localhost / prod シミュレーション / JWT ops / URL·LS 昇格ブロック） |

**テスト注記:** スクリプト末尾の `talk-home.html` セグメント（`TasuAuthOpsGuard` ロード待ち）は **本 P0 スコープ外**。talk-home は `OPS_GUARDED_PAGES` に含まれず auth-ops-guard 未配線のため timeout。ops 5 ページのガード要件は満たす。

**期待挙動**

| アクセス者 | 本番 host | 結果 |
|------------|-----------|------|
| 未ログイン | pages.dev / tasful.jp | 403 |
| 一般会員 JWT | 同上 | 403 |
| ops JWT (`is_ops` / `tasu_admin`) | 同上 | 通過 |
| localhost デモ | — | 従来互換（`canAccessOps` via demo mode） |

---

## 残課題

- `talk-home.html` への `auth-ops-guard.js` 読み込み（admin_ops API 用 · テスト完全 PASS 用）は別タスク
- ANPI LS バイパス（C-3）は未着手
