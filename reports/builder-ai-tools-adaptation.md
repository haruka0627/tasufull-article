# Builder AI — 業務ツール統合レポート

実施日: 2026-06-26  
方針: **Builder Admin 新規メニューではなく、Builder 専用 AI 内アクションとして統合**

---

## 1. 目的

Worker検索・業者検索・インボイス/利益/人件費/工期/面積/塗装クロス計算を、建設・業務向け AI 作業補助として Builder AI に組み込みました。

---

## 2. 追加アクション（16件 · 合計24アクション）

| ID | ラベル | 種別 | 説明 |
| --- | --- | --- | --- |
| `worker_search_assist` | Worker検索補助 | search | 条件整理・比較テンプレート |
| `partner_search_assist` | 業者検索補助 | search | 協力会社条件整理 |
| `invoice_tax_calc` | インボイス・税計算 | calc | 税抜/税込/消費税/端数 |
| `estimate_profit_calc` | 見積・利益計算 | calc | 原価/粗利/値引き |
| `labor_cost_calc` | 人件費計算 | calc | 人数×日当×日数+残業+経費 |
| `schedule_calc` | 工期計算 | calc | 稼働日数（土日除外） |
| `area_unit_calc` | 面積・単位変換 | calc | ㎡/坪/畳、長さ単位 |
| `paint_cross_calc` | 塗装・クロス数量 | calc | 面積+ロス率 |
| `sole_prop_tax_assist` | 確定申告整理 | tax_assist | 個人事業主・申告準備整理 |
| `document_text_draft` | 書類送付文面 | practice_assist | 見積/請求/領収/発注/支払案内文 |
| `contract_order_draft` | 契約・発注下書き | practice_assist | 契約前確認・発注書・作業依頼書骨子 |
| `safety_ky_checklist` | 現場KYチェック | practice_assist | 危険予知チェックリスト |
| `material_quantity_calc` | 材料数量概算 | calc | 数量・ロス率・予備・概算材料費 |
| `gantt_schedule_draft` | 工程表整理 | practice_assist | ガント風テキスト表・リスクメモ |
| `before_after_checklist` | 作業前後確認 | practice_assist | 養生・写真・引き渡しチェック |
| `candidate_recommendation` | おすすめ候補 | recommend | Worker/業者の参考ランキング |

---

## 2.3 おすすめ候補（`candidate_recommendation` · 2026-06-26 追記）

**目的:** Worker / 業者・Partner 候補を案件条件に合わせて整理し、おすすめ順で提案（下書き）

**評価条件（deterministic スコア）:**
- 案件カテゴリ · 対応エリア · 保有資格 · 稼働状況 · 希望単価/予算感
- 経験年数 · 過去案件 · 評価/レビュー · NG/注意フラグ · 保険 · インボイス · KYC · 対応規模 · 過去トラブル

**出力:**
- おすすめ候補ランキング · 推薦理由 · 注意点 · 比較表 · 不足情報 · 運営確認項目

**連携:** `worker_search_assist` / `partner_search_assist` と条件抽出（`extractFields`）を共有

**禁止:** 採用確定 · 契約確定 · 業者自動決定 — 最終判断は運営または依頼者

**モジュール:** `builder/builder-ai-candidate-recommend.js` · `fetchCandidates()` は将来 API 接続用（現状サンプルデータ）

---

## 2.2 実務補助アクション（10〜15 · 2026-06-26 追記）

**方針:** Admin メニューではなく Builder AI 内の chip / template のみ。deterministic 優先、LLM は説明・注意点・文面化（`preferRemote: false` 時 Gateway 未呼び出し）。

| ID | 目的 | 注意 |
| --- | --- | --- |
| `document_text_draft` | 見積/請求/領収/発注送付文、支払案内・入金確認・催促文 | 請求・支払確定しない。金額・期限は入力値反映のみ |
| `contract_order_draft` | 契約前確認、発注書、作業依頼書、仕様・キャンセル・追加費用メモ | 契約成立・法的有効性を断定しない。専門家確認を促す |
| `safety_ky_checklist` | 高所・電気・水回り・屋根・外壁・清掃・重量物・足場・火気・近隣 | 安全保証なし。有資格者・現場責任者確認を促す |
| `material_quantity_calc` | 材料数量・ロス率・予備・単価・概算材料費・人工参考 | 概算のみ。現場寸法確認・発注前人間確認必須 |
| `gantt_schedule_draft` | 工事項目・日付・担当・前後関係・予備日・遅延/天候リスク | テキスト表・日付別/担当別工程・遅延対応案 |
| `before_after_checklist` | 作業前/後、養生、写真、近隣、破損、清掃、引き渡し | 完了承認しない。現場責任者・当事者が最終確認 |

**モジュール:** `builder/builder-ai-practice-assist.js`（practice_assist 5件）+ `builder-ai-calculators.js`（`material_quantity_calc`）

---

## 2.1 確定申告補助（`sole_prop_tax_assist`）

**目的:** 個人事業主・一人親方・職人向けの確定申告前整理

