# Business Directory Owner/Admin UI Flow 設計 — 報告

**日付:** 2026-06-27  
**種別:** docs のみ（コード · UI · migration 変更なし）  
**前提:** AD-013 · Data Model `28375b9`

---

## 成果物

| ファイル | 内容 |
| --- | --- |
| `docs/business-directory-ui-flow-design.md` | **新規** UI flow 正本 |
| `reports/business-directory-ui-flow-design.md` | 本報告 |
| `docs/ROADMAP.md` / `TODO.md` / `README.md` | 索引更新 |

---

## 設計サマリー

### 事業者 UI（9 画面）

ダッシュボード · 新規作成 · 初回最小フォーム · 掲載一覧 · タブ編集 · プレビュー · 公開申請 · 審査結果 · プラン導線

### 編集タブ（9）

基本情報 · 写真 · TLV · SNS · 営業時間 · 商品/サービス · 実績 · プレビュー · 公開設定 — 各タブに表示/編集/テーブル/プラン制限/MVP 範囲を定義

### 運営 UI（8 機能）

審査キュー · 詳細確認（**読取のみ**）· 承認 · 差戻し · 停止 · 再公開 · 監査ログ · プラン確認 — **入力代行なし**

### 公開フロー

```text
draft → review_requested → published
  ↑ 差戻し              ↓ suspended → archived
published + 主要変更 → review_requested
```

---

## 確認

| 項目 | 結果 |
| --- | --- |
| docs / reports のみ | ✅ |
| AD-013 / data model 整合 | ✅ |
| 運営入力代行なし | ✅ |
| 初回フォーム最小 | ✅ |
| Marketplace / Platform 境界 | ✅ |
| コード変更なし | ✅ |

---

## 次フェーズ（未着手）

HTML/JS 実装 · admin 画面 · E2E — 別 Epic
