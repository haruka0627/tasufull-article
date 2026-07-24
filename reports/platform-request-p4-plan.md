# Platform Request P4 — Talk / 550円 Stub Report

**Date:** 2026-07-05  
**Phase:** P4（仮導線 · 確認モーダル · ステータス localStorage）  
**Prior:** P3 `reports/platform-request-p3-plan.md`

---

## 1. 変更ファイル一覧

| File | Change |
| --- | --- |
| `platform-request.js` | モーダル・550円定数・`updateStatus`・候補「対応できます」 |
| `platform-request-detail.html` | モーダル・550円説明カード・ステータス変更 UI |
| `platform-request.css` | モーダル・fee card・status controls |
| `scripts/test-platform-request-p4.mjs` | P4 回帰（新規） |
| `scripts/test-platform-request-p3.mjs` | toast 文言 P5 へ更新 |
| `reports/platform-request-p4-plan.md` | 本報告書 |
| `deploy/cloudflare/dist/*` | `npm run build:pages` 同期 |

---

## 2. 実装サマリー

### 候補カード「対応できます」
- 各候補にボタン追加
- クリック → 確認モーダル（Talk へ遷移しない）

### 確認モーダル
| 項目 | 内容 |
| --- | --- |
| 候補者名 | 動的表示 |
| 投稿タイトル | 動的表示 |
| 情報開示料 | **550円** |
| 接続予定 | Talk開始・連絡先開示は **P5 以降** |
| 注意文 | 仮導線・決済/Talk/通知なし |
| キャンセル | モーダル閉じる |
| 仮で進む | toast のみ（P5 決済+Talk 予定） |

### 550円説明カード
候補セクション直前に常時表示（詳細表示時）。

### ステータス変更（軽量）
- localStorage 投稿のみ `受付中` / `終了` / `キャンセル` ボタン表示
- `Store.updateStatus` で localStorage 更新
- 課金・Talk とは非連動

---

## 3. テスト結果（8788）

```bash
node scripts/test-platform-request-p4.mjs  # ALL PASS
node scripts/test-platform-request-p3.mjs  # ALL PASS
node scripts/test-platform-request-p2.mjs  # ALL PASS
```

| Case | Result |
| --- | --- |
| P2 投稿 → 詳細遷移 | PASS |
| P3 候補抽出 | PASS |
| 550円説明カード | PASS |
| local ステータス変更 | PASS |
| 「対応できます」→ モーダル | PASS |
| 「仮で進む」→ toast（Talk 遷移なし） | PASS |
| キャンセルでモーダル閉じる | PASS |
| レスポンシブ 1280/768/390 | PASS |
| Console Error | 0 |

---

## 4. レスポンシブ確認

| Viewport | モーダル | 候補カード | 550円カード |
| --- | --- | --- | --- |
| 1280 | PASS | PASS | PASS |
| 768 | PASS（ボタン縦積み） | PASS | PASS |
| 390 | PASS（全幅ボタン） | PASS | PASS |

---

## 5. 禁止事項遵守

| 項目 | 状態 |
| --- | --- |
| Supabase / DB / RLS | 未接続 ✅ |
| Stripe / 実決済 | 未接続 ✅ |
| 実 Talk スレッド作成 | なし ✅ |
| 実通知送信 | なし ✅ |
| P2/P3 破壊 | なし ✅ |

**定数:** `window.TasuPlatformRequestFee.disclosureYen = 550`

---

## 6. P5 に残す内容

- 550円 Stripe 決済（catalog SKU: `platform_request_match_contact`）
- Talk スレッド自動作成・連絡先開示
- 実通知送信
- 「通知候補にする」「Talkで相談」の本接続
- Supabase 同期（P5+）

---

## 7. Go 判定

| 項目 | 結果 |
| --- | --- |
| 仮モーダル・550円 UI | ✅ |
| P2/P3 回帰 PASS | ✅ |
| P4 テスト PASS | ✅ |
| 実決済/Talk/DB 未接続 | ✅ |

### **判定: Go（P5 着手可）**

---

*Generated: Platform Request P4 · stub flow only*