**対応内容:**
- 白色/青色申告の違い整理表
- 売上・経費・勘定科目候補
- 領収書/請求書確認リスト
- インボイス登録・消費税課税/免税の確認メモ
- 家事按分メモ
- 外注費/材料費/交通費/通信費/車両費などの整理
- 確定申告前チェックリスト
- 税理士確認項目リスト

**禁止（クライアントブロック）:**
- 税額断定（`tax_amount_assertion`）
- 脱税・架空経費助言（`tax_evasion`）
- 節税断定・脱法助言（`tax_saving_assertion`）

**連携:** `invoice_tax_calc` / `estimate_profit_calc` / `labor_cost_calc` への試算導線を draft 内に記載

**モジュール:** `builder/builder-ai-tax-assist.js`

---

## 3. 実装方針

### 3.1 deterministic 優先（計算系）

- `builder-ai-calculators.js` — 数値計算は LLM 任せにしない
- `preferRemote: false` 時は Gateway **未呼び出し**で計算結果 draft を返却
- `preferRemote: true` 時も **数値は計算結果を固定**し、LLM は説明・注意点のみ

### 3.2 検索・整理補助系

- `builder-ai-search-assist.js` — Worker/Partner 条件整理
- `builder-ai-tax-assist.js` — 確定申告整理（税額断定なし）
- `builder-ai-practice-assist.js` — 書類文面・契約骨子・KY・工程表・作業前後チェック（practice_assist）
- `builder-ai-candidate-recommend.js` — Worker/Partner おすすめ候補ランキング（recommend · サンプルデータ）

### 3.3 UI

- `builder-ai-page.js` — 既存チップ UI に自動表示（`listActions`）
- Admin メニューへの独立追加 **なし**

### 3.4 建設ツール連携

- `builder-ai-tools.js` — `profit-calculator` → `estimate_profit_calc` 等にルーティング更新

---

## 4. 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `builder/builder-ai-actions.js` | 16 action 追加（計24） |
| `builder/builder-ai-calculators.js` | 計算エンジン（材料数量概算含む） |
| `builder/builder-ai-search-assist.js` | 検索補助（`candidate_recommendation` 導線） |
| `builder/builder-ai-tax-assist.js` | **新規** 確定申告整理 |
| `builder/builder-ai-practice-assist.js` | **新規** 実務文面・KY・工程・チェック |
| `builder/builder-ai-candidate-recommend.js` | **新規** おすすめ候補ランキング |
| `builder/builder-ai-core.js` | deterministic assist · forbidden intent · v1.4.0-recommend |
| `builder/builder-ai-tools.js` | ツール→action マップ（recommend/candidate 含む） |
| `builder/builder-ai.html` | script 追加 |
| `builder/builder.css` | チップ領域 scroll（max-height 280px） |
| `scripts/test-builder-ai-tools-adaptation.mjs` | 候補推薦テスト追加 |
| `scripts/test-builder-ai-p1.mjs` | 24 action 対応 |
| `scripts/test-builder-ai-p1-review.mjs` | chip 数 24 |

---

## 5. 出力制約

- すべて `【下書き・確認用】` でラップ
- 採用確定・契約成立・請求確定・完了承認 **不可**（既存 forbidden intent 維持）
- 検索補助: 「**最終選定は運営確認が必要**」を明記
- 確定申告: 「**最終判断は税理士・税務署確認**」「**最新情報確認が必要**」を明記 · 税額/節税/脱税依頼はブロック
- 実務補助: 請求/支払/契約/完了/安全の**確定・保証なし**。材料数量は**概算**。発注・現場確認は**人間必須**
- 候補推薦: **採用/契約/自動決定なし**。NGフラグは**明確に注意**。ランキングは**参考** · 運営/依頼者が最終判断

---

## 6. テスト結果

| コマンド | 結果 |
| --- | --- |
| `npm run build:pages` | **PASS** |
| `test-builder-ai-p1.mjs` | **84/84 PASS** |
| `test-builder-ai-p1-review.mjs` | **135/135 PASS** |
| `test-builder-ai-p2-a.mjs` | **40/40 PASS** |
| `test-builder-ai-p2-b.mjs` | **36/36 PASS** |
| `test-builder-ai-tools-adaptation.mjs` | **85/85 PASS** |
| `test-builder-ai-live-qa.mjs` | **PASS**（24 actions 静的確認） |

---

## 7. 既存サービスへの影響

| サービス | 影響 |
| --- | --- |
| Builder Admin メニュー | **変更なし**（新規メニュー追加なし） |
| TASFUL AI / TLV / Platform / AI秘書 | **なし** |
| Gateway 本体 | **変更なし** |
| construction-tools 個別ページ | **存続**（Builder AI から action ルーティング可能） |

---

## 8. 将来拡張

- Worker/Partner Supabase 検索 API → `builder-ai-search-assist.js` の `apiReady` パス
- 祝日マスタ → `schedule_calc`
- 構造化入力フォーム（action 別パラメータ UI）
