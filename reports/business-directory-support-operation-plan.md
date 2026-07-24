# Business Directory — サポート窓口・問い合わせ運用計画（OB7）

**日付:** 2026-07-04  
**種別:** OB7 — Human Decision · Docs / Runbook（調査・運用案のみ · コード変更なし）  
**前提:** MVP-1 Complete · Commercial Launch **Conditional** · HG-7 **❌ 未整備**  
**正本リンク:** [launch-gate-prep](./business-directory-launch-gate-prep.md) · [commercial-launch-checklist](./business-directory-commercial-launch-checklist.md) · [operational-readiness](./business-directory-operational-readiness.md) L15 / §5.3 / §6.4

---

## Executive summary

| 判断 | 結果 |
| --- | --- |
| **OB7 現状** | **未整備**（公開連絡先未確定 · BD 専用導線なし） |
| **Commercial Launch 前** | **P0 窓口の確定と公開導線が必須** |
| **推奨チャネル（Launch 最小）** | 既存 **`/iwasho/contact.html`** を暫定窓口とし、件名/種別に **Business Directory** を運用で区別（フォーム種別追加は実装タスク） |
| **人間必須** | 公開メール/フォームの最終決定 · 担当割当 · SLA 数値承認 · 電話番号の扱い |

---

## 1. 現状

### 1.1 既存の問い合わせ導線（サイト全体）

| 導線 | パス | 対象 | BD 向けか | 備考 |
| --- | --- | --- | --- | --- |
| **Contact（IWASHO）** | `/iwasho/contact.html` | 一般・法人 | **間接のみ** | 種別: サービス / パートナー / 製品・ツール / その他。**BD 専用オプションなし**。`action="#"`（送信先バックエンド未確認） |
| **Contact（Company）** | `/company/contact.html` | 協力パートナー登録 | **否** | ナビ上「協力パートナー」。一般サポート窓口ではない |
| **FAQ / Q&A** | `/company/faq.html` | 一般 | **否** | TASFUL 全般。**Business Directory / 掲載サブスクの FAQ なし** |
| **Company** | `/company/` · about / services 等 | 会社情報 | **否** | フッターから `iwasho/contact` へ誘導 |
| **Terms（Platform）** | `/company/legal/terms.html` | 全ユーザー | **部分** | 案件・マッチング中心。BD 条項なし。問い合わせは `iwasho/contact` |
| **Privacy** | `/company/legal/privacy.html` | 全ユーザー | **部分** | 開示請求等は `iwasho/contact`。BD 公開掲載データの明示は薄い |
| **特商法** | `/company/legal/tokushoho.html` | 課金利用者 | **部分** | 価格は「各サービス画面」。BD 月額の明示なし。連絡はフォーム請求時開示方針 |
| **Support（運営）** | `/support-trouble-center.html` | **運営のみ** | **内部** | AI 運営司令塔配下。金銭・BAN・返金の最終実行は管理者。**一般公開窓口ではない** |
| **TOP フッター** | `index-top.html` | 一般 | **弱い** | FAQ · `iwasho/contact` · `mailto:contact@tasufull.example`（**プレースホルダ**） |

### 1.2 Business Directory 内の導線

| 画面 | サポート導線 | 状態 |
| --- | --- | --- |
| Owner `index` / `new` / `edit` | フッター: 掲載規約 · 特商法 · プライバシー | **サポート窓口リンクなし**（OB3 で法務リンクのみ追加済） |
| `terms.html` | 「サポート窓口まで（窓口の公開連絡先は運営が別途定めます）」 | **連絡先未記載** |
| Public `detail` | `mailto:` 掲載者の `contact_email` | **掲載者への問い合わせ**（TASFUL 運営ではない） |
| Public `list` | なし | — |
| Admin `reviews` / `listing` | 審査オペのみ | Owner サポート UI なし |

### 1.3 運営側の既存能力

