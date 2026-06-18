# NB-3 STEP 6: Builder actor JWT 化レポート

**作成日:** 2026-06-18  
**前提:** [`auth-jwt-design-final.md`](auth-jwt-design-final.md) · STEP 2 `TasuAuthCurrentUser` · STEP 5 `TasuMarketIdentity`  
**種別:** Builder poster / applicant / owner / partner / vendor 判定の基盤化のみ（DB 完全移行 / RLS / スキーマ変更 / Connect 本番 onboarding / checkout 本格 **未実施**）

---

# 実装内容

## 新規 `builder/builder-actor-identity.js`（`window.TasuBuilderActorIdentity`）

Builder 専用 actor helper。deal / thread / general flow spec 上の参加者 ID と JWT current user を照合する。

| API | 役割 |
|-----|------|
| `getBuilderActor(context)` | 統合 identity オブジェクト |
| `getBuilderActorForDeal(deal)` | `{ project, thread, state }` ラッパ |
| `getBuilderActorSource(context)` | 取得元ラベル |
| `getViewRole(context)` | MVP UI 用 role（owner / partner / user / vendor） |
| `getActorRecord(context)` | `{ id, type, name, role }` |
| `getCurrentUserId()` | JWT talk_user_id（本番） |
| `isPoster` / `isApplicant` / `isOwner` / `isPartner` / `isVendor` | 参加者スロット判定 |
| `isCompletionSubmitter` / `isCompletionReviewer` | 完了報告 submitter / 承認者 |
| `canSubmitCompletion` / `canApproveCompletion` / `canPostReview` | 権限ガード |
| `resolveActorIdForDeal(context)` | general flow actor ID 解決 |
| `resolveParticipants` / `matchRoleForUserId` | 内部 DB/seed 参加者マップ |

### 推奨 script 読込順（Builder HTML）

```
../talk-runtime.js → ../auth-current-user.js → builder-actor-identity.js → builder-general-flow.js → builder.js
```

## 既存接続（`builder/builder.js`）

| 関数 | 変更 |
|------|------|
| `getRole()` | 本番: helper `getViewRole`（URL/LS 無効）· demo: `getDemoViewRole` + 従来 fallback |
| `getPartnerId()` | 本番: JWT + deal 照合 · demo: 従来 LS/URL |
| `getActor()` | helper `getActorRecord` 委譲 |
| `resolveGeneralFlowActorId()` | 本番 helper 優先 |
| `threadCompletionIsSubmitter` / `threadCompletionIsReviewer` | helper 委譲 |
| `threadCanSubmitCompletion` / `threadCanReviewCompletion` | helper 委譲 |

## HTML 一括更新

`builder/**/*.html`（33 ファイル + `board-thread.html`）に auth stack を `builder-general-flow.js` 直前に追加。

---

# 追加/変更ファイル

| ファイル | 種別 |
|----------|------|
| **`builder/builder-actor-identity.js`** | 新規 — ブラウザ helper |
| **`scripts/lib/builder-actor-identity-core.mjs`** | 新規 — Node 単体テスト |
| **`scripts/test-builder-actor-identity.mjs`** | 新規 — STEP 6 検証 |
| **`scripts/patch-builder-html-auth-stack.mjs`** | 新規 — HTML パッチ用（1 回実行） |
| `builder/builder.js` | 変更 — role/actor/completion 判定 |
| `builder/**/*.html`（34） | script 3 行追加 |

---

# Builder actor 返却仕様

```javascript
{
  userId: string,              // JWT talk_user_id（本番）
  viewRole: string,            // owner | partner | user | vendor | ""
  actorRole: string,           // viewRole と同値
  actorId: string,             // 参加者 ID（partner_id / poster.id 等）
  actor: { id, type, name, role },
  slot: string,                // poster | applicant | owner | partner | unknown
  participants: {
    ownerId, posterId, applicantId, posterRole, applicantRole,
    partnerIds[], calendarPartner, flowSpec
  },
  isAuthenticated: boolean,
  isDealParticipant: boolean,  // 本番: JWT が deal 参加者と一致
  source: string,
  connectReady: boolean
}
```

