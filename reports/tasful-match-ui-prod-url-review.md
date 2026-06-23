# TASFUL — MATCH UI prod URL review 結果

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 実施日時 | **2026-06-21** |
| 対象 ref | **`ddojquacsyqesrjhcvmn`** |
| 前提 | post-auth final smoke 判定 **`READY_FOR_MATCH_UI_PROD_URL_REVIEW`** |
| Hook | **ON** · **EXCEPTION** |
| RLS | **8/8** · policies **20** |

---

## 1. 最終判定

**`BLOCKED_WITH_REASON`**

**理由:** 検証ランナーから **`https://tasful.jp` が DNS/HTTP 到達不可**（`fetch failed` / nslookup timeout）。本番 URL 上の HTTP 200・デプロイ済み `chat-supabase-config.js` の ref 一致を **未確認**。

**補足（prod-parity は PASS）:** Cloudflare dist ローカル（`http://127.0.0.1:8788`）＋ linked ref Edge/API は **全チェック PASS**。バックエンド接続・dist 同期・UI 導線（T1 edge call / guest `auth_required`）は release candidate 水準。**本番ドメイン到達確認のみブロッカー**。

**解除条件:** 本番到達可能な環境で以下を再実行し、全 PASS なら **`READY_FOR_MATCH_RELEASE_CANDIDATE`**。

```bash
node scripts/verify-match-ui-prod-url-review.mjs --base https://tasful.jp
```

---

## 2. 実施サマリ

| # | 確認項目 | prod (`tasful.jp`) | prod-parity (`127.0.0.1:8788`) |
|---|----------|-------------------|----------------------------------|
| 1 | 各 MATCH ページ HTTP 200 | **未確認**（到達不可） | **PASS** · 9 routes |
| 2 | Cloudflare dist に最新 MATCH UI | **PASS** · 10 files hash-match | **PASS** |
| 3 | `chat-supabase-config.js` → `ddojquacsyqesrjhcvmn` | repo **PASS** · deployed **未確認** | repo **PASS** |
| 4 | Edge → linked ref deployed functions | **PASS** | **PASS** |
| 5 | T1 ログイン状態で主要導線 | prod UI **未確認** | **PASS** · T1 JWT → `match-record-swipe` |
| 6 | 未ログイン → ログイン導線または拒否 | **未確認** | **PASS** · top ログインリンク + swipe `auth_required` |
| 7 | report/block/verification 200 系 | **PASS**（API） | **PASS**（API + ページ 200） |
| 8 | admin-review 一般ユーザー 403 | **PASS** | **PASS** |
| 9 | console error 0（既知 warning のみ） | **未確認** | **PASS** |
| 10 | 390 / 768 / 1280px UI 崩れなし | **未確認** | **PASS** · 18 screenshots |
| 11 | legacy 7 / allowlist metadata diff なし | **PASS** | **PASS** |
| 12 | auth/rest/edge 5xx なし | **PASS** | **PASS** |

**自動検証**

```bash
# 本番 URL（デフォルト）— 2026-06-21 実施: FAIL（到達不可）
node scripts/verify-match-ui-prod-url-review.mjs

# prod-parity ローカル — 2026-06-21 実施: PASS（10/10）
node scripts/verify-match-ui-prod-url-review.mjs --base http://127.0.0.1:8788
```

---

## 3. 確認対象ページ（9 routes）

| 導線 | パス | prod-parity | プローブ |
|------|------|-------------|----------|
| MATCH top | `/match/match-top.html` | 200 | タイトル · ログインリンク |
| profile create | `/match/match-profile-create.html` | 200 | `[data-match-profile-wizard]` |
| swipe | `/match/match-swipe.html` | 200 | `[data-match-swipe-action='like']` |
| match list | `/match/match-list.html` | 200 | `[data-match-pair-list]` |
| talk bridge | `/match/match-talk-bridge.html` | 200 | `[data-match-talk-cta]` |
| safety | `/match/match-safety.html` | 200 | `.match-safety-hero` |
| report modal/page | `/match/match-report.html` | 200 | `[data-report-submit]` |
| block modal/page | `/match/match-block.html` | 200 | `[data-match-block-list]` |
| verification | `/match/match-verify.html` | 200 | `[data-verify-panel='1']` |

**本番 URL 例:** `https://tasful.jp/match/match-top.html` ほか上表と同じ `/match/` 配下。

---

## 4. Config · dist 同期

### 4.1 Repo `chat-supabase-config.js`

| 項目 | 値 |
|------|-----|
| Project URL | `https://ddojquacsyqesrjhcvmn.supabase.co` |
| anon key | anon JWT（`service_role` / `sb_secret` **なし**） |

### 4.2 Cloudflare dist MATCH sync

`match/` ソースと `deploy/cloudflare/dist/match/` を SHA-256 比較（10 ファイル）:

