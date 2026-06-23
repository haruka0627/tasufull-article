# TASFUL MATCH Profile Data Stub — Review

**Date:** 2026-06-21  
**Basis:** `reports/match-ui-wiring-stub-review.md`  
**Scope:** Data stub only — no DB, no Supabase, no auth, no Edge fetch, no UI redesign

---

## 1. 追加ファイル

| Path | Role |
|------|------|
| `match/match-data-stub.js` | `window.TasfulMatchDataStub` — 集約データ + ヘルパー |
| `match/match-data-render.js` | データスタブから DOM 描画 + スワイプインデックス |
| `scripts/test-match-data-stub.mjs` | データスタブ統合テスト |

---

## 2. 変更ファイル

| Path | Change |
|------|--------|
| `match/match-wiring.js` | `getTargetUserId` / `getPairId` をスタブ経由に、スキップ後カード送り |
| `match/match-mock.js` | block 時の user_id をスタブから取得 |
| `match/match-swipe.html` | 動的描画用シェル、script 順序 |
| `match/match-list.html` | `data-match-pair-list` / `data-match-new-pair` |
| `match/match-talk-bridge.html` | `pair_id` HTML 固定値削除 |
| `match/match-report.html` | 履歴・対象の動的描画 |
| `match/match-block.html` | 一覧の動的描画 |
| `match/match-verify.html` | script 追加 |
| `match/match-review.html` | Data source 表示ブロック |
| `deploy/cloudflare/dist/match/*` | 上記同期 |

---

## 3. データ構造

### `currentUser`

```json
{
  "user_id": "stub-user-current",
  "display_name": "あなた",
  "verification_status": "unverified",
  "profile_status": "active"
}
```

### `swipeProfiles` (3件)

| user_id | display_name |
|---------|--------------|
| stub-user-yui | ゆい |
| stub-user-kenta | けんた |
| stub-user-misaki | みさき |

各件: `age`, `prefecture`, `city`, `bio`, `verification_status`, `main_photo_url` (emoji), `hobby_tags`, `last_active_at`

### `pairs` (3件)

| pair_id | partner |
|---------|---------|
| `...0001` | ゆい (active, unread 2) |
| `...0002` | けんた (active) |
| `...0003` | みさき (new) |

### `blockedUsers` (2件)

`stub-user-taro`, `stub-user-anon`

### `reports` (2件)

けんた・匿名ユーザーへの通報履歴

### `verifications`

`stub-user-current` の `identity_document` / `not_submitted`

### ヘルパー

`getCurrentUser`, `getSwipeProfiles`, `getProfileById`, `getPairs`, `getPairById`, `getBlockedUsers`, `getReports`, `getCurrentVerification`, `getDefaultTargetUserId`, `getDefaultPairId`

---

## 4. 置き換えた固定値

| 以前 | 以後 |
|------|------|
| HTML `data-match-target-user-id="stub-user-yui"` | 表示中プロフィールの `user_id`（動的） |
| body `data-match-pair-id="...0001"` | `?pair_id=` または `getDefaultPairId()` |
| リスト CTA `data-match-pair-id="...0002"` | 新規マッチ pair の `pair_id` |
| スワイプカードの名前・bio・タグ | `getSwipeProfiles()[index]` |
| マッチ一覧 2行 + 新規カード | `getPairs()` 描画 |
| 通報対象「ゆい 26歳」 | `getDefaultTargetUserId()` + `getProfileById` |
| 通報履歴 2件 HTML | `getReports()` |
| ブロック一覧 2件 HTML | `getBlockedUsers()` |
| TALK bridge「ゆいさん」 | `getPairById` の `partner_display_name` |
| wiring 内「ゆい 26歳 · スタブ送信」 | プロフィールから動的生成 |

---

## 5. fallback 方針

| 条件 | 挙動 |
|------|------|
| `TasfulMatchDataStub` なし | HTML シェル / `stub-user-unknown` / 固定 pair UUID |
| `MatchDataRender` なし | `data-match-target-user-id` 属性を wiring が参照 |
| 描画前 | スワイプカードは空シェル（render が DOMContentLoaded で填充） |

Script 順序（接続ページ）:

```html
match-data-stub.js → match-data-render.js → match-api.js → match-mock.js → match-wiring.js
```

---

## 6. fetch 未使用確認

`match/match-data-stub.js`, `match/match-data-render.js` を検索:

- `fetch(` — **なし**
- Playwright テスト — ロード・操作時とも未呼び出し

---

## 7. Supabase 未接続確認

- `createClient` — **なし**
- `supabase` — **なし**
- DB / REST 呼び出し — **なし**

---

## 8. テスト結果

### `scripts/test-match-data-stub.mjs`

```text
Result: 16 passed, 0 failed
```

- スタブ存在・件数・default ID 妥当性
- `recordSwipe` が表示プロフィール ID を使用
- `ensureTalkRoom` が描画 `pair_id` を使用
- 390 / 768 / 1280px 横スクロールなし（swipe）

### 既存テスト

| Script | Result |
|--------|--------|
| `test-match-ui-wiring-stub.mjs` | 54 passed |
| `test-match-mock-ui.mjs` | 99 passed |
| `test-match-api-client-stub.mjs` | 11 passed |

---

## 9. 未接続のまま残したもの

| 項目 | 理由 |
|------|------|
| TOP / プロフィール作成 / マイページ / 安心 | スコープ外 |
| 実写真 URL | emoji プレースホルダのまま |
| `match_profiles` DB 読み込み | 次フェーズ |
| スワイプデックの永続化（skip 後のインデックス保存） | メモリ内のみ |
| ブロック解除 API | 次フェーズ |
| Edge Function `fetch` モード | 未実装 |
| 認証ユーザー ID 連携 | 次フェーズ |

---

## 10. 次ステップ

1. **認証境界設計** — `stub-user-current` を Supabase Auth / D1 user_id にマッピングする方針
2. **データ取得層** — `TasfulMatchDataStub` → `TasfulMatchData` (edge fetch) 切替
3. **プロフィール写真** — `main_photo_url` を `match_profile_photos` 相当の signed URL に
4. **ペア同期** — `match_pairs` + `transaction_rooms` 本番スキーマ接続

---

## 判定

**READY_FOR_MATCH_AUTH_BOUNDARY_DESIGN**

ハードコード ID・表示データの集約と 6 画面への段階接続が完了。既存 UI / wiring テスト回帰なし。次は認証境界（current user / RLS / client token）の設計に進める。
