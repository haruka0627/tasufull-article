# 協力パートナー登録 実装結果レポート

実施日: 2026-06-23

## 概要

IWASHO / TASFUL / Builder に「協力パートナー登録」導線を追加しました。登録フォームは静的モック（`preventDefault` + 完了メッセージ表示）です。名称は「協力パートナー登録」で統一し、「協力会社登録」表記は登録導線から排除しています。

---

## 作成・修正ファイル一覧

### 新規作成

| ファイル | 内容 |
|---------|------|
| `partner-register.css` | 登録フォーム共通スタイル（セクション分け・390px対応） |
| `partner-register-form.js` | フォームHTML生成・送信モック・法人番号表示切替 |
| `iwasho/partner-register.html` | IWASHO側登録ページ（`source=iwasho`） |
| `partner-register.html` | TASFUL側登録ページ（`source=tasful`） |
| `builder/partner-management.html` | Builder管理画面（静的モック一覧） |
| `builder/partner-management.js` | 管理画面モックデータ・フィルタ・詳細パネル |
| `scripts/verify-partner-register-viewports.mjs` | 表示・console検証スクリプト |

### 導線・リンク更新

| ファイル | 変更内容 |
|---------|----------|
| `iwasho/partners.html` | CTA・ヘッダー・フッターを `/iwasho/partner-register.html` へ |
| `iwasho/index.html` | ヒーロー・カード・フッターの登録導線を更新 |
| `company/contact.html` | 登録CTA・フッターを `/partner-register.html` へ |
| `company/index.html` | フッター「協力パートナー登録」リンクを更新 |
| `builder-admin/admin-index.html` | 運営メニューに「協力パートナー管理」カード追加 |
| `builder/builder-top.html` | 「協力会社登録」→「協力パートナー登録」、`/partner-register.html?source=builder` へ |

### deploy/cloudflare/dist 同期

上記新規・更新ファイルを `deploy/cloudflare/dist/` に手動コピー済み（`npm run build:pages` は Supabase 環境変数未設定のためスキップ）。

---

## URL

| 種別 | URL |
|------|-----|
| **IWASHO側** | `/iwasho/partner-register.html` |
| **TASFUL側** | `/partner-register.html` |
| **Builder管理画面** | `/builder/partner-management.html` |
| **Builderからの登録（将来用）** | `/partner-register.html?source=builder` |

---

## フォーム仕様

### hidden項目（流入元）

- IWASHO: `source=iwasho`
- TASFUL: `source=tasful`
- Builder: `source=builder`（クエリ `?source=builder` で上書き可）

### セクション構成

1. 基本情報（会社名・屋号、代表者、担当者、区分、住所連絡先、法人番号、URL等）
2. 事業情報（業種チェックボックス18種、対応エリア、実績、月間件数、曜日時間帯）
3. 資格・許可
4. 保険・労災
5. インボイス
6. 添付書類（file input UIのみ）
7. 確認・同意（6項目 + プライバシーポリシー）

### 送信動作

- ボタン文言: 「登録申請を送信する」
- 送信後: 「登録申請を受け付けました。内容確認後、審査結果をご連絡します。」

---

## Builder管理画面（静的モック）

表示項目: 受付日、流入元、会社名・屋号、区分、業種、対応エリア、インボイス、保険、労災、ステータス

ステータス: 審査待ち / 保留 / 承認 / 否認 / 契約済み

- モックデータ 7件
- キーワード・流入元・ステータスでフィルタ
- 「詳細確認」ボタンで詳細パネル表示
- 将来の審査基準・反社チェック・電子契約接続用の注記あり

---

## 表示確認結果（390 / 768 / 1280px）

検証コマンド: `node scripts/verify-partner-register-viewports.mjs`  
ベースURL: `http://127.0.0.1:8788`

| ページ | 390px | 768px | 1280px |
|--------|-------|-------|--------|
| IWASHO `/iwasho/partner-register.html` | OK | OK | OK |
| TASFUL `/partner-register.html` | OK | OK | OK |
| Builder `/builder/partner-management.html` | OK | OK | OK |

スクリーンショット: `reports/screenshots/partner-register/`  
検証JSON: `reports/partner-register-verify.json`

---

## console error

**0件**（全9パターン: 3ページ × 3 viewport でエラーなし）

---

## 備考

- DB / Supabase 接続は未実装（要件どおり）
- 既存IWASHO法務ページのヘッダー・フッター・白背景・ネイビー基調を踏襲
- TASFUL側は `company/contact.html` と同系のヘッダー・`modern-footer` を使用
- `builder/mvp-partner-register.html` は既存MVP画面として残存（builder-top導線は新フォームへ変更）
