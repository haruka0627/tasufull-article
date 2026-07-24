# Builder Architecture — 案件管理 + マッチング + 業者ページ

**Status:** Active（方針正本 · 段階実装）  
**最終更新:** 2026-07-03  
**関連:** [BUILDER_AI.md](./BUILDER_AI.md) · [BUILDER_MONETIZATION.md](./BUILDER_MONETIZATION.md) · [DECISIONS.md](../DECISIONS.md) AD-002

---

## 目的

Builder を **案件管理 · マッチング · 業者ページ管理** の統合管理画面とする。

- **チャット本文 UI は Builder に置かない** — やり取りは **TASFUL Talk のみ**
- Builder は **threadId 管理 · Talk 遷移 · 未読 · ステータス · 書類/請求** を担当
- 既存 **project-calendar / admin-calendar / パートナー受諾** は維持

---

## 1. チャット方針（Talk 統一）

| 対象 | Builder の責務 | Talk の責務 |
| --- | --- | --- |
| 一般ユーザー × パートナー/業者/ワーカー | threadId 作成/保存 · 「Talkで開く」 | メッセージ · 写真 · PDF · 完了報告 |
| 運営 × パートナー | 同上 | 同上 |
| 案件スレッド | 受諾後に thread 作成 · ステータス連動 | 案件進行のやり取り |

**禁止:** Builder 内のメッセージ送受信 UI（`mvp-thread.html` 等は Talk へリダイレクト）

**実装:** `builder-talk-bridge.js` · `builder/builder.js`（`wireBuilderTalkContactActions`）

---

## 2. 案件フロー

### A. 運営案件

1. 運営が **admin-calendar** で案件作成  
2. パートナーへ手配  
3. パートナーが **project-calendar「パートナー案件」** で受ける/受けない  
4. 受諾 → **TASFUL Talk** に案件スレッド作成  
5. 以後のやり取り · 写真 · PDF · 完了報告は **Talk**  
6. Builder は **案件ステータス · 完了 · 請求書 · 報告書** を管理  

**課金:** 情報開示料 **不要**（運営がパートナーを選ぶため）。**完了後の案件手数料** のみ。

### B. 一般案件

1. 一般ユーザーが案件投稿  
2. 掲載者/業者/ワーカーが受諾  
3. Talk スレッド作成 → Talk で進行  
4. 完了報告  
5. **情報開示料 ¥550**（該当時）+ **完了後案件手数料 5〜10%**

---

## 3. 課金方針

| 区分 | 情報開示料 | 案件手数料 | 備考 |
| --- | --- | --- | --- |
| **A. 運営案件** | 不要 | 完了後のみ | 550円は対象外 |
| **B. 一般案件** | ¥550 | 5〜10% | 連絡先開示タイミング |
| **C. ワーカー検索** | ¥550 のみ | なし | 成果報酬なし |
| **D. 業者検索** | ¥550 のみ | なし | 成果報酬なし |

**情報開示料の定義**

- チャット料金 **ではない**
- **連絡先開示料**（氏名 · 電話 · メール等を表示する瞬間）
- Talk でのメッセージは **別途無料**

**定数:** `builder/builder-billing-policy.js` · 詳細 [BUILDER_MONETIZATION.md](./BUILDER_MONETIZATION.md)

---

## 4. ワーカー検索 · 業者検索

### 画面

- `builder/find-workers.html` — ワーカー検索  
- `builder/partners.html` · `builder/partner.html` — 業者検索/詳細  

### 導線

1. 検索 → プロフィール  
2. **相談する / 依頼する** → Talk スレッド（Builder 内チャットなし）  
3. **連絡先を開示する** → ¥550 決済（demo: `builder-contact-reveal.js`）  
4. 決済後に電話/メール表示 · 開示済みは履歴として再表示  

**禁止:** 検索用チャット UI · 開示前の電話/メール平文表示

---

## 5. 業者ページ作成（将来）

**目的:** 業者が紹介ページ/ホームページを作成・管理

| 項目 | 方針 |
| --- | --- |
| 料金 | **サブスク**（有料プラン主機能） |
| 機能 | マイページ · 編集 · 公開/非公開 · プレビュー · SEO · お問い合わせ · Business Directory 連携 |
| AI ページ作成 | 有料 AI · 業種/サービス/地域/強み入力 → 文案/構成（ユーザー編集前提） |
| コード編集 | 上級者向け HTML/CSS/JS · script 制限/サニタイズ要検討 |

**プレースホルダー:** `builder/vendor-pages.html`

---

## 6. ナビゲーション（将来メニュー）

`builder/builder-nav-config.js` が正本。

| メニュー | href（partner / user） |
| --- | --- |
| ダッシュボード | `index.html` / `user-dashboard.html` |
| 案件カレンダー | `project-calendar.html` |
| 案件一覧 | `mvp-projects.html` / `board-projects.html` |
| ワーカー検索 | `find-workers.html` |
| 業者検索 | `partners.html` |
| 業者ページ管理 | `vendor-pages.html`（準備中） |
| 請求書 | `invoices.html`（準備中） |
| 書類・提出物 | `mvp-templates.html` |
| 通知 | `mvp-notifications.html` |
| やりとり (Talk) | `talk-home.html?tab=chat&channel=builder` |
| 設定 | `settings.html` |

描画: `builder/builder-nav.js`（`data-builder-nav-autoload`）

---

## 7. 制約（変更禁止 unless Critical）

- project-calendar / admin-calendar の完成機能  
- パートナー案件 受ける/受けない  
- 通常カレンダー予定追加  
- admin-calendar 手配完了反映  
- Builder 内チャット本文 UI 増設禁止  
- Talk = 唯一のチャット基盤  

---

## 8. 検証

```bash
npm run dev   # http://127.0.0.1:8788
node scripts/verify-builder-architecture-nav-contact.mjs
node scripts/verify-builder-project-calendar-partner-accept-decline.mjs
node scripts/verify-builder-search-talk-contact.mjs
```

完了報告: HTTP 200 · Console Error 0 · Viewport 1280/768/390