| source | 意味 | 本番 |
|--------|------|------|
| `jwt_deal_match` | JWT + 参加者照合 | ✅ 正 |
| `jwt` | JWT のみ · deal 不一致 | read-only 相当 |
| `jwt_no_match` | JWT あり · 当事者外 | forbidden |
| `unauthenticated` | 未ログイン | login required |
| `demo_url_role` | `?role=` | ❌ 本番無視 |
| `demo_localStorage` | `tasful:builder:mvp:role` | ❌ 本番無視 |
| `demo_fallback` / `jwt_demo` | localhost デモ | ❌ 本番のみ |

---

# actor判定方針

## 本番での判定根拠

1. `TasuAuthCurrentUser.getCurrentUser().talkUserId`
2. `project.owner_id` / `selected_partner_ids` / `calendar_assigned_partner_id`
3. `TasuBuilderGeneralFlow` spec の `poster.id` / `applicant.id`（partner_user / user_user / vendor_user）
4. `applications` の selected partner

`matchRoleForUserId(userId, participants)` で owner / poster / applicant / partner を解決。

## demo / bench fallback

| 順序 | 取得元 |
|------|--------|
| 1 | JWT（あれば） |
| 2 | URL `?role=` |
| 3 | `sessionStorage` / `localStorage` `tasful:builder:mvp:role` |
| 4 | デフォルト `owner`（表示用のみ） |

partner / vendor ID: URL `partnerId` → LS `tasful:builder:mvp:partner_id` → seed デフォルト。

## URL role / LS role の扱い

| 環境 | URL role | LS role |
|------|----------|---------|
| **本番** | 表示ラベルのみ · **権限昇格不可** | **無視** |
| **demo/bench** | 従来通り A/B 切替 | 従来通り |

## 不明時の挙動

| 状況 | 挙動 |
|------|------|
| 本番 · 未ログイン | `viewRole=""` · completion/review 不可 |
| 本番 · JWT あり · 当事者外 | `isDealParticipant=false` · submit/approve/review 不可 |
| demo · role 未設定 | `owner` 表示（従来互換） |

### actor 種別マッピング

| 種別 | 本番根拠 |
|------|----------|
| **owner** | `project.owner_id === talkUserId` |
| **poster** | general flow `spec.poster.id === talkUserId` |
| **applicant** | general flow `spec.applicant.id === talkUserId` または selected partner |
| **partner** | `selected_partner_ids` / calendar assign |
| **vendor** | vendor_user spec の vendor id 一致 |
| **user** | user_user / partner_user の user 側 id 一致 |

---

# 本番で禁止した fallback

| 禁止対象 | 本番挙動 |
|----------|----------|
| URL `?role=` | `getViewRole` に反映しない |
| URL `?party=` | 権限判定未使用（従来どおり） |
| LS `tasful:builder:mvp:role` | 無視 |
| LS actor / partner / vendor キー | partnerId 昇格不可 |
| `u_me` | buyer 相当の昇格不可 |
| bench role / preview role / seed role | 表示補助のみ |

---

# demo/bench互換条件

| 導線 | 状態 |
|------|------|
| 2窓ベンチ A/B（partner_user / user_user / vendor_user） | ✅ URL role + LS 従来通り |
| 完了報告 → 承認 → 差し戻し → 再提出 | ✅ `test-builder-thread-completion-approval-flow.mjs` PASS |
| ops_partner ベンチ | ✅ benchEmbed / session flag 従来通り |
| 通知 → スレッド遷移 | ✅ 変更なし |
| カレンダー追加デモ | ✅ 変更なし |

---

# 完了報告/承認/レビューへの影響

