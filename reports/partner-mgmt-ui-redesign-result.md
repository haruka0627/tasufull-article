# 協力パートナー管理画面 — Builder Admin デザイン統一結果

| 項目 | 内容 |
|------|------|
| 実施日 | 2026-06-23 |
| 対象 | `partner-management.html` / `partner-detail.html` |
| 方針 | 機能・API・認証は変更なし、デザインのみ |

---

## 変更概要

Builder Admin ダッシュボード（`builder-admin/admin-index.html`）と同じ **ダークネイビー + パープル + シアン** のネオンUIへ統一しました。

| 要素 | 変更内容 |
|------|----------|
| 背景 | Builder Admin 共通グラデーション（`data-page` をダークテーマ対象に追加） |
| ヘッダー | 左: Builder Admin / 中央: ページタイトル / 右: ユーザー情報 |
| 統計カード | アイコン + 大きな件数 + サブテキスト（admin-index 同款） |
| 検索 | `builder-panel` + `builder-admin-search-form` 内に配置 |
| 一覧 | テーブル → カードグリッド（会社名・業種・エリア・ステータス・登録日） |
| 詳細 | タブ + `builder-panel` カード、KV / 審査 / 書類を統一スタイル |
| ステータスバッジ | オレンジ / イエロー / グリーン / ブルー / レッド |

---

## 修正ファイル

| ファイル | 内容 |
|----------|------|
| `builder/builder.css` | partner ページを Admin ダークテーマ対象に追加、partner 専用コンポーネント CSS |
| `builder/partner-management.html` | ヘッダー・統計カード・カード一覧レイアウト |
| `builder/partner-management.js` | 一覧マークアップのみ（カードHTML・バッジクラス） |
| `builder/partner-detail.html` | Admin ヘッダー・タブ・パネル構成 |
| `builder/partner-detail.js` | 生成HTMLのクラス名更新のみ |
| `scripts/verify-partner-mgmt-ui.mjs` | 390/768/1280 検証 + スクショ |
| `deploy/cloudflare/dist/builder/*` | 同期済み |

---

## 検証結果

```bash
node scripts/verify-partner-mgmt-ui.mjs
```

| 項目 | 結果 |
|------|------|
| 390px | PASS · console 0 |
| 768px | PASS · console 0 |
| 1280px | PASS · console 0 |
| 合計 | **6/6 PASS** |

JSON: `reports/partner-mgmt-ui-verify.json`

---

## スクリーンショット

### partner-management.html（?mock=1）

|  viewport | ファイル |
|----------|----------|
| 390px | `reports/screenshots/partner-mgmt-ui/mgmt-mock-390.png` |
| 768px | `reports/screenshots/partner-mgmt-ui/mgmt-mock-768.png` |
| 1280px | `reports/screenshots/partner-mgmt-ui/mgmt-mock-1280.png` |

### partner-detail.html（?mock=1&id=PR-2026-001）

| viewport | ファイル |
|----------|----------|
| 390px | `reports/screenshots/partner-mgmt-ui/detail-mock-390.png` |
| 768px | `reports/screenshots/partner-mgmt-ui/detail-mock-768.png` |
| 1280px | `reports/screenshots/partner-mgmt-ui/detail-mock-1280.png` |

---

## 機能変更なし（確認）

- `partner-list` / `partner-get` / `partner-review` / `partner-document-verify` 呼び出し: **変更なし**
- `?mock=1` フォールバック: **維持**
- `data-prt-mgmt-*` / `data-prt-detail-*` 属性: **維持**（検証スクリプト互換）
