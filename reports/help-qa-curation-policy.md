# Q&A 整理方針レポート（調査のみ）

**生成日時:** 2026-06-30T02:37:04.935Z
**対象:** 4394 件（`platform-qa-articles.generated.js`）
**方針:** 削除・統合は未実施。整理管理 UI 完成済み · 本レポートは削除前の判断材料。

---

## 1. 全体像

| 指標 | 件数 | 割合 |
|------|------|------|
| 総記事数 | 4394 | 100% |
| 重複候補（いずれかの重複理由あり） | 4382 | 99.7% |
| 低品質候補（品質 issue ≥1） | 4384 | 99.8% |
| 汎用文のみ（generic-text） | 4347 | 98.9% |
| デフォルト bullets のみ | 4342 | 98.8% |
| カスタム steps あり | 48 | 1.1% |
| 統合グループ（topicKey あたり 2+） | 109 | — |
| 削除スコア ≥7（自動削除候補） | 4207 | 95.7% |
| うち q/persona 変種のみ | 4122 | 93.8% |
| うち法務/料金/障害/セキュリティ（要人手確認） | 680 | 15.5% |
| 保持スコア ≥5（優先保持候補） | 905 | 20.6% |
| ユニーク topicKey 数 | 121 | — |

### スラッグパターン

| パターン | 件数 | 説明 |
|----------|------|------|
| canonical | 118 | topicKey そのまま（代表候補） |
| persona-variant | 597 | `-beginner` 等ペルソナ違い |
| question-variant | 3679 | `-q2` 以降の質問バリエーション |

### 質問パターン

| パターン | 件数 |
|----------|------|
| original | 1147 |
| rephrase-polite | 541 |
| rephrase-want | 542 |
| bracket-prefixed | 1623 |
| english-question | 541 |

### カテゴリ分布（上位）

| category | 件数 |
|----------|------|
| ai | 777 |
| tlv | 600 |
| talk | 488 |
| material | 398 |
| listing | 324 |
| account | 302 |
| platform | 283 |
| legal | 281 |
| pricing | 246 |
| security | 203 |
| search | 162 |
| trouble | 122 |

### サービス分布

| service | 件数 |
|---------|------|
| platform | 2131 |
| tasful-ai | 777 |
| tlv | 600 |
| talk | 488 |
| material | 398 |

---

## 2. 重複パターン分類（代表）

| パターン ID | 説明 | 規模 |
|-------------|------|------|
| **D1 slug-base 大量** | 同一 topicKey + `-qN` / persona 違いのみ | 108 トピック（各5件以上） |
| **D2 slug-base 中** | 同一 topicKey で 2〜4 件 | 1 トピック |
| **D3 title 完全一致** | 正規化タイトル同一 | 108 グループ |
| **D4 question 完全一致** | 正規化質問同一 | 541 グループ |
| **D5 言い換えテンプレ** | `を教えてください` / `について知りたい` / `【初心者】` / `English:` | 3247 件 |
| **D6 ペルソナ重複** | `-beginner` 等 · 本文同一 | 597 件 |

### 統合グループサンプル（variant 多い順）

#### `oauth-login`（54 件 · platform / account）
- **代表候補:** `oauth-login` — SNS・外部ログイン
- 統合候補: `oauth-login-q2` — 「Googleでログインを教えてください」
- 統合候補: `oauth-login-q3` — 「Googleでログインについて知りたい」
- 統合候補: `oauth-login-q4` — 「【初心者】Googleでログイン」

#### `product-listing`（41 件 · platform / listing）
- **代表候補:** `product-listing` — 商品掲載
- 統合候補: `product-listing-q2` — 「商品を出品するにはを教えてください」
- 統合候補: `product-listing-q3` — 「商品を出品するにはについて知りたい」
- 統合候補: `product-listing-q4` — 「【初心者】商品を出品するには？」

#### `ai-usage-limit`（41 件 · tasful-ai / ai）
- **代表候補:** `ai-usage-limit` — AI利用上限
- 統合候補: `ai-usage-limit-q2` — 「AIの上限に達したを教えてください」
- 統合候補: `ai-usage-limit-q3` — 「AIの上限に達したについて知りたい」
- 統合候補: `ai-usage-limit-q4` — 「【初心者】AIの上限に達した」

