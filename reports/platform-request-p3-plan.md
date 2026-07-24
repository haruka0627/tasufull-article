# Platform Request P3 — Candidate Matching Report

**Date:** 2026-07-05  
**Phase:** P3（通知候補抽出 UI · localStorage 維持）  
**Prior:** P2 `reports/platform-request-p2-plan.md`

---

## 1. 変更ファイル一覧

| File | Change |
| --- | --- |
| `platform-request.js` | 候補データ・`matchCandidates`・詳細候補レンダリング |
| `platform-request-detail.html` | 「対応できそうな候補」セクション |
| `platform-request.css` | 候補カード・空状態・type ラベル |
| `scripts/test-platform-request-p3.mjs` | P3 回帰テスト（新規） |
| `reports/platform-request-p3-plan.md` | 本報告書 |
| `deploy/cloudflare/dist/*` | `npm run build:pages` 同期 |

---

## 2. 候補データ（local / demo）

**localStorage key（任意追加分）:** `tasful_platform_request_candidates_v1`  
**demo 定数:** `DEMO_CANDIDATES`（12 件 · `platform-request.js` 内）

| Field | 説明 |
| --- | --- |
| `id` | `cand-*` |
| `name` | 表示名 |
| `type` | `company` / `worker` / `freelancer` |
| `categories` | 対応カテゴリ配列 |
| `areas` | 対応エリア（`全国` / `オンライン` 可） |
| `skills` | キーワード照合用 |
| `availability` | `available` / `busy` |
| `headline` | ひとこと |
| `score` | ベーススコア |

**API:** `window.TasuPlatformRequestMatcher` · `window.TasuPlatformRequestCandidates`

---

## 3. マッチングロジック

1. **必須フィルタ:** カテゴリ一致 AND エリア一致（`全国` / `オンライン` 含む）
2. **キーワード:** title + body と skills の部分一致 → スコア +8/ヒット、理由「キーワード一致」
3. **急ぎ:** `急ぎ` / `至急` 時 `available` → +40・「急ぎ対応可」、`busy` → -30
4. **ソート:** `urgentRank` → `matchScore` → `candidate.score`

---

## 4. 詳細 UI

| 要素 | 内容 |
| --- | --- |
| 見出し | 対応できそうな候補 |
| 件数 | `N件` バッジ |
| カード | 名前・type ラベル・スコア・headline・エリア/カテゴリ・一致理由 |
| 空状態 | 「まだ条件に合う候補が見つかっていません」 |
| ボタン | 「通知候補にする」「Talkで相談」→ toast のみ（P4 以降） |

---

## 5. テスト結果（8788）

```bash
node scripts/test-platform-request-p3.mjs  # ALL PASS
node scripts/test-platform-request-p2.mjs  # ALL PASS
```

| Case | Result |
| --- | --- |
| P2 投稿 → 詳細遷移 | PASS |
| IT・Web + 東京で候補表示・カテゴリ一致 | PASS（2 cards） |
| demo-4（至急・千葉・設備）で cand-7 が先頭 | PASS |
| その他 + 北海道で空状態 | PASS |
| 未接続ボタン toast（P4） | PASS |
| レスポンシブ 1280/768/390 | PASS |
| Console Error | 0 |

---

## 6. レスポンシブ確認

| Viewport | 候補カード |
| --- | --- |
| 1280 | 2–3 列グリッド |
| 768 | 1 列・ボタン折り返し |
| 390 | 1 列・全幅ボタン |

---

## 7. 禁止事項遵守

| 項目 | 状態 |
| --- | --- |
| Supabase / DB / RLS | 未接続 ✅ |
| Talk 連携 | 未接続 ✅ |
| 実通知送信 | なし ✅ |
| Stripe / 課金 | なし ✅ |
| P2 localStorage 投稿・一覧・詳細 | 維持 ✅ |

---

## 8. P4 に残す内容

- 通知候補への正式登録・送信
- Talk スレッド開始
- 「対応できます」マッチングフロー
- ステータス変更 UI（closed / cancelled 操作）
- Supabase 同期（P5+）

---

## 9. Go 判定

| 項目 | 結果 |
| --- | --- |
| 候補抽出・表示 | ✅ |
| 空状態 | ✅ |
| P2 回帰 | ✅ |
| P3 テスト PASS | ✅ |
| 通知/Talk/DB 未接続 | ✅ |

### **判定: Go（P4 着手可）**

---

*Generated: Platform Request P3 · candidate UI only*