| 機能 | 用途 | BD サポートとの関係 |
| --- | --- | --- |
| BD Admin 審査キュー | 承認 / 差戻し / 停止 | **掲載審査**はここ。一般問い合わせ受信箱ではない |
| `support-trouble-center` | 重要問い合わせ · AI 一次対応 | プラットフォーム横断の運営ツール。BD 専用カテゴリ未整備 |
| operational-readiness §6.4 | エスカレーション草案 | 審査滞留 48h · 不正掲載 · Stripe 不整合 |

### 1.4 不足項目（現状ギャップ）

| # | 不足 |
| --- | --- |
| G1 | BD Owner / 利用者向けの **公開サポート入口**（メール or フォーム種別）が未確定 |
| G2 | `terms.html` が「窓口は別途定める」のまま（HG-7 / L15） |
| G3 | Owner UI にサポートリンクがない |
| G4 | FAQ に BD（審査・プラン・課金・差戻し）がない |
| G5 | `contact@tasufull.example` がプレースホルダ |
| G6 | 問い合わせ種別・担当・SLA・エスカレーションの **運用確定文書**が未公開（本ドキュメントが草案） |
| G7 | 通報・権利侵害の専用受付フローが未定義 |
| G8 | 課金・返金の一次窓口と Stripe Portal 案内の役割分担が未文書化 |

---

## 2. Business Directory 利用者向け問い合わせ導線（整理）

### 2.1 利用者ペルソナ

| ペルソナ | 例 |
| --- | --- |
| **Owner（掲載者）** | 掲載作成・審査・課金・差戻し・停止 |
| **Viewer（閲覧者）** | 掲載内容の通報・権利侵害・不具合 |
| **掲載者への直接連絡** | Public 詳細の mailto（運営外） |

### 2.2 カテゴリ別 — 推奨入口と一次対応

| カテゴリ | 誰から | 推奨入口（Launch 案） | 一次対応 | 運営ツール |
| --- | --- | --- | --- | --- |
| **掲載について**（作り方・審査状況） | Owner | Owner UI オンボーディング + FAQ · 未解決時は Contact（件名に `[BD-掲載]`） | Ops（審査キュー確認） | Admin reviews |
| **掲載停止**（自分から止めたい / 停止された） | Owner | Contact `[BD-停止]` · 規約参照 | Ops | Admin suspend / unpublish |
| **アカウント**（ログイン・会員） | Owner | 既存会員サポート経路 · Contact `[BD-アカウント]` | Ops / Auth | Supabase Auth（人間オペ） |
| **課金**（プラン変更・請求） | Owner | **Billing Portal を第一** · 失敗時 Contact `[BD-課金]` | Ops | Stripe Dashboard · Portal |
| **返金** | Owner | Contact `[BD-返金]` · `terms.html` §3.2（日割りなし · 誤課金等のみ個別） | Ops → 経理/法務 | Stripe 返金オペ |
| **不具合**（画面・保存・申請エラー） | Owner / Viewer | Contact `[BD-不具合]` | Ops → Dev | Edge logs · smoke |
| **通報**（虚偽・迷惑掲載） | Viewer / Owner | Contact `[BD-通報]` | Ops | Admin suspend + audit |
| **権利侵害**（著作権・商標・肖像） | 第三者 / Owner | Contact `[BD-権利]` | Ops → **法務** | suspend + 法務判断 |
| **その他** | いずれか | Contact `[BD-その他]` | Ops | — |
| **掲載者への商談・見積** | Viewer | Public 詳細の **掲載者 mailto / 公式サイト** | **運営は対応しない** | — |

### 2.3 推奨ユーザー導線（Launch 最小）

```text
Owner
  ├─ 操作案内 → ダッシュボード「はじめての掲載」· terms / FAQ（P1）
  ├─ 課金操作 → Billing Portal（edit プランカード）
  └─ 解決しない → iwasho/contact（件名プレフィックス [BD-…]）※暫定

Viewer
  ├─ 掲載者へ連絡 → Public 詳細 mailto / 公式サイト
  └─ 運営へ通報・権利侵害 → iwasho/contact [BD-通報] / [BD-権利]

運営
  └─ support-trouble-center / BD Admin（内部）
```