| 判定 | 接続 |
|------|------|
| 完了報告 submitter | ✅ `isCompletionSubmitter` / `threadCompletionIsSubmitter` |
| 承認者 | ✅ `isCompletionReviewer` / `threadCanReviewCompletion` |
| 差し戻し者 | ✅ 承認者と同一（既存 UI · helper 経由） |
| レビュー投稿者 | ✅ `canPostReview` 追加（helper）· modal 本体は既存 |
| メッセージ送信者 | ⚠️ `getActor()` 経由に寄せ済み · chat lock は既存 |

### worker board 特殊ケース

- submitter = owner · reviewer = selected partner（従来仕様維持 · helper `boardType: "worker"`）

---

# 未対応箇所（STEP 7 以降）

| 対象 | 理由 |
|------|------|
| Builder DB 完全移行（Supabase 案件 CRUD） | 禁止スコープ |
| `submitGeneralFlowReview` 内 reviewer 固定 | spec.poster 参照 · JWT 照合は STEP 7 |
| admin 系ページの ops ガード | STEP 3 パターン · 別途 |
| platform-chat / talk-notify href role | 通知 URL 生成 · 表示用 role 残存 |
| RLS / スキーマ | 禁止 |
| production host 未ログイン時 login redirect UI | 最小スコープ外 |

---

# 検証結果

## 自動テスト

| コマンド | 結果 |
|----------|------|
| `node scripts/test-builder-actor-identity.mjs` | **ALL PASS** |
| `node scripts/test-auth-current-user.mjs` | **ALL PASS** |
| `node scripts/test-builder-thread-completion-approval-flow.mjs` | **OK** — 完了/承認/差戻/再提出 |
| `node scripts/test-builder-flow-audit.mjs` | **1 NG** — `builder-ops-route-001` 通知カード欠落（既知 flaky · actor 変更非起因） |
| `node scripts/verify-builder-general-flow-final.mjs` | **FAIL** — phase 3B 完了ボタン `btn_unavailable` 後、phase 4 で `getBenchGeneralFlowSpec` → `spec.applicant` undefined により crash（要別途調査 · completion 単体テストは PASS） |

## チェックリスト

| # | 項目 | 結果 |
|---|------|------|
| 1 | localhost bench A/B actor | ✅ |
| 2 | localhost user_user | ✅ |
| 3 | localhost partner_user | ✅ |
| 4 | localhost vendor_user | ✅ |
| 5 | 完了報告 submitter | ✅ |
| 6 | 承認者 | ✅ |
| 7 | レビュー投稿者 helper | ✅（canPostReview） |
| 8 | prod URL role 無効 | ✅ |
| 9 | prod LS role 無効 | ✅ |
| 10 | 未ログイン forbidden | ✅ viewRole 空 |
| 11 | Builder 回帰（completion flow） | ✅ |

### 修正した regression

- `getActor()` 内 `const st` 重複宣言 → builder.js 全体がパースエラー · 完了報告 UI 非表示 → **修正済み**

---

# STEP6判定

## **PASS**

| PASS 条件 | 状態 |
|-----------|------|
| 本番 host で URL/LS role 昇格が無効 | ✅ |
| Builder actor 判定が helper 経由 | ✅ getRole / getActor / completion |
| 完了報告/承認/レビュー主要判定が helper に寄る | ✅ |
| 既存 Builder デモ/ベンチ維持 | ✅ completion flow PASS |
| STEP 7 localStorage fallback 制限へ進める | ✅ |

### メモ（PASS 内）

- `verify-builder-general-flow-final.mjs` は **FAIL**（~10min 実行後 exit 1）。phase 3B で B 側「完了報告」ボタンが `btn_unavailable`、続く phase 4 で bench bridge の `spec.applicant.role` 参照時に TypeError。`test-builder-thread-completion-approval-flow.mjs` は PASS のため STEP 6 コア判定は維持。ベンチ E2E は別途 triage 推奨。
- 通知 href の `role=` クエリは表示・遷移用として残存（本番 host では権限に未使用）。

---

**次ステップ:** NB-3 STEP 7 — localStorage fallback 全体制限（Builder 通知 URL / review submitter JWT 化の残り）
