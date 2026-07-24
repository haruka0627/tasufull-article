# Business Directory — サポート窓口 Runbook（OB7）

**日付:** 2026-07-01  
**種別:** OB7 — Docs / Runbook · Cursor 部分可（Runbook · テンプレート · docs 索引）  
**前提:** MVP-1 技術実装完了 · Production Test Stripe E2E **GO**  
**状態:** **DRAFT**（窓口開設・担当割当・連絡先公開は人間判断）

---

## 1. 問い合わせチャネル案

| チャネル | 用途 | 状態 |
| --- | --- | --- |
| メール（`support-business-directory@tasful.jp`） | Owner 向け一次受付 | ⚠️ アドレス要開設 |
| お問い合わせフォーム | Public からの問い合わせ | ⚠️ 既存 `support-intake.html` に BD カテゴリ追加検討 |
| TALK（管理者チャット） | 運営内エスカレーション | ✅ 既存 `talk-ops-room` |

---

## 2. 受付時間・SLA（要人間決定）

| 項目 | 案 |
| --- | --- |
| 受付時間 | **[要決定]** 平日 10:00-18:00 |
| 初回応答 目標時間 | **[要決定]** 24 時間以内（営業日） |
| 解決 目標時間 | **[要決定]** 3 営業日以内 |
| 休業日 | **[要決定]** 土日祝 |

---

## 3. エスカレーションフロー

```text
[1] 問い合わせ受付
  → メール / フォーム

[2] 一次対応（運営スタッフ）
  → FAQ で解決可能か確認
  → テンプレートで一次返信
  → 解決 → クローズ

[3] 二次対応（テクニカル）
  → Stripe 課金問題 → Stripe Dashboard 確認
  → 掲載不具合 → Admin 画面 + DB 確認
  → 審査遅延 → 審査キュー確認

[4] エスカレーション
  → 30 分以内に未解決 → シニアスタッフに連絡
  → 1 時間以内に未解決 → プロダクトオーナーに連絡
  → 重大障害 → オンコール Runbook（OB4 §6）
```

---

## 4. 返信テンプレート

### 一次受付テンプレート

```
{owner_name} 様

TASFUL Business Directory にお問い合わせいただきありがとうございます。

ご質問の内容を確認のうえ、担当者よりご連絡いたします。
通常、営業日 [XX] 時間以内にご返信いたします。

なお、よくあるご質問は以下でもご確認いただけます。
{faq_url}

TASFUL Business Directory 運営
```

### 審査遅延テンプレート

```
{owner_name} 様

掲載審査にお時間をいただき申し訳ございません。
現在、審査が混み合っており、通常よりお時間をいただいております。

審査完了次第、改めてご連絡いたします。
お急ぎの場合は、本メールにご返信ください。

TASFUL Business Directory 運営
```

### 課金問題テンプレート

```
{owner_name} 様

課金に関するお問い合わせを承りました。

■ ご利用プラン: {plan_name}
■ 課金状況の確認方法:
1. 掲載管理ページにログイン
2. 該当の掲載を開く
3. 「Billing Portal」からご利用状況を確認

問題が解決しない場合は、以下をお知らせください。
- 発生している現象
- エラーメッセージ（表示されている場合）

TASFUL Business Directory 運営
```

---

## 5. 公開ページからの導線（実装案）

### Owner 向け（既存ページへの追加候補）

```html
<!-- business-directory/index.html または edit.html へ追加 -->
<div class="bd-support-link">
  <a href="mailto:support-business-directory@tasful.jp">お問い合わせ</a>
  ·
  <a href="/help/">ヘルプ</a>
</div>
```

### Public 向け（detail.html へ追加候補）

```html
<!-- business-directory/public/detail.html へ追加 -->
<p class="bd-public-support">
  掲載内容に関するお問い合わせは、各店舗・事業者へ直接ご連絡ください。
  掲載システムについてのお問い合わせは <a href="mailto:support-business-directory@tasful.jp">こちら</a>。
</p>
```

---

## 6. 残課題（OB7 完了条件）

| # | 項目 | 状態 |
| --- | --- | --- |
| 1 | サポートメールアドレス開設 | ⚠️ 人間承認・運用設定 |
| 2 | 担当者割当 | ⚠️ 人間承認・運用設定 |
| 3 | 受付時間・SLA 決定 | ⚠️ 人間承認・運用設定 |
| 4 | 連絡先の公開判断（どこに表示するか） | ⚠️ 人間承認・運用設定 |
| 5 | サポート導線の実装 | ⚠️ 公開後 Cursor 実装可 |

---

*OB7 草案完了（2026-07-01 · Cursor）。人間承認・運用設定 5 件残。*