---

## 3. 運営側対応フロー（推奨運用）

**仮置き SLA（人間承認待ち · operational-readiness 草案に準拠）**

| 区分 | 返信目安（案） |
| --- | --- |
| 一般（掲載・操作・課金案内） | **2 営業日以内** 初回返信 |
| 課金不整合・ログイン不能 | **1 営業日以内** 初回返信 |
| 権利侵害・重大な規約違反 | **当日〜1 営業日** 受付確認 · 措置は法務判断後 |

### 3.1 カテゴリ別フロー

| カテゴリ | 初回受付 | 対応担当 | 返信目安（案） | エスカレーション条件 |
| --- | --- | --- | --- | --- |
| 掲載について | Contact / メール振分 `[BD-掲載]` | Ops | 2 営業日 | 審査滞留 **> 48h** → Ops リード → PO（§6.4） |
| 掲載停止 | 同上 `[BD-停止]` | Ops | 1–2 営業日 | 紛争・法的要求 → 法務 |
| アカウント | 同上 `[BD-アカウント]` | Ops | 1 営業日 | Auth 障害・データ消失疑い → Dev |
| 課金 | Portal 案内を優先 · 失敗時 `[BD-課金]` | Ops | 1 営業日 | Webhook 不整合・二重請求 → Dev + Stripe Dashboard |
| 返金 | `[BD-返金]` · terms 確認 | Ops | 1–2 営業日 | 誤課金以外の返金要求・高額 → 経理 / 法務 |
| 不具合 | `[BD-不具合]` · 再現手順依頼 | Ops | 1 営業日 | 再現する本番障害 → Dev（P0） |
| 通報 | `[BD-通報]` | Ops | 当日〜1 営業日 | 悪質・反復 → suspend + PO |
| 権利侵害 | `[BD-権利]` | Ops 受付 → **法務** | 受付確認 当日 | 削除請求・代理人通知 → 法務必須 |
| その他 | `[BD-その他]` | Ops | 2 営業日 | カテゴリ再分類 |

### 3.2 標準オペ手順（一次対応）

```text
1. 受付（フォーム/メール）→ 件名プレフィックスで振分
2. 本人確認（会員メールと一致するか · listing_id があれば確認）
3. 対応境界チェック（operational-readiness §5.3）
   - する: ステータス説明 · 課金案内 · 不具合切り分け · 規約に基づく停止
   - しない: 文案代筆 · 写真代行 · Marketplace/案件の話
4. 返信テンプレ（下記 §推奨運用）で初回返信
5. 必要なら Admin / Stripe / Dev へエスカレーション
6. クローズ記録（メールスレッド or 将来チケット ID）
```

### 3.3 対応境界（再掲 · Self-Service）

| 対応する | 対応しない |
| --- | --- |
| 審査ステータス · 差戻し理由の説明 | 掲載文案の代筆 · 写真の代アップロード |
| プラン · 課金・Portal 案内 | フォーム入力代行 |
| 不具合 · ログイン障害の切り分け | Marketplace / Platform 案件の仲介 |
| 規約違反時の停止・非公開 | 掲載者–閲覧者間の商談トラブルの仲裁 |

---

## 4. 推奨運用（Launch 方針案）

### 4.1 チャネル方針（推奨）

| 優先 | チャネル | 理由 |
| --- | --- | --- |
| **1（P0）** | **`/iwasho/contact.html` を暫定公式窓口** | 既に privacy / terms / TOP から参照。新規インフラ不要 |
| **2（P0）** | 件名運用ルール `[BD-カテゴリ]` | フォーム改修前でも振分可能 |
| **3（P0）** | Owner UI・`terms.html` に **サポートリンクを明示**（実装は別タスク） | HG-7 Go 条件「到達可能な導線」 |
| **4（P1）** | Contact 種別に「店舗・業務掲載（Business Directory）」追加 | 振分精度向上 |
| **5（P1）** | BD FAQ（Owner オンボーディングと統合） | 問い合わせ削減 |
| **6（P2）** | 専用メール（例: `bd-support@…`）· チケット自動起票 · Talk | 規模拡大後 |