- `match-top.html`, `match-profile-create.html`, `match-swipe.html`, `match-list.html`
- `match-talk-bridge.html`, `match-safety.html`
- `match-api.js`, `match-auth.js`, `match-wiring.js`, `match.css`

**結果:** 全ファイル **hash-match**。

### 4.3 デプロイ済み config（本番）

| 項目 | 状態 |
|------|------|
| `https://tasful.jp/chat-supabase-config.js` | **未検証**（runner から tasful.jp 到達不可） |
| dist 内静的ファイル | `chat-supabase-config.example.js` のみ（本番 config は `deploy/cloudflare/stage-cloudflare-pages.mjs` が stage 時に repo から生成） |

**手動確認（本番到達可能な環境）:** 上記 URL が 200 かつ body 内 ref が `ddojquacsyqesrjhcvmn` であること。

---

## 5. Linked ref Edge API（T1 JWT）

| Function | 操作 | HTTP |
|----------|------|------|
| `match-record-swipe` | T1 like → t2 | **200** |
| `match-record-swipe` | self (t1→t1) | **422** |
| `match-submit-report` | harassment | **200** |
| `match-block-user` | block t3 | **200** |
| `match-submit-verification` | phone | **200** |
| `match-admin-review` | T1 dismiss | **403** |

**ベース URL:** `https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/*`

---

## 6. Auth / guest 導線（prod-parity UI）

| ケース | 確認 | 結果 |
|--------|------|------|
| T1 ログイン + `edge_stub` | swipe like → `match-record-swipe` 呼び出し | **PASS** · linked ref URL を request 捕捉 |
| 未ログイン · match-top | `../dashboard.html` ログインリンク | **PASS** |
| 未ログイン · match-swipe | `recordSwipe` → `code=auth_required` | **PASS** |

**注:** 現行 MATCH HTML は **UI MOCK** バッジ付き · デフォルト `client_stub`。本レビューでは T1/guest の API 境界のみ `edge_stub` で上書き検証。

---

## 7. SQL metadata / schema gates

`sql/match-post-auth-final-smoke-readonly.sql`:

| 指標 | 期待 | 実測 |
|------|------|------|
| `core_table_count` | 8 | **8** |
| `rls_enabled_count` | 8 | **8** |
| `policy_count` | 20 | **20** |
| `legacy_user_count` | 7 | **7** |
| `allowlist_backfill_count` | 5 | **5** |

---

## 8. API health

| エンドポイント | 5xx |
|----------------|-----|
| `/auth/v1/health` | **なし** |
| `/rest/v1/` | **なし** |
| Edge `OPTIONS match-record-swipe` | **なし** |

---

## 9. UI スクリーンショット（390 / 1280px）

**出力先:** `reports/screenshots/match-prod-url-review/`

| ページ | 390px | 1280px |
|--------|-------|--------|
| top | `top-390.png` | `top-1280.png` |
| profile-create | `profile-create-390.png` | `profile-create-1280.png` |
| swipe | `swipe-390.png` | `swipe-1280.png` |
| list | `list-390.png` | `list-1280.png` |
| talk-bridge | `talk-bridge-390.png` | `talk-bridge-1280.png` |
| safety | `safety-390.png` | `safety-1280.png` |
| report | `report-390.png` | `report-1280.png` |
| block | `block-390.png` | `block-1280.png` |
| verify | `verify-390.png` | `verify-1280.png` |

768px は横スクロール・プローブ・console チェックのみ（スクリーンショット省略）。

**console:** 既知パターン（favicon 404 · Deprecation）以外の error **0**。

---

## 10. 本番到達不可の詳細

| 観測 | 内容 |
|------|------|
| スクリプト default run | `tasful.jp reachability: fetch failed` |
| nslookup | DNS request timed out（runner ネットワーク） |
| 影響 | 本番 HTTP 200 · deployed config · 本番ドメイン上の auth 挙動を **自動では未完了** |

**推奨:** Cloudflare Pages デプロイ後、ブラウザまたは CI（本番 DNS 到達可能）で `--base https://tasful.jp` を再実行。

---

## 11. 成果物

| ファイル | 用途 |
|----------|------|
| `reports/tasful-match-ui-prod-url-review.md` | 本レポート |
| `scripts/verify-match-ui-prod-url-review.mjs` | prod URL 自動レビュー |
| `reports/screenshots/match-prod-url-review/*.png` | 390/1280px スクリーンショット（18 枚） |

---

## 12. 次フェーズ

| 項目 | 内容 |
|------|------|
| ブロッカー解除 | `tasful.jp` 到達可能環境で本スクリプトを `--base https://tasful.jp` で再実行 |
| 次判定（全 PASS 時） | **`READY_FOR_MATCH_RELEASE_CANDIDATE`** |
| 現判定 | **`BLOCKED_WITH_REASON`** — 本番 URL 未到達のみ |
