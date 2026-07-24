# Business Directory — Commercial UI Launch Gate

**確認日:** 2026-07-04  
**判定:** **CONDITIONAL GO**  
**種別:** UI / 導線 / Mock 機能確認（DB · API · Edge · Stripe · Migration **未変更**）

---

## 対象画面

| 領域 | 画面 | パス |
| --- | --- | --- |
| Owner | ダッシュボード | `/business-directory/index.html` |
| Owner | 新規掲載 | `/business-directory/new.html` |
| Owner | 編集 · 公開申請 | `/business-directory/edit.html` |
| Admin | 審査キュー | `/business-directory/admin/reviews.html` |
| Admin | 掲載詳細 | `/business-directory/admin/listing.html` |
| Public / Vendor | 一覧 | `/business-directory/public/list.html` |
| Public / Vendor | 掲載詳細（画像あり） | `/business-directory/public/detail.html?slug=tanaka-shop` |
| Public / Vendor | 掲載詳細（画像なし） | `/business-directory/public/detail.html?slug=no-photo-cafe` |

---

## 確認環境

| 項目 | 値 |
| --- | --- |
| Base URL | `http://127.0.0.1:8788` |
| モード | Mock（`bdMock=1` · `bdAdminMock=1` · `bdPublicMock=1`） |
| Viewport | 1280 / 768 / 390 |
| Auth | ローカルは `member-auth` dev skip（127.0.0.1） |

**Mock 境界（重要）:** Owner / Admin / Public は **別 localStorage**。Admin 承認結果は Public mock 一覧へ自動反映されない。Public は独自 seed（published 掲載）で確認。

---

## 実行コマンド

```bash
npm run dev
node scripts/capture-business-directory-commercial-ui-launch-gate.mjs
node scripts/test-business-directory-phase3-owner-ui.mjs
node scripts/test-business-directory-phase4-admin-ui.mjs
node scripts/test-business-directory-phase5-public-ui.mjs
```

関連 UI キャプチャ（先行ブラッシュアップ証跡）:

```bash
node scripts/capture-business-directory-owner-new-ui.mjs
node scripts/capture-business-directory-admin-ui.mjs
node scripts/capture-business-directory-public-ui.mjs
```

---

## 導線確認結果

| 導線 | 結果 | 備考 |
| --- | --- | --- |
| Owner ダッシュボード → 新規掲載 | **PASS** | `new.html` |
| 新規掲載 → 下書き保存 | **PASS** | mock listing id 発行 · edit へ遷移 |
| 編集画面 → 公開申請 | **PASS** | ステータス「審査中」 |
| Admin 審査キュー → 掲載詳細 | **PASS** | `listing?id=admin-mock-1` |
| 掲載詳細 → 承認 | **PASS** | 「公開中」 |
| 承認後 → Public 一覧に表示 | **N/A（Mock境界）** | 別 store · Public seed で published 表示を確認 |
| Public 一覧 → 詳細ページ | **PASS** | `detail?slug=tanaka-shop` |
| 詳細 → メール問い合わせ | **PASS** | `mailto:info@tanaka.example` |
| 詳細 → 電話 | **PASS** | `tel:0311112222` |
| 詳細 → 公式サイト | **PASS** | `https://example.com/tanaka` |

### Mock 限定の既知事項

1. **下書き保存後の URL**  
   - 遷移先が extensionless `/business-directory/edit?...` になり、**`bdMock=1` が付かない**。  
   - 本番 API 接続時は影響なし。Mock 検証時は `edit.html?...&bdMock=1` へ正規化して継続確認。  
   - **修正案（未実施）:** `business-directory-owner.js` の redirect に `bdMock` を引き継ぐ。

2. **Owner → Admin → Public の横断 E2E**  
   - Mock では store が分離しているため、同一 listing の承認→公開一覧反映は **本番 API 接続時の確認項目**として残す。

---

## UI確認結果

全対象画面 × 1280 / 768 / 390:

| 項目 | 結果 |
| --- | --- |
| HTTP 200 | **PASS**（全画面） |
| Console Error 0 | **PASS**（全画面） |
| 横 overflow なし | **PASS** |
| レイアウト崩れなし | **PASS**（スクショ確認） |
| ボタン ≥44px | **PASS** |
| 入力欄 ≥44px | **PASS**（該当画面） |
| 画像あり / なし | **PASS**（hero / 画像未登録） |
| CTA 押しやすさ | **PASS**（44px · モバイル全幅） |
| 文字サイズ | **PASS**（極端な縮小なし） |
| Owner / Admin / Public デザイン統一 | **PASS**（カード影 · 余白 · 角丸 · タイポ同系） |

