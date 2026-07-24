# Platform Request P4.6 — Navigation & Entry Flow Report

**Date:** 2026-07-05  
**Phase:** P4.6（導線・入口・CTA・ナビ整理 · 機能不変）  
**Prior:** P4.5 `reports/platform-request-p4.5-ui-polish.md`

---

## 1. 目的

Platform Request を「案件ページ」ではなく **Talk の入口** として位置づけ、メイン導線を **Talk Home** に寄せる。P2〜P4.5 の機能・localStorage 構造・マッチングロジックは変更しない。

---

## 2. 変更ファイル一覧

| File | Change |
| --- | --- |
| `talk-home.html` | Platform Request 主要カード（依頼を見る / 依頼を投稿） |
| `dashboard.html` | 「おすすめ機能」セクション · Talk Home 優先導線 |
| `dashboard.js` | サイドナビ・探索メニュー → Talk Home 経由 |
| `index-top.html` | 軽いサービス紹介 · Talk Home 入口（ヒーロー CTA 不変） |
| `platform-request.html` | メイン CTA・Talk Home 戻り・Empty 文言 |
| `platform-request-create.html` | パンくず・文言統一 |
| `platform-request-detail.html` | パンくず・投稿成功バナー |
| `platform-request.js` | `posted=1` リダイレクト・成功バナー（UI 専用 LS キー）· Empty 分岐 |
| `platform-request.css` | パンくず・バナー・一覧 CTA・Talk/Dashboard カード |
| `deploy/cloudflare/dist/*` | `npm run build:pages` 同期 |
| `reports/platform-request-p4.6-navigation.md` | 本報告書 |

**未変更（禁止遵守）:** Supabase · DB · RLS · Stripe · Talk 接続 · 通知 · 課金 · `tasful_platform_requests_v1` 構造 · マッチングロジック

---

## 3. 導線サマリー

### ① Talk Home（最優先入口）

| 要素 | 内容 |
| --- | --- |
| カード | `prq-entry-cta--featured` で主要配置 |
| 見出し | Platform Request · 「これできる人いますか？」 |
| 説明 | 条件に合う業者・ワーカー・フリーランスへ依頼 |
| ボタン | **依頼を見る** → `/platform-request` · **依頼を投稿** → `/platform-request-create` |

### ② 一覧（`platform-request.html`）

- 上部メイン CTA: **依頼を投稿**
- 戻り導線: **← Talk Home**
- Empty（0件）: 「最初の依頼を投稿してみましょう」+ CTA

### ③ 投稿完了

- リダイレクト: `platform-request-detail.html?id=…&posted=1`
- 成功バナー（一度だけ）: UI 専用キー `tasful_platform_request_posted_banner_v1`（依頼データ LS とは別）
- 文言: 「投稿が完了しました。条件に合う候補を表示しています。」

### ④ 詳細

パンくず: **Talk Home › Platform Request › 投稿詳細**

### ⑤ Dashboard

- セクション: **おすすめ機能**
- Talk Home リンク優先 + 依頼を見る / 依頼を投稿
- サイドナビ「Platform Request」→ `talk-home.html`

### ⑥ TOP

- ヒーロー CTA: **変更なし**
- サービス紹介: 軽い Platform Request 紹介 + **Talk Home から始める**

### ⑧ 文言統一

| 旧 | 新 |
| --- | --- |
| リクエスト（ユーザー向け） | Platform Request / 依頼 |
| 急ぎレベル | 対応の優先度 |
| 急ぎ案件 | 削除（該当 UI なし） |

※ マッチング理由チップ「急ぎ対応可」はロジック・P3 テスト互換のため維持

---

## 4. テスト結果（8788）

```bash
node scripts/test-platform-request-p2.mjs  # ALL PASS
node scripts/test-platform-request-p3.mjs  # ALL PASS
node scripts/test-platform-request-p4.mjs  # ALL PASS
```

| Case | Result |
| --- | --- |
| P2 投稿→詳細（`&posted=1` 付きでも URL マッチ） | PASS |
| P3 候補マッチ・空状態・toast | PASS |
| P4 モーダル・550円・ステータス | PASS |
| Console Error | **0** |
| レスポンシブ 1280 / 768 / 390 | PASS |

### 8788 目視確認ポイント

| URL | 確認 |
| --- | --- |
| `/talk-home` | Platform Request 主要カード · 2ボタン |
| `/platform-request` | 上部「依頼を投稿」· Talk Home 戻り |
| `/platform-request-create` → 投稿 | 詳細で成功バナー（初回のみ） |
| `/platform-request-detail?id=…` | パンくず 3段 |
| `/dashboard` | おすすめ機能 · Talk Home リンク |
| `/index-top` | ヒーロー不変 · 軽い PR 紹介 |

**Viewport:** 390 · 768 · 1024（CSS）· 1280 — 横スクロールなし · 44px タップ維持

---

## 5. 禁止事項遵守

| 項目 | 状態 |
| --- | --- |
| 機能・マッチング・`tasful_platform_requests_v1` | 不変 ✅ |
| Talk / 決済 / DB 接続 | なし ✅ |
| P2〜P4.5 UI 破壊 | なし（回帰 PASS）✅ |
| UI 専用 LS キー | `tasful_platform_request_posted_banner_v1` のみ追加（依頼データとは分離）|

---

## 6. Go / No-Go 判定

| 項目 | 結果 |
| --- | --- |
| Talk Home がメイン入口 | ✅ |
| 導線・CTA・ナビのみ変更 | ✅ |
| ロジック・依頼 LS 不変 | ✅ |
| P2 + P3 + P4 回帰 PASS | ✅ |
| Console Error 0 | ✅ |
| 8788 確認 · dist 同期 | ✅ |

### **判定: Go**

P4.6 Navigation & Entry Flow は完了。P5（実接続）着手の導線前提を満たす。

---

*Generated: Platform Request P4.6 · navigation only*
