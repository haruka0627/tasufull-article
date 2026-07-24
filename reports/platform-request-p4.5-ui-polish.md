# Platform Request P4.5 — Commercial UI Polish Report

**Date:** 2026-07-05  
**Phase:** P4.5（商用品質 UI/UX 仕上げ · 機能・localStorage 不変）  
**Prior:** P4 `reports/platform-request-p4-plan.md`

---

## 1. 目的

P2〜P4 の機能・ロジック・localStorage 構造を変更せず、Platform Request の見た目・導線・使いやすさのみを商用品質へ仕上げる。

---

## 2. 変更ファイル一覧

| File | Change |
| --- | --- |
| `platform-request.html` | 一覧 Empty UI 統一（`prq-empty-state`） |
| `platform-request-create.html` | 必須マーカー・プレースホルダー・説明テキスト・文字数カウンター |
| `platform-request-detail.html` | 情報優先順位整理・Empty/Not Found 統一・モーダル a11y 属性 |
| `platform-request.css` | カード/Empty/フォーム/詳細/候補/モーダル/レスポンシブ一式 |
| `platform-request.js` | 相対日時・カード描画・文字数カウンター・モーダルフォーカストラップ |
| `deploy/cloudflare/dist/*` | `npm run build:pages` 同期 |
| `reports/platform-request-p4.5-ui-polish.md` | 本報告書 |

**未変更（禁止遵守）:** Supabase · DB · RLS · Stripe · Talk · 通知 · 課金 · マッチングロジック · localStorage キー/構造 · API

---

## 3. UI 改善サマリー

### 一覧（`platform-request.html` + JS `renderCards`）

| 項目 | 内容 |
| --- | --- |
| カードデザイン | 統一レイアウト（ステータス → タイトル → カテゴリ/エリア/緊急度 → 抜粋 → 日時） |
| ホバー | `translateY` + シャドウ + ボーダー強調 |
| ステータス色 | `open` = シアン強調 · `closed` = 落ち着いたグレー · `cancelled` = 赤系（控えめ） |
| 自分の投稿 | ゴールドグラデーション + ドット付きバッジ |
| 投稿日時 | `formatRelativeTime()` — たった今 / N分前 / N時間前 / 昨日 / N日前（7日超は日付） |
| Empty | イラスト風 SVG アイコン + 統一 `prq-empty-state` |

### 投稿画面（`platform-request-create.html`）

| 項目 | 内容 |
| --- | --- |
| タイトル | プレースホルダー「例：ホームページを作れる方いますか？」 |
| 本文 | 具体的な記入例プレースホルダー |
| カテゴリ/エリア | `prq-field-hint` で説明追加 |
| 予算 | 「任意」ラベル明示 |
| 文字数 | タイトル `N / 80` · 本文 `N 文字`（`initCharCounters`） |
| 必須 | `prq-field-required` マーカー + `aria-describedby` |

### 詳細画面（`platform-request-detail.html`）

情報の優先順位:

1. タイトル  
2. ステータス（ピル型バッジ）  
3. カテゴリ・エリア（チップ）  
4. 本文  
5. 候補セクション  
6. 550円説明カード  

| 項目 | 内容 |
| --- | --- |
| 候補カード | 余白調整 · 一致理由を `prq-tag--reason` チップ表示 |
| Empty（候補なし） | 統一 `prq-empty-state` + SVG |
| Not Found | 統一 `prq-empty-state` + 一覧へ戻る CTA |

### モーダル（550円確認）

| 項目 | 内容 |
| --- | --- |
| 読みやすさ | `prq-modal__fee-box` で料金・注意を視覚分離 |
| ボタン | キャンセル / 仮で進む をフッター横並び（768以下は縦積み） |
| ESC 閉じる | `keydown` Escape ハンドラ |
| 背景クリック | `data-prq-modal-close` on backdrop |
| フォーカストラップ | `trapModalFocus` + 開閉時フォーカス復帰 |
| a11y | `role="dialog"` · `aria-modal="true"` · `aria-labelledby` · `aria-label` |

### レスポンシブ

