# NB-3 STEP 3: ops / admin guard 実装レポート

**作成日:** 2026-06-18  
**前提:** [`auth-jwt-design-final.md`](auth-jwt-design-final.md) · [`auth-helper-step2-report.md`](auth-helper-step2-report.md)  
**種別:** 運営権限ガードのみ（Connect / 市場 / Builder JWT 化 · RLS · DB · Stripe **未変更**）

---

# 実装内容

## 新規 `auth-ops-guard.js`（`window.TasuAuthOpsGuard`）

| 関数 | 役割 |
|------|------|
| `canAccessOps()` | 運営 UI / ページ到達可否 |
| `isOpsPreviewAllowed()` | デモ preview 昇格可否（本番 **常に false**） |
| `requireOpsUser()` / `requireAdminUser()` | 権限不足時 403 表示 |
| `guardOpsPage()` | 専用 ops ページ入口ガード |
| `guardOpsPageFromBody()` | `data-page` から自動ガード |

### 許可条件（固定）

| 環境 | 許可 |
|------|------|
| **本番 host**（`tasful.jp` / `talkProductionMode=true`） | JWT **`is_ops=true`** または **`role=tasu_admin`** のみ |
| **デモ host**（localhost / 127.0.0.1 / file / `?talkDev=1`） | JWT ops · **または** preview（`?talkAdmin=1` / LS preview / `?anpi_admin=1`）· **または** ベンチ互換（E2E 用 localhost/file 開放） |

### 本番禁止（実装済）

- `?talkAdmin=1`
- `localStorage tasu_talk_admin_preview`
- `localStorage tasu_anpi_line_admin_v1`（`isAnpiLineAdmin` 経由）
- `?anpi_admin=1` による LS 自動設定
- sessionStorage ops token による **ページ到達昇格**（書込 PoC は従来どおり別レイヤ）

### 拒否時挙動

**403 静的パネル**に統一（`dashboard.html` / `login.html` へのリンク付き）。  
`talk-home` の `admin_ops`  audience は既存どおり **`talk-home.html?tab=chat` へ replace**（変更なし）。

---

## 既存コード接続

| ファイル | 変更 |
|----------|------|
| `talk-runtime.js` | `isTalkAdmin()` → `canAccessOps()` · 本番 preview 無効 |
| `ops-talk.js` | `isOpsAccessAllowed()` → guard 委譲 |
| `anpi-line-healthcheck.js` | 本番 `isAnpiLineAdmin()` → JWT ops のみ |
| `anpi-line-admin-page.js` | 本番 `?anpi_admin=1` → LS 設定しない |

## HTML script 追加（表示変更なし）

`talk-runtime.js` → `auth-current-user.js` → `auth-ops-guard.js` を追加:

- `admin-operations-dashboard.html`
- `admin-ai-operations-center.html`
- `support-trouble-center.html`
- `talk-ops-room.html`
- `anpi-line-admin.html`
- `talk-home.html`

---

# ガード追加箇所

| ページ | `data-page` | 方式 |
|--------|-------------|------|
| AI運営司令塔 | `admin-operations-dashboard` | 自動 403 |
| AI運営センター | `admin-ai-operations-center` | 自動 403 |
| 重要問い合わせセンター | `support-trouble-center` | 自動 403 |
| AI運営秘書（レガシー） | `talk-ops-room` | 自動 403 |
| LINE安否運用 | `anpi-line-admin` | 自動 403 |
| 運営TALK（talk-home） | — | `bootstrapTalkAudience()` + `canAccessOps()` |
| 運営TALK（ops-talk 埋込） | — | `isOpsAccessAllowed()` |

---

# 未対応箇所（意図的 · STEP 3 スコープ外）

| 対象 | 理由 | 将来 STEP |
|------|------|-----------|
| **`gen-ai-workspace.html`** | 一般利用者向け · ops 専用 UI なし | — |
| **`builder/admin-*.html`** | Builder JWT 化対象 | STEP 6 |
| **`builder-admin/admin-index.html`** | リンクハブ · 個別 admin へ遷移 | STEP 6 |
| **`dashboard.html` 運営 embed** | 会員ページ · ops セクションは `isAnpiLineAdmin` 表示制御のみ | STEP 4 以降 |
| **`supabase-ops-write-config.js`** | dual-write PoC · 書込 token 別系統 | STEP 8 RLS 再検証 |
| **Edge / API 書込** | フロント guard のみ · サーバ側 JWT 検証は未実装 | STEP 8 |
| **AI Workspace 管理 API** | ops 画面ではない | — |

---

# 今後 STEP 4 で触る箇所

| ID | 内容 |
|----|------|
| S4-1 | Connect onboarding LS → DB |
| S4-2 | `payment-settings.js` Connect 状態 |
| S4-3 | `tasful_connect_onboarding_v1` LS 廃止 |
| S4-4 | ops 書込 adapter の JWT bearer 統一（`getOpsAccessToken` 廃止方向） |

---

# 検証結果

### 実行コマンド

```bash
node scripts/test-auth-ops-guard.mjs
node scripts/test-auth-current-user.mjs
node scripts/test-admin-operations-dashboard-browser.mjs
```

| ケース | 結果 |
|--------|------|
| localhost demo（admin dashboard 表示） | ✅ PASS |
| localhost `?talkDev=1` | ✅ PASS |
| 本番想定（`talkProductionMode=true`）JWT なし | ✅ 拒否 |
| JWT ops（`is_ops` / `tasu_admin`） | ✅ 許可 |
| 本番 URL `?talkAdmin=1` 昇格 | ✅ 拒否 |
| 本番 LS preview / anpi admin | ✅ 拒否 |
| demo `talkAdmin=1` preview | ✅ 許可 |
| admin operations dashboard E2E（59 項目） | ✅ **All passed** |
| STEP 2 auth helper 回帰 | ✅ ALL PASS |

---

# STEP 3 判定

## **PASS**

| PASS 条件 | 状態 |
|-----------|------|
| 本番で URL 昇格不可 | ✅ |
| 本番で LS 昇格不可 | ✅ |
| JWT のみ許可（本番） | ✅ |
| デモ互換維持 | ✅ E2E 59/59 |
| STEP 4 Connect 移行へ進める | ✅ |

**次ステップ:** NB-3 STEP 4 — Connect 状態 JWT/DB 化（`payment-settings.js` · onboarding LS）

---

**参照:** [`auth-current-user.js`](../auth-current-user.js) · [`auth-ops-guard.js`](../auth-ops-guard.js) · [`scripts/test-auth-ops-guard.mjs`](../scripts/test-auth-ops-guard.mjs)
