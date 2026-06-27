# TASFUL 決定事項（Architecture Decisions）

**最終更新:** 2026-06-27（AD-013 Business Directory サブスク掲載モデル）  
**形式:** 決定 ID · 日付 · 状態 · 内容 · 根拠

---

## AD-001 — AI サーフェス分離

| 項目 | 内容 |
| --- | --- |
| **決定** | Builder AI · TASFUL AI · AI 秘書 · Platform/TLV 入口は **別 UI · 別 surface · 別データ境界** |
| **日付** | 2026-06-26（AI フェーズ） |
| **根拠** | `reports/builder-ai-architecture.md`, 回帰テスト isolation チェック |

---

## AD-002 — Builder AI は TASFUL AI と統合しない

| 項目 | 内容 |
| --- | --- |
| **決定** | Builder AI は **案件コンテキスト**（Project / Thread / Partner）専用。TASFUL AI Workspace へ統合しない |
| **Gateway** | `surface=builder_ai`。`ai-workspace` surface とは混在しない |
| **根拠** | `reports/builder-ai-p1-review.md` isolation · `5ed9672` テスト PASS |

---

## AD-003 — Platform 専用 AI エンジンを作らない

| 項目 | 内容 |
| --- | --- |
| **決定** | Platform は deterministic assist（検索/比較/バッジ）+ **TASFUL AI Workspace への遷移**（`source=platform`）のみ |
| **禁止** | Platform 専用 LLM ループ · Platform 専用 Gateway surface の新設 |
| **根拠** | `reports/platform-finish-phase.md`, `reports/platform-next-phase.md` |

---

## AD-004 — TLV 専用 AI を作らない

| 項目 | 内容 |
| --- | --- |
| **決定** | TLV は `live/tlv-tasful-ai-entry.js` → `ai-workspace.html?source=tlv` の **導線のみ** |
| **テンプレ** | `ai-workspace-tlv-source.js`（8 テンプレ · 無料枠 UI） |
| **根拠** | `reports/tlv-tasful-ai-entry.md` · 16/16 PASS |

---

## AD-005 — Gateway / AI Core 契約（凍結）

| 項目 | 内容 |
| --- | --- |
| **決定** | AI フェーズ（Final / Platform Finish / Builder P2）では **`ai-model-gateway.js` 契約を変更しない** |
| **例外** | working tree に未コミット diff あり → 別判断（[KNOWN_ISSUES.md](./KNOWN_ISSUES.md) KI-001） |
| **根拠** | 各フェーズレポート「Gateway untouched」 |

---

## AD-006 — AI 出力は下書き · 非確定

| 項目 | 内容 |
| --- | --- |
| **決定** | 全 AI サーフェス共通: 契約 · 請求 · 採用 · 完了承認 · 返金等の **自動確定禁止** |
| **表示** | `common-ai-disclaimer.js` · `ai-terms.html` · Builder guidelines |
| **根拠** | `reports/ai-terms-disclaimer.md` · 32/32 PASS |

---

## AD-007 — 選別コミット（`git add -A` 禁止）

| 項目 | 内容 |
| --- | --- |
| **決定** | 混在 working tree（622+ 件）では **`git add -A` 一括コミット禁止**。領域別選別のみ |
| **実施** | AI 186 件 → `5ed9672` |
| **根拠** | `reports/ai-selected-staging-plan.md`, `reports/pre-commit-final-check.md` |

---

## AD-008 — Production Ready 宣言（製品）

| 項目 | 内容 |
| --- | --- |
| **決定** | 以下は **Production Ready / RELEASE FROZEN**（Critical · Security · 仕様追従のみ変更可） |
| **対象** | Builder v1.0 · Platform · TLV v1.0 · AI 秘書 v1.1 |
| **注** | TASFUL AI Workspace は **機能完成 ≠ Production Ready**（本番接続タスク残） |

---

## AD-009 — dist ビルドフロー

| 項目 | 内容 |
| --- | --- |
| **決定** | 静的配信は `npm run build:pages` → `deploy/cloudflare/dist` を正とする |
| **コミット** | ソース + dist ミラーをセット（AI コミット `5ed9672` 参照） |

---

## AD-010 — AI 秘書の本番 API は DeepSeek

| 項目 | 内容 |
| --- | --- |
| **決定** | AI 運営秘書の本番 LLM は **DeepSeek API** を使用する |
| **日付** | 2026-06-26 |
| **理由** | 運営データ要約 · 優先順位付け · DB 結果整理 · 問い合わせ/通知/チケットの自然文要約 · API コスト削減 |
| **データフロー** | DB/Supabase → プログラムで必要データ取得 → DeepSeek → 要約/優先付け/自然文 → 管理者画面 |
| **AI 禁止領域** | 画面遷移 · 件数表示 · DB 検索 · フィルター — **プログラム処理のみ** |
| **他製品** | TASFUL AI · Builder AI は **OpenAI**（秘書とプロバイダを共有しない） |
| **Gateway** | **`TasuAiModelGateway` に DeepSeek ルートを追加しない** — 秘書専用 Adapter + Cloudflare Pages Function |
| **Secret** | **`DEEPSEEK_API_KEY`** — 本番 **Cloudflare Pages / Workers Secret** · ローカル **`.env`**（Supabase Secret は使わない） |
| **見送り** | Groq · Cerebras · Claude — 現時点では不要 |
| **根拠** | [AI/SECRETARY_AI.md](./AI/SECRETARY_AI.md) |

---

## AD-011 — サービス展開方針（国内完成 · 海外の扱い）

| 項目 | 内容 |
| --- | --- |
| **決定** | 製品ごとの **国内完成優先** と **海外対応の範囲** を以下に固定する |
| **日付** | 2026-06（確定） |
| **状態** | **確定** |

