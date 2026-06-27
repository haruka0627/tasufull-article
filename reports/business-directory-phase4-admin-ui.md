# Business Directory Phase 4 — Admin / Ops Review UI

**日付:** 2026-06-27  
**種別:** 運営審査 UI（公開検索 / Stripe なし）

---

## 成果物

| ファイル | 内容 |
| --- | --- |
| `business-directory/admin/reviews.html` | 審査キュー（review_requested） |
| `business-directory/admin/listing.html` | 掲載詳細（読取専用）+ 審査操作 |
| `business-directory/admin/business-directory-admin.js` | Admin UI ロジック |
| `business-directory/business-directory-admin.css` | Admin スタイル |
| `supabase/functions/_shared/business-directory.ts` | getOpsListingDetail · audit · reason 必須 |
| `business-directory-repository.js` | ops API ラッパ拡張 |
| `scripts/test-business-directory-phase4-admin-ui.mjs` | 53+ 静的 + browser |

---

## Ops API（Phase 2 拡張 · migration なし）

| action | 用途 |
| --- | --- |
| `get_ops_listing_detail` | 読取専用詳細 + 申請履歴 + audit |
| `get_listing_audit_logs` | 監査ログ |
| `approve_listing` | 任意 `approve_note` |
| `reject_listing` | **`reject_reason_note` 必須** |
| `suspend_listing` | **`reason` 必須** |
| `restore_listing` | 任意 reason → audit metadata |

---

## 審査 UI 原則

- 運営は **読取 + 審査アクションのみ**
- 編集 input は **reason 用 textarea のみ**
- 入力代行フォームなし

---

## ステータス別操作

| status | UI |
| --- | --- |
| review_requested | 承認 / 差戻し |
| published | 停止 / 非公開 |
| suspended / unpublished | 再公開 |
| archived | 操作不可 |

---

## テスト

```bash
node scripts/test-business-directory-phase4-admin-ui.mjs
```

ローカル: `?bdAdminMock=1&devSkipAuth=1`

---

## 未着手

- 公開検索ページ
- Stripe
- 予約 / 見積 / チャット

---

## 境界

Owner UI · Marketplace · Platform · admin-operations-dashboard 非変更
