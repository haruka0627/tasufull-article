# TASFUL MATCH — client_stub 棚卸し監査

| 項目 | 内容 |
|------|------|
| 版 | v1.0 |
| 作成日 | **2026-06-22** |
| 目的 | β公開対象ページにおける `client_stub` / `edge_stub` / `live` の接続状態を一覧化 |
| 優先方針 | **live > edge_stub > client_stub**（βページは client_stub 禁止） |

---

## 1. API モード定義

| モード | 説明 | β公開 |
|--------|------|-------|
| **live** | 実 JWT + Edge Functions fetch（`match-bootstrap.js` 自動構成） | **必須** |
| **edge_stub** | 旧検証名。`match-api.js` では `isLiveMode()` に統合（`live` と同等扱い） | 可（移行中） |
| **client_stub** | ブラウザ内固定デモ応答（`match-api.js` L9 デフォルト） | **禁止** |

---

## 2. client_stub 一覧（フロント）

### 2.1 コア（意図的デフォルト · 要 live 昇格）

| ファイル | 役割 | β方針 |
|----------|------|-------|
| `match/match-api.js` | API 層。`mode: "client_stub"` が初期値。全 Edge 呼び出しの分岐元 | ログイン + bootstrap で **live へ自動昇格** |
| `match/match-wiring.js` | UI イベント。`apiMode === "client_stub"` 時はスタブ応答を表示 | live 時は wiring が Edge 結果を描画 |
| `match/match-mock.js` | デモ用モック注入。live 時は no-op | 本番無効（既存ガードあり） |
| `match/match-data-stub.js` | 静的プロフィール/候補データ | HTML に script 同梱。**live wiring が優先されれば表示のみフォールバック** |
| `match/match-data-render.js` | スタブ描画。`isLiveMode()` 時は早期 return | live 優先済 |
| `match/match-profile-wiring.js` L152 | 写真未選択時 `{ mode: "client_stub" }` 返却 | **要修正** — live でもローカル preview 用途 |

### 2.2 HTML（match-data-stub.js 読込 — 16 ページ）

β対象で `match-data-stub.js` を読み込むが、**live wiring 有効時は API データが優先**されるページ:

- `match-swipe.html` · `match-list.html` · `match-talk-bridge.html`
- `match-profile-create.html` · `match-mypage.html`
- `match-block.html` · `match-report.html` · `match-verify.html`
- `match-search.html` · `match-search-results.html` · `match-search-saved.html`
- `match-favorites.html` · `match-footprints.html`
- `match-review.html`（デバッグページ）

**非β / スタブ許容:**

- `match-top.html` — ランディングのみ（API 未使用）
- `match-ai-*.html` — AI コーチ系（MATCH API 非依存 · 別途確認）
- `match-admin.html` — 管理（live 必須 · wiring ガードあり）

### 2.3 検証スクリプト（意図的 client_stub 期待）

| スクリプト | 用途 |
|------------|------|
| `verify-match-*-live.mjs` | `?client_stub=1` または未ログイン smoke でデフォルト確認 |
| `smoke-match-p15-l5-dist-sync.mjs` | dist 同期 + UI smoke |

**β公開後:** smoke は `?client_stub=1` 明示時のみ client_stub PASS とする（本番パスは live 期待に更新推奨）。

---

## 3. live 化済み一覧

### 3.1 Edge Functions（linked ref 検証済）

| 機能 | Function | 検証スクリプト |
|------|----------|----------------|
| プロフィール | `match-upsert-profile` | `verify-match-profile-live.mjs` 19/19 |
| 候補フィード | `match-search-profiles` | `verify-match-feed-live.mjs` 41/41 |
| スワイプ | `match-record-swipe` | `verify-match-linked-ref-e2e.mjs` |
| マッチ一覧 | `match-list-pairs` | 同上 51/51 |
| TALK ルーム | `match-ensure-talk-room` | 同上 |
| マッチ解除 | `match-unmatch-pair` | `verify-match-unmatch-live.mjs` 25/25 |
| ブロック/通報 | `match-block-user` · `match-submit-report` | `verify-match-safety-live.mjs` 29/29 |
| 本人確認 | `match-submit-verification` | `verify-match-verification-live.mjs` 25/25 |
| 管理審査 | `match-admin-review` | `verify-match-admin-live.mjs` 31/31 |
| P15 系 | favorites · views · search · activity 等 | E2E / P15 smoke |

