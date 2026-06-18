# P0-3 — Builder Actor Identity 統一

**判定:** FIXED  
**対象:** C-4 `builder/builder.js` + Builder HTML auth stack

---

## 問題（修正前）

| 関数 | 判定根拠 | 本番リスク |
|------|----------|------------|
| `getRole()` | `?role=` → sessionStorage → localStorage → **default `"owner"`** | 非当事者が owner 扱い |
| `getPartnerId()` | localStorage → **`demo-partner-001`** | 固定デモ ID |
| `getActor()` | 上記に依存 | UI と認可不一致 |
| `threadCompletionIsSubmitter/Reviewer` | `getRole()` 直参照 | 完了操作を誰でも可能 |
| `resolveGeneralFlowActorId()` | URL / LS / default owner | general flow 当事者偽装 |

`TasuBuilderActorIdentity` は `builder/index.html` のみ読み込み（他 30+ ページ未配線）。

---

## 対応

### `builder.js`

本番 host（`TasuBuilderActorIdentity.isProductionHost()`）では helper に委譲:

| 関数 | 本番 | デモ |
|------|------|------|
| `getRole(context?)` | `getViewRole(ctx)` | 従来 URL/LS（`getDemoRoleFromStorage`） |
| `getPartnerId(context?)` | `getBuilderActor(ctx).actorId` | 従来 LS |
| `getActor(state)` | `getActorRecord(ctx)` | 従来 |
| `resolveGeneralFlowActorId` | `resolveActorIdForDeal(ctx)` | 従来 |
| `threadCompletionIsSubmitter` | `isCompletionSubmitter(ctx)` | 従来 |
| `threadCompletionIsReviewer` | `isCompletionReviewer(ctx)` | 従来 |

追加ヘルパー: `builderIdentity()`, `isBuilderProdHost()`, `resolveBuilderActorContext()`

### Builder HTML（33 ファイル）

`scripts/patch-builder-html-auth-stack.mjs` 実行 — `builder-general-flow.js` 直前に:

```html
<script src="../talk-runtime.js"></script>
<script src="../auth-current-user.js"></script>
<script src="builder-actor-identity.js"></script>
```

`builder/index.html` は既存 stack のためスキップ。計 **34 ページ** が actor identity 利用可能。

---

## 変更ファイル

- `builder/builder.js`
- `builder/*.html`（33 ファイル · patch スクリプト適用）

---

## 検証

| コマンド | 結果 |
|----------|------|
| `npm run build:pages` | PASS |
| `npm run verify:pages-stage` | PASS（`builder/builder-actor-identity.js` 同梱） |
| dist `builder.js` grep | `isBuilderProdHost` 7 箇所 |
| dist builder HTML | 34 ファイル `builder-actor-identity.js` |
| `node scripts/test-builder-actor-identity.mjs` | **ALL PASS** |

**テストカバレッジ（browser）**

- demo: user_user / partner_user / vendor_user ロール
- completion submitter / reviewer
- prod: URL/LS ロール昇格ブロック
- prod JWT + deal match: poster として review 可能

---

## 残課題

- `threadCanSubmitCompletion` / `threadCanReviewCompletion` 内の一部 `getRole()` 直比較はデモ経路のみ（本番は `threadCompletionIsSubmitter/Reviewer` 経由で helper 判定済み）
- Builder 非当事者 E2E（本番 JWT 不一致）は手動 / 別 smoke 推奨