**電話:** privacy は「電話対応なし」。`iwasho/contact` にデモ番号あり。**Launch では電話を公式 BD 窓口にしない**ことを推奨（プレースホルダ番号のリスク）。

**TALK:** Launch Gate 上は選択肢の一つだが、BD MVP-1 は Talk 未接続。**OB7 Launch 最小では TALK を必須にしない**。

### 4.2 初回返信テンプレ（草案）

**一般:**

> お問い合わせありがとうございます。店舗・業務掲載（Business Directory）担当です。  
> 内容を確認のうえ、○営業日以内を目安にご案内します。  
> 掲載 ID（わかる場合）・画面の症状・発生時刻を追記いただけると助かります。

**課金:**

> プランの確認・解約・支払い方法の更新は、掲載編集画面の「支払い・解約 (Billing Portal)」からお手続きください。  
> Portal に進めない場合は、その旨と掲載名を返信ください。

**返金:**

> 返金は原則として行っておりません（日割りなし）。誤課金・二重課金・システム不具合が疑われる場合は個別に確認します。  
> 決済日時・金額・掲載名を教えてください。

---

## 5. P0 / P1 / P2

### P0 — Commercial Launch 前に最低限必要

| ID | 作業 | 担当 | 完了条件 |
| --- | --- | --- | --- |
| **S-P0-1** | 公式サポート入口の決定（推奨: `iwasho/contact`） | PO + Ops | 文書化・社内合意 |
| **S-P0-2** | 公開連絡先の確定（プレースホルダ `contact@tasufull.example` を使わない） | PO | 実在する受信箱 or 稼働フォーム |
| **S-P0-3** | 件名プレフィックス / 振分ルールの社内共有 | Ops | Runbook 周知 |
| **S-P0-4** | Owner UI・`terms.html` からサポート入口へリンク（**実装タスク · 本ドキュメント外**） | Cursor / Dev | 8788 で到達確認 |
| **S-P0-5** | 一次対応担当・バックアップ担当の指名 | Ops | 名前 or ロール確定 |
| **S-P0-6** | SLA 仮置きの承認（例: 一般 2 営業日 · 課金/障害 1 営業日） | PO + Ops | チェックリスト HG-7 更新可能 |
| **S-P0-7** | 返金・権利侵害のエスカレーション先（経理・法務）の連絡手段 | PO | 社内連絡先リスト |
| **S-P0-8** | **サポート受付時間**の公開・運用 | PO + Ops | 下記「P0 確定事項」どおり周知 |
| **S-P0-9** | **問い合わせカテゴリ**の公開・振分 | Ops | 下記カテゴリ一覧どおり運用 |

#### P0 確定事項（承認追記 · 2026-07-04）

**サポート受付時間**

- 平日 9:00〜18:00
- 営業時間外は翌営業日に順次対応

**問い合わせカテゴリ（P0）**

- 掲載について
- アカウント
- 課金
- 返金
- 不具合
- 通報
- 権利侵害
- その他

件名プレフィックス例: `[BD-掲載]` · `[BD-アカウント]` · `[BD-課金]` · `[BD-返金]` · `[BD-不具合]` · `[BD-通報]` · `[BD-権利]` · `[BD-その他]`

### P1 — Launch 直後〜早期に整備