#### `material-search`（41 件 · material / material）
- **代表候補:** `material-search` — Material検索
- 統合候補: `material-search-q2` — 「素材を探すを教えてください」
- 統合候補: `material-search-q3` — 「素材を探すについて知りたい」
- 統合候補: `material-search-q4` — 「【初心者】素材を探す」

#### `refund-policy`（41 件 · platform / pricing）
- **代表候補:** `refund-policy` — 返金・払い戻し
- 統合候補: `refund-policy-q2` — 「返金してもらえるを教えてください」
- 統合候補: `refund-policy-q3` — 「返金してもらえるについて知りたい」
- 統合候補: `refund-policy-q4` — 「【初心者】返金してもらえる？」

#### `talk-read-receipt`（41 件 · talk / talk）
- **代表候補:** `talk-read-receipt` — 既読・未読
- 統合候補: `talk-read-receipt-q2` — 「既読を教えてください」
- 統合候補: `talk-read-receipt-q3` — 「既読について知りたい」
- 統合候補: `talk-read-receipt-q4` — 「【初心者】既読」

#### `ai-search`（40 件 · platform / search）
- **代表候補:** `ai-search` — AI検索の使い方
- 統合候補: `ai-search-q2` — 「AIで探すにはを教えてください」
- 統合候補: `ai-search-q3` — 「AIで探すにはについて知りたい」
- 統合候補: `ai-search-q4` — 「【初心者】AIで探すには？」

#### `tlv-stream`（40 件 · tlv / tlv）
- **代表候補:** `tlv-stream` — ライブ配信
- 統合候補: `tlv-stream-q2` — 「配信を始めるにはを教えてください」
- 統合候補: `tlv-stream-q3` — 「配信を始めるにはについて知りたい」
- 統合候補: `tlv-stream-q4` — 「【初心者】配信を始めるには？」

#### `talk-enterprise`（40 件 · talk / talk）
- **代表候補:** `talk-enterprise` — 法人向けTalk
- 統合候補: `talk-enterprise-q2` — 「法人でTalkを使うを教えてください」
- 統合候補: `talk-enterprise-q3` — 「法人でTalkを使うについて知りたい」
- 統合候補: `talk-enterprise-q4` — 「【初心者】法人でTalkを使う」

#### `dashboard-use`（40 件 · platform / platform）
- **代表候補:** `dashboard-use` — ダッシュボードの見方
- 統合候補: `dashboard-use-q2` — 「ダッシュボードとはを教えてください」
- 統合候補: `dashboard-use-q3` — 「ダッシュボードとはについて知りたい」
- 統合候補: `dashboard-use-q4` — 「【初心者】ダッシュボードとは」

---

## 3. 削除してよい候補ルール（提案）

- 同一 topicKey の -q2 以降で、canonical（topicKey または -q1）が存在し本文が同一テンプレのもの
- 質問が QA_QUESTION_REPHRASES 由来（【初心者】【法人】【詳しく】English: 〜を教えてください 等）で独自 steps がないもの
- persona-variant（-beginner / -business 等）で canonical と summary/steps が同一のもの
- generic-text + default-bullets-only の両方を満たすもの
- category=other かつ カスタム steps なし かつ 重複グループ所属
- タイトルが「元タイトル（質問抜粋）」形式の question-variant

### 削除候補サンプル（スコア ≥7）

| slug | service | score | 主な理由 |
|------|---------|-------|----------|
| `language-locale-q5` | platform | 16 | generic-text, default-bullets-only, no-cta |
| `ai-search-mode-q5` | tasful-ai | 15 | generic-text, default-bullets-only, no-cta |
| `tlv-monetization-q21` | tlv | 15 | generic-text, default-bullets-only, no-cta |
| `platform-safety-q5` | platform | 15 | generic-text, default-bullets-only, no-cta |
| `ai-web-search-q7` | tasful-ai | 15 | generic-text, default-bullets-only, no-cta |
| `profile-edit-q24` | platform | 14 | generic-text, default-bullets-only, no-cta |
| `talk-room-q24` | talk | 14 | generic-text, default-bullets-only, no-cta |
| `ai-error-q10` | tasful-ai | 14 | generic-text, default-bullets-only, no-cta |
| `platform-safety-q22` | platform | 12 | generic-text, default-bullets-only, no-cta |
| `talk-anpi-beginner` | talk | 11 | generic-text, default-bullets-only, no-cta |
| `billing-history-q28` | platform | 10 | generic-text, default-bullets-only, no-cta |
| `terms-of-service-q10` | platform | 9 | generic-text, default-bullets-only, no-cta |