### 3.2 フロント wiring（live / edge_stub 分岐 → `isLiveMode()` 統一済）

| ファイル | live 接続 |
|----------|-----------|
| `match-feed-wiring.js` | スワイプフィード |
| `match-core-wiring.js` | マッチ一覧 |
| `match-profile-wiring.js` | プロフィール作成 |
| `match-unmatch-wiring.js` | 解除 |
| `match-verification-wiring.js` | 本人確認 |
| `match-admin-wiring.js` | 管理 |
| `match-p15-wiring.js` | 検索・お気に入り等 |

### 3.3 本番 JWT 配線（P1 · 2026-06-22 実装）

| ファイル | 内容 |
|----------|------|
| `match-auth.js` | Supabase `access_token` · refresh |
| `match-bootstrap.js` | 実 JWT → `mode: live` |
| `chat-supabase-config.js` | `__MATCH_FUNCTIONS_BASE__` |
| β HTML 16 件 | Supabase deps + `match-bootstrap.js` 追加 |

---

## 4. edge_stub 残存（移行中）

| 箇所 | 状態 |
|------|------|
| `match-api.js` `isLiveMode()` | `edge_stub` を live と同等扱い（後方互換） |
| URL `?edge_stub=1` | 手動 live 強制（bootstrap） |
| 検証スクリプト | Playwright で `mode: "edge_stub"` 設定残存 |
| `deploy/cloudflare/dist/match/*` | **未同期** — 旧 edge_stub のみ |

---

## 5. β公開対象ページ — client_stub 判定

| ページ | 未ログイン | ログイン + bootstrap | 判定 |
|--------|------------|----------------------|------|
| match-swipe.html | client_stub（デモ） | **live** | β可（要ログイン） |
| match-list.html | client_stub | **live** | β可 |
| match-talk-bridge.html | client_stub | **live** | β可 |
| match-profile-create.html | client_stub | **live** | β可 |
| match-mypage.html | client_stub | **live** | β可 |
| match-verify.html | client_stub | **live** | β可 |
| match-block/report/safety | client_stub | **live** | β可 |
| match-search 系 | client_stub | **live** | β可 |
| match-favorites/footprints | client_stub | **live** | β可 |
| match-admin.html | 不可 | **live** | β可（管理者のみ） |
| match-top.html | N/A | N/A | LP · stub 無関係 |

**本番ホスト（tasful.jp）:** `match-bootstrap.js` が `client_stub` を console.error — **未ログインは API 呼び出し不可**（P3 招待ゲートと合わせて UX 要改善）。

---

## 6. 残課題

| 優先 | 課題 | 対応案 |
|------|------|--------|
| P0 | `deploy/cloudflare/dist/match/` が旧版 | `smoke-match-p15-l5-dist-sync.mjs` 実行 |
| `match-bootstrap.js` 同梱 |
| P0 | 未ログイン時の UX | ログインリダイレクト + P3 招待コード |
| P1 | `match-data-stub.js` script 同梱 | live 時は遅延 load または削除 |
| P1 | 検証 smoke の client_stub デフォルト期待 | 本番パスは live 期待に更新 |
| P2 | AI コーチ 6 ページ | API 依存調査 · stub 明示 |
| P2 | `match-profile-wiring.js` L152 client_stub 返却 | preview 専用フラグに分離 |

---

## 7. 総合判定

| 項目 | 判定 |
|------|------|
| バックエンド live 化 | **完了**（コア + P15 + 管理 + 本人確認） |
| フロント live 自動昇格 | **実装済**（要 dist 同期 + ログイン必須） |
| βページ client_stub 禁止 | **条件付き達成** — ログイン + bootstrap 前提 |
| 次アクション | dist 同期 · P3 招待ゲート · 未ログイン UX |