| ID | 作業 |
| --- | --- |
| **S-P1-1** | Contact フォームに BD 種別オプション追加 |
| **S-P1-2** | BD FAQ（審査・プラン・差戻し・Portal）公開 |
| **S-P1-3** | 返信テンプレの正式版・共有フォルダ |
| **S-P1-4** | 審査 SLA とサポート SLA の Owner 向け表記統一（OB3 連動） |
| **S-P1-5** | `support-trouble-center` への BD タグ連携（任意） |

### P2 — 規模拡大後

| ID | 作業 |
| --- | --- |
| **S-P2-1** | BD 専用メールアドレス · 自動チケット |
| **S-P2-2** | TALK / アプリ内サポートルーム |
| **S-P2-3** | 多言語 · 営業時間外オート返信高度化 |
| **S-P2-4** | CSAT・問い合わせ分析ダッシュボード |

---

## 6. Launch 前に必要な作業（チェックリスト）

### 人間・Ops（必須）

- [ ] **S-P0-1** 公式窓口を `iwasho/contact` にするか、別メールにするか決定
- [ ] **S-P0-2** 実在する受信手段を用意（フォーム送信先 or メール）
- [ ] **S-P0-5 / S-P0-6 / S-P0-7** 担当・SLA・エスカレーション先の承認
- [ ] `iwasho/contact` のデモ電話番号を公式に使わない方針の確認
- [ ] HG-7（OB7）を checklist 上で更新する準備（導線実装後）

### 実装（別タスク · 本ドキュメントでは未実施）

- [ ] Owner `index` / `new` / `edit` / `terms.html` に「サポート・お問い合わせ」リンク追加（→ `iwasho/contact.html` または決定した URL）
- [ ] Public フッターまたは list/detail に運営通報入口（任意だが通報 P0 なら必要）
- [ ] （任意）Contact 種別「店舗・業務掲載」

### ドキュメント

- [x] 本運用計画（`reports/business-directory-support-operation-plan.md`）
- [ ] PO/Ops 承認後、operational-readiness L15 · commercial-launch-checklist HG-7 を更新（**TODO 更新は別指示**）

---

## 7. Commercial Launch Checklist への対応表

| Checklist | 本計画での充足 |
| --- | --- |
| **HG-7 OB7 サポート窓口** | 方針草案まで。**公開導線実装 + 人間承認後に Go** |
| L15（operational-readiness） | 同上 |
| OB7 Go 条件（launch-gate-prep） | 「公開ページ/Owner UI から到達可能」「初回問い合わせ対応手順確定」→ **手順は本ドキュメント §3–4、到達は S-P0-4 実装待ち** |

---

## 8. 人間確認が必要な項目（決定待ち）

| # | 決定事項 | 推奨案 |
| --- | --- | --- |
| H1 | 公式窓口 URL / メール | `/iwasho/contact.html` 暫定 |
| H2 | 電話サポートの有無 | **なし**（privacy と整合） |
| H3 | SLA 数値 | 一般 2 営業日 · 課金/障害 1 営業日 |
| H4 | 一次担当ロール名 | Ops Admin（審査担当と兼務可） |
| H5 | 権利侵害の法務連絡先 | 社内リスト（非公開） |
| H6 | フォーム `action="#"` の本番送信先 | 稼働確認必須 |

---

## 9. 参照

| 文書 | 内容 |
| --- | --- |
| [business-directory-launch-gate-prep.md](./business-directory-launch-gate-prep.md) | OB7 定義 |
| [business-directory-commercial-launch-checklist.md](./business-directory-commercial-launch-checklist.md) | HG-7 |
| [business-directory-operational-readiness.md](./business-directory-operational-readiness.md) | L15 · §5.3 · §6.4 |
| [business-directory-ob6 関連](./business-directory-ob6-legal.md) · `business-directory/terms.html` | 返金・窓口文言 |
| `/iwasho/contact.html` | 暫定公開フォーム |
| `/support-trouble-center.html` | 運営内部 |

---

*OB7 調査・運用計画草案（2026-07-04）。コード変更・commit・deploy・TODO 更新なし。人間承認と導線実装後に HG-7 Go を判断する。*