スクリーンショット: `reports/business-directory-commercial-ui-launch-gate/*.png`  
機械結果: `reports/business-directory-commercial-ui-launch-gate/report.json`

---

## 機能確認結果

| 機能 | 結果 |
| --- | --- |
| 掲載種別選択 | **PASS** |
| 必須入力フィールド | **PASS**（12） |
| 下書き保存 | **PASS** |
| 公開申請 | **PASS** |
| 審査キュー表示 | **PASS**（`1件`） |
| 掲載詳細表示 | **PASS** |
| 承認 | **PASS** |
| 差戻し | **PASS** |
| 公開一覧表示 | **PASS**（3 cards · draft 非表示） |
| 詳細表示 | **PASS** |
| 問い合わせ導線 | **PASS**（mailto） |
| 電話導線 | **PASS**（tel） |
| 公式サイト導線 | **PASS** |
| 画像あり | **PASS** |
| 画像なし（画像未登録） | **PASS** |

---

## Playwright結果

### Launch Gate 統合

| スクリプト | 結果 |
| --- | --- |
| `capture-business-directory-commercial-ui-launch-gate.mjs` | **131 PASS / 0 FAIL** |

### 領域別 UI キャプチャ（先行）

| スクリプト | 結果 |
| --- | --- |
| `capture-business-directory-owner-new-ui.mjs` | ALL PASS（22） |
| `capture-business-directory-admin-ui.mjs` | ALL PASS（40） |
| `capture-business-directory-public-ui.mjs` | ALL PASS（48） |

### Phase 静的 + browser smoke

| スクリプト | 結果 | 解釈 |
| --- | --- | --- |
| Phase 3 Owner UI | 50 PASS / **6 FAIL** | 旧 Create Mode / content_update フック期待（現行 MVP-1 簡易フォーム外） |
| Phase 4 Admin UI | **35 PASS / 0 FAIL** | Admin 導線・審査操作 OK |
| Phase 5 Public UI | 23 PASS / **4 FAIL** | 旧 shared page-renderer 期待（現行 public 直描画パス外） |

Phase 3/5 の FAIL は **今回の商用 UI ブラッシュアップ退行ではなく**、未搭載の Create Mode / shared renderer を前提にした古いアサーション。Commercial UI Launch Gate のブロッカーにはしない（残課題に記載）。

---

## 残課題

| # | 項目 | 優先 | 備考 |
| --- | --- | --- | --- |
| R-UI-1 | Owner mock redirect で `bdMock=1` 未引き継ぎ | Low | Mock 限定 · 修正案は `owner.js` redirect |
| R-UI-2 | Owner/Admin/Public mock store 横断 E2E 不可 | — | 本番 API 接続時に再確認 |
| R-UI-3 | Phase 3 テストの Create Mode / content_update 期待を現行 UI に追随 | Low | テスト更新 or 機能復活の方針決め |
| R-UI-4 | Phase 5 の shared renderer 期待を現行 public 描画に追随 | Low | 同上 |
| OB（既存） | Stripe Live · 監視 · Portal 解約 E2E · Launch 最終 Go/No-Go | High | [commercial-launch-checklist](./business-directory-commercial-launch-checklist.md) · UI 外 |

---

## Launch判定

### **CONDITIONAL GO**

**理由:**

1. **商用 UI として** Owner / Admin / Public（Vendor）は 1280·768·390 で Console 0 · overflow なし · 44px 維持 · 導線・CTA・画像あり/なしが Mock で確認できた。  
2. **デザイン統一**（カード・余白・タイポ・CTA）は達成。  
3. **本番 Commercial Launch 全体**は、既存 OB（Stripe Live · 監視 · 横断 E2E on Production API）が残るため **GO ではなく CONDITIONAL GO**。  
4. UI 大改修・DB/API 変更は本ゲートでは実施していない。

| 判定 | 意味 |
| --- | --- |
| **GO** | UI + 本番横断フロー + OB クリア — **未達** |
| **CONDITIONAL GO** | **UI 商用品質は公開可能レベル** · 本番横断・課金・運用 OB は別ゲート |
| **NO GO** | UI 重大欠陥 — **該当なし** |

---

## 作成 / 更新ファイル

| ファイル | 内容 |
| --- | --- |
| `reports/business-directory-commercial-ui-launch-gate.md` | 本レポート |
| `reports/business-directory-commercial-ui-launch-gate/report.json` | 機械結果 |
| `reports/business-directory-commercial-ui-launch-gate/*.png` | 画面スクショ |
| `scripts/capture-business-directory-commercial-ui-launch-gate.mjs` | Launch Gate Playwright |

（アプリ本体のコード変更は本ゲート作業ではなし）
