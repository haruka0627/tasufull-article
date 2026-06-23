# TASFUL MATCH UI Wiring Stub — Review

**Date:** 2026-06-21  
**Basis:** `match/match-api.js`, `reports/match-api-client-stub-review.md`  
**Scope:** Stub wiring only — no fetch, no Supabase, no auth, no Edge Function calls, no UI redesign

---

## 1. 修正ファイル

| Path | Change |
|------|--------|
| `match/match-wiring.js` | **新規** — ページ別 API 接続レイヤ |
| `match/match-mock.js` | block / report / verify / unblock を `MatchWiring` 連携 |
| `match/match-swipe.html` | スワイプボタン data 属性、script 追加 |
| `match/match-talk-bridge.html` | TALK CTA、`pair_id`、toast、script |
| `match/match-list.html` | TALK CTA、`pair_id`、toast、script |
| `match/match-report.html` | `target_user_id`、script |
| `match/match-block.html` | script |
| `match/match-verify.html` | `data-verify-type`、toast、script |
| `match/match-review.html` | UI wiring 状態表示 |
| `scripts/test-match-ui-wiring-stub.mjs` | **新規** — wiring 統合テスト |
| `deploy/cloudflare/dist/match/*` | 上記を同期 |

---

## 2. 接続した画面

| Page | API methods |
|------|-------------|
| `match-swipe.html` | `recordSwipe` (like/skip/super_like), `blockUser` (modal) |
| `match-talk-bridge.html` | `ensureTalkRoom` |
| `match-list.html` | `ensureTalkRoom` (新規マッチ CTA) |
| `match-report.html` | `submitReport` |
| `match-block.html` | `blockUser` 構造（解除は次フェーズ toast） |
| `match-verify.html` | `submitVerification` (phone on load, identity_document on submit) |
| `match-review.html` | 開発表示のみ（接続状態一覧） |

**未接続（意図的）:** `match-top`, `match-profile-create`, `match-safety`, `match-mypage` ほか

---

## 3. 接続した API メソッド

| Method | 呼び出し元 |
|--------|-----------|
| `recordSwipe` | スワイプ skip / like（ダブルクリックで super_like） |
| `blockUser` | スワイプブロック modal、`MatchWiring.blockUser` 共通関数 |
| `ensureTalkRoom` | TALK bridge CTA、マッチ一覧「TASFUL TALKで話す」 |
| `submitReport` | 通報送信ボタン |
| `submitVerification` | 本人確認（phone: ページ load、identity_document: 提出ボタン） |

`adminReview` / `moderationLog` は UI 未接続（管理画面なし）。

---

## 4. fallback 方針

| 条件 | 挙動 |
|------|------|
| `window.TasfulMatchAPI` なし | `match-mock.js` の従来モックのみ（toast・履歴・ステップ進行） |
| `callApi` が `null` を返す | スワイプは skip/like のモック動作（カード送り・遷移） |
| API 失敗 (`ok: false`) | toast 表示、画面は維持 |
| `super_like` | `phase_not_enabled` →「スーパーいいねは準備中です」 |
| TALK stub 成功 | `redirect_url` は `console.debug` のみ、実遷移なし |
| ブロック解除 | API あり →「ブロック解除APIは次フェーズ予定」、行は削除しない |

Script 読み込み順: `match-api.js` → `match-mock.js` → `match-wiring.js`

---

## 5. fetch 未使用確認

`match/match-api.js`, `match/match-wiring.js`, `match/match-mock.js` を検索:

- `fetch(` 呼び出し — **なし**
- Playwright wiring テストで `window.fetch` ラップ — ロード時・操作時とも未呼び出し

---

## 6. Supabase 未接続確認

- `createClient` — **なし**
- `supabase` import / 参照 — **なし**（コメントのみ）
- Authorization token — **未使用**

---

## 7. テスト結果

### `scripts/test-match-ui-wiring-stub.mjs`

```text
Result: 54 passed, 0 failed
```

- 6 対象ページで `match-api.js` / `match-wiring.js` 読み込み
- `TasfulMatchAPI` / `MatchWiring` 存在
- `recordSwipe` / `submitReport` / `submitVerification` / `ensureTalkRoom` 呼び出し
- `super_like` → `phase_not_enabled`
- fetch 未使用、390px 横スクロールなし

### `scripts/test-match-mock-ui.mjs`

```text
Result: 99 passed, 0 failed
```

### `scripts/test-match-api-client-stub.mjs`

```text
Result: 11 passed, 0 failed
```

---

## 8. 未接続のまま残したもの

| 項目 | 理由 |
|------|------|
| プロフィール作成 / TOP / マイページ / 安心 | 今回スコープ外 |
| `adminReview` / `moderationLog` | 管理 UI なし |
| ブロック解除 API | 次フェーズ |
| Edge Function 実呼び出し (`fetch`) | stub フェーズ |
| 認証 Bearer token | 未接続 |
| TALK `redirect_url` への実遷移 | stub 中は toast + debug のみ |
| マッチ一覧行タップ | 従来どおり `match-talk-bridge.html` へ遷移 |

---

## 9. 次ステップ

1. **`match-profile-data.js` スタブ** — カード・一覧・通報対象の `target_user_id` / `pair_id` をページ固定値から分離
2. **edge モード** — `TasfulMatchAPI` に `mode: "edge"` 切替 + `fetch` to Functions
3. **認証** — Supabase Auth 連携後 Bearer 注入
4. **ブロック解除 API** — Edge Function + UI wiring
5. **migration / RLS 適用** — 本番 DB（別フェーズ）

---

## 判定

**READY_FOR_MATCH_PROFILE_DATA_STUB**

6 画面の stub wiring 完了。既存 UI テスト回帰なし。次はプロフィール／マッチデータのクライアントスタブで hardcoded ID を置き換え可能。