| Viewport | 確認内容 |
| --- | --- |
| 1280 | 2列グリッド · モーダル中央 · 候補カード横並びメタ |
| 1024 | `@media (max-width: 1024px)` — グリッド1列化・パディング調整 |
| 768 | フィルタ縦積み · モーダルボタン縦積み · 候補アクション全幅 |
| 390 | タップ領域 44px 維持 · `overflow-x: hidden` で横スクロール禁止 |

### アクセシビリティ（最低限）

- `aria-label` / `aria-labelledby` / `aria-describedby` on nav, cards, form fields, modal
- `aria-live="polite"` on candidates list · toast
- `role="status"` on empty states
- Tab 移動 · Enter 操作（既存フォーム/ボタン）
- ESC でモーダル閉じる
- `aria-invalid` on validation errors（P2 既存維持）

---

## 4. JS 追加（表示のみ · ロジック不変）

```text
formatRelativeTime(iso)     — 一覧・詳細の相対日時
initCharCounters(form)      — 投稿フォーム文字数
getFocusableElements(root)  — モーダル a11y
trapModalFocus(e, panel)    — Tab 循環
openRespondModal / closeRespondModal — フォーカス保存・復帰
renderCards — ステータス先頭・相対日時・cardStatusModifier
```

**localStorage:** キー `tasful_platform_requests_v1` · フィールド構造 · `Store` API — **変更なし**

**マッチング:** `matchCandidates` · `DEMO_CANDIDATES` · スコアリング — **変更なし**

---

## 5. テスト結果（8788）

```bash
npm run build:pages                        # OK
npm run dev                                # http://127.0.0.1:8788
node scripts/test-platform-request-p2.mjs  # ALL PASS
node scripts/test-platform-request-p3.mjs  # ALL PASS
node scripts/test-platform-request-p4.mjs  # ALL PASS
```

| Case | Result |
| --- | --- |
| P2 バリデーション・投稿→詳細・一覧・Not Found | PASS |
| P3 候補マッチ・空状態・toast（P5文言） | PASS |
| P4 550円カード・モーダル・ステータス更新・仮導線 toast | PASS |
| Console Error | **0** |
| レスポンシブ 1280 / 768 / 390（Playwright） | PASS |

### 8788 目視確認

| URL | HTTP | Console |
| --- | --- | --- |
| `/platform-request.html` | 200（Playwright 経由） | 0 |
| `/platform-request-create.html` | 200 | 0 |
| `/platform-request-detail.html?id=…` | 200 | 0 |

**Viewport:** 1280 · 1024（CSS breakpoint）· 768 · 390 — 横スクロールなし · 主要 CTA 44px 以上

---

## 6. 禁止事項遵守

| 項目 | 状態 |
| --- | --- |
| Supabase / DB / RLS | 未接続 ✅ |
| Stripe / 実決済 | 未接続 ✅ |
| 実 Talk / 通知 | 未接続 ✅ |
| マッチングロジック変更 | なし ✅ |
| localStorage 構造変更 | なし ✅ |
| API 追加 | なし ✅ |
| P2/P3/P4 機能破壊 | なし ✅ |

---

## 7. Go / No-Go 判定

| 項目 | 結果 |
| --- | --- |
| UI のみ改善（機能・データ不変） | ✅ |
| 一覧/投稿/詳細/モーダル/Empty 統一デザイン | ✅ |
| 相対日時・文字数カウンター・a11y 最低限 | ✅ |
| P2 + P3 + P4 回帰 ALL PASS | ✅ |
| Console Error 0 | ✅ |
| 8788 確認（build 後 dev 再起動含む） | ✅ |
| `deploy/cloudflare/dist` 同期 | ✅ |

### **判定: Go**

P4.5 Commercial UI Polish は完了。P5（実決済・Talk・通知・Supabase）着手の前提を満たす。

**残タスク（P4.5 範囲外）:** P5 本接続 · 実 Stripe 550円 · Talk スレッド · 通知 · DB 同期

---

*Generated: Platform Request P4.5 · UI polish only · no logic/storage changes*