---

## 4. 残すべき候補ルール（提案）

- SEED 相当（signup, pricing, faq, account-delete 等）
- category ∈ legal, pricing, security, trouble
- カスタム steps が 2 段階以上ある記事
- CTA が実導線（/signup.html, /ai-workspace.html 等）に接続されている記事
- TASFUL AI / TLV / Talk / Material の入口・料金・障害・規約系
- canonical slug（-q なし）でサービス固有の notice/cta がある記事

### 優先保持サンプル

| slug | category | service | score | steps |
|------|----------|---------|-------|-------|
| `data-export` | security | platform | 18 | なし |
| `password-reset` | account | platform | 17 | あり |
| `beginner` | account | platform | 16 | あり |
| `search-no-results` | search | platform | 14 | なし |
| `privacy-policy` | legal | platform | 8 | なし |
| `billing-history` | pricing | platform | 8 | なし |
| `commission-fee` | pricing | platform | 8 | なし |
| `minor-usage` | legal | platform | 8 | なし |
| `anpi-platform` | trouble | platform | 8 | なし |
| `gdpr-export` | legal | platform | 8 | なし |
| `login` | account | platform | 7 | あり |
| `ai-pro-plan` | ai | tasful-ai | 6 | なし |

---

## 5. 統合ルール（提案）

- 同一 service + 同一 topicKey の複数 slug → canonical 1 本に統合し、質問バリエーションは keywords/aliases へ移す
- 同一 title（正規化後）の完全一致グループ → 最も steps が充実した 1 本を残す
- persona-variant は本文差分がなければ canonical に persona タグを付与して統合

---

## 6. 運用フロー（提案）

- 削除前に canonical 選定（steps 数 · CTA · related 数でスコアリング）
- legal/pricing/security は削除せず hold → 人手 adopt
- 統合時は keywords.generated.js の aliases に質問文を退避
- 削除は archive → 30日後 delete の二段階（curation UI 既存フロー）

---

## 7. 目標件数（提案）


| シナリオ | 目標件数 | 説明 |
|----------|----------|------|
| **積極整理** | **約 853 件** | q変種・ペルソナ変種・汎用文のみを大幅削減 |
| **標準整理（推奨）** | **約 967 件** | トピックあたり1〜2本 + 法務/料金/障害は維持 |
| **保守整理** | **約 1538 件** | 明確な重複・低品質のみ削除、検索網羅性を残す |

**推奨:** **標準整理 約 970 件**（現状の約 22%）

内訳イメージ:
- トピック代表（canonical）: 約 118 件
- 法務/料金/セキュリティ/トラブル: 優先維持（約 852 件から精査）
- サービス入口（AI/TLV/Talk/Material）: 各トピック 1〜2 本
- 削除候補（スコア≥7）: 約 4207 件を第一段階で archive 検討

---

## 8. 結論

現状 4394 件は **カタログ生成器の網羅性優先**（`QA_QUESTION_REPHRASES` · persona 変種 · `-qN` 量産）による膨張が主因。
109 トピック × 平均約 40 変種（質問言い換え 5 種 × ペルソナ 7〜8 種）が構造。カスタム steps を持つ記事は **48 件（1.1%）** のみ。
実際のユーザー導線・AI SSOT として価値が高いのは **canonical 118 本 + SEED + 法務/料金/障害** の数百件。

**次のステップ（削除前）:**
1. curation UI で `duplicates` / `low-quality` タブを人手サンプル確認（各 50 件）
2. 本レポートの削除ルールを `PlatformQaCuration` の自動タグ付けに反映（実装は別タスク）
3. archive → 8788 検索/AI ヒット確認 → 本削除

※ 本レポートはデータ変更なし。