### Builder

- **日本国内向け**サービスとして **完成を優先**する。
- **建設業務・案件管理専用**（AD-002 と整合）。
- **海外展開は現時点では対象外**。

### Platform

- **日本国内向け**を基本とする。
- 海外発送 · 多通貨 · 多言語は **将来検討**。
- 利益 · 法務 · 運営体制が整ってから判断する。
- **現時点では海外前提の設計・実装を行わない**。

### TLV

- **日本発**サービスとして開発する。
- 将来的に **海外ユーザーも登録・利用可能な設計**とする。
- 多言語 · 翻訳 · 字幕は **将来追加**。

### TASFUL AI

- **日本発**サービスとして開発する。
- 将来的に **海外ユーザーも登録・利用可能な設計**とする。
- 多言語 · 音声 · 専門 AI を **段階的に追加**する。

### 共通

- **日本法人・日本運営**を前提とする。
- **海外ユーザーが利用できる設計**と **本格的な海外展開**は区別して考える。
- 海外現地法人 · 国別運営 · 国別法対応は、十分な利益と法務体制が整ってから検討する。

| **根拠** | [ROADMAP.md](./ROADMAP.md) §サービス展開方針 · [TODO.md](./TODO.md) §方針 |

---

## AD-012 — TASFUL UI / UX Design Principles

| 項目 | 内容 |
| --- | --- |
| **決定** | 全 TASFUL サービス共通の **UI / UX 設計原則** を以下に固定する |
| **日付** | 2026-06（確定） |
| **状態** | **確定** |
| **AD-011 との関係** | **AD-011** = サービス展開方針（国内/海外 · 製品別スコープ）· **AD-012** = UI/UX 設計原則（画面・操作・文言）。役割は重複しない |

### 目的

高機能でありながら、**誰でも直感的に使える**サービスを目指す。

### 基本思想

- **高機能は AI で処理する。**
- **シンプルは UI で実現する。**

### 設計原則

- 高機能とシンプルを **両立**する。
- **小学生でも使い方が分かる**ことを目標とする。
- **一目見て何ができるか**理解できること。
- 迷った場合は **シンプルな操作を優先**する。
- **専門用語より分かりやすい言葉**を優先する。
- AI を活用し、複雑な機能でも **簡単に操作できる**よう設計する。
- 新機能を追加しても、**既存 UI を複雑にしない**こと。

### 適用範囲

- Builder
- Platform
- TLV
- TASFUL AI
- AI 秘書
- 今後追加されるすべての TASFUL サービス

### 補足

この原則は **UI を単純化することが目的ではない**。

- 必要な機能は **積極的に実装**する。
- **複雑さは AI が吸収**し、ユーザーには **シンプルで直感的な UI** を提供することを目的とする。

| **根拠** | [README.md](./README.md) · 本 AD が正本 |

---

## AD-013 — Business Directory サブスク掲載モデル

| 項目 | 内容 |
| --- | --- |
| **決定** | **店舗・販売** と **業務サービス** は **月額サブスク掲載モデル** を主軸とする |
| **日付** | 2026-06-27 |
| **状態** | **確定（方針）** — 決済・DB 実装は未着手 |

### 収益モデル分離

| 領域 | 主軸 | 備考 |
| --- | --- | --- |
| **店舗・販売** | 月額サブスク掲載料 | 専用掲載ページ · metadata 掲載 |
| **業務サービス** | 月額サブスク掲載料 | 同上 |
| **Marketplace（商品マーケット）** | **成約手数料** | **既存方針を維持** — 変更しない |
| **Platform / 案件・仕事** | **成約手数料** | **既存方針を維持** — 変更しない |
| **広告枠** | スポンサー掲載 · 上位表示 · PR 枠 | 将来オプション |

### 掲載方針

- **既存ホームページがある事業者** → **URL 登録のみ** で送客可能（TASFUL 内ページは任意）。
- **ホームページがない事業者** → **TASFUL 専用掲載ページ** を簡易ホームページとして利用可能。

### 成約手数料（店舗・販売 / 業務サービス）

- **初期フェーズ**では成約手数料を **主軸にしない**。
- **将来オプション:** TASFUL 内で予約 · 見積 · チャット · 決済を利用する事業者のみ **月額 + 成果報酬** に拡張可能（Premium / Future プラン）。

### UI / IA

市場トップ構造（目的別分離 · 検索結果は混在させない）:

```text
TASFUL市場
├ 商品マーケット   … 商品を買いたい
├ 店舗・販売       … 会社・店舗を探したい
├ 業務サービス     … 依頼先を探したい
└ 案件・仕事       … 仕事・人材を探したい
```

### 適用外（本 AD で変更しない）

- Marketplace Checkout · Connect · 成約手数料フロー（`sales-fees` · `platform-chat-fee-pay` 等）
- Builder AI · TASFUL AI · AI 秘書
- Stripe Connect / 決済実装

| **根拠** | [business-directory-subscription-model.md](./business-directory-subscription-model.md) · [business-directory-mvp-design.md](./business-directory-mvp-design.md) · [business-directory-data-model-design.md](./business-directory-data-model-design.md) · [ROADMAP.md](./ROADMAP.md) §Business Directory |

---

## 見送り / 未決定

| ID | 内容 | 記録先 |
| --- | --- | --- |
| UD-001 | `ai-model-gateway.js` +73 行をマージするか | [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) KI-001 |
| UD-002 | Cloudflare Access 下の TASFUL AI 公開方針 | preflight §11 |
| UD-003 | Platform FE 本番昇格タイミング（NB-1M） | `reports/platform-nb1m-frontend-prod-deploy-ready.md` G1/G2 |
