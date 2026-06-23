# TASFUL MATCH — P16 AI Landing Pages 設計

| 項目 | 内容 |
|------|------|
| 版 | v1.0（**計画のみ · 実装未着手**） |
| 作成日 | **2026-06-21** |
| 前提 | P15-L5 dist 同期 **PASS** · **`READY_FOR_P15_RELEASE_CANDIDATE_LOCAL`** |
| 本計画の停止点 | **レポート承認まで** — HTML/CSS/dist 未着手 |
| 本番 URL | **`tasful.jp` 8 月まで保留** |

---

## 1. 確定方針（プロダクト境界）

### 1.1 役割分担

| プロダクト | 役割 | AI の位置 |
|------------|------|-----------|
| **TASFUL MATCH** | 出会う · 探す · マッチする · 話す | **AI 送客導線のみ**（相談・分析・改善は実装しない） |
| **TASFUL AI** | 恋愛/婚活/メッセージ/プロフィール/相性/デート相談 | **処理・プロンプト・課金の集約先** |

TALK / Builder / Marketplace と同思想：**MATCH 内に専用 AI を複数実装しない** · iframe 埋め込み禁止 · 課金は TASFUL AI 側。

### 1.2 P15 との関係

P15 では既存ページに **インライン CTA**（`match-ai-cta.js` + `data-match-ai-cta`）を配線済み。  
P16 は **説明用ランディング 6 ページ**を追加し、ユーザーが「何を TASFUL AI に任せられるか」を理解したうえで CTA 遷移する導線を整える。

| 層 | P15（済） | P16（計画） |
|----|-----------|-------------|
| 機能 UI | お気に入り · 足あと · 相性 % 等 | **変更なし** |
| AI | 各所の 1 行 CTA | **6 専用 LP + CTA** |
| AI 処理 | なし | **なし** |

---

## 2. ページ一覧

| # | ページ名 | ファイル（案） | 公開 URL（dist 配信時） | 対応 TASFUL AI 機能 |
|---|----------|----------------|-------------------------|---------------------|
| 1 | AI 恋愛相談 | `match/match-ai-love-advice.html` | `/match/match-ai-love-advice.html` | 恋愛相談 |
| 2 | AI 婚活相談 | `match/match-ai-marriage-advice.html` | `/match/match-ai-marriage-advice.html` | 婚活相談 |
| 3 | AI プロフィール改善 | `match/match-ai-profile-coach.html` | `/match/match-ai-profile-coach.html` | プロフィール改善 |
| 4 | AI メッセージ相談 | `match/match-ai-message-coach.html` | `/match/match-ai-message-coach.html` | メッセージ相談 |
| 5 | AI 相性分析 | `match/match-ai-compatibility-detail.html` | `/match/match-ai-compatibility-detail.html` | 相性分析（詳細） |
| 6 | AI デート相談 | `match/match-ai-date-coach.html` | `/match/match-ai-date-coach.html` | デート相談 |

**命名規則:** `match-ai-{topic}.html` · `data-page="match-ai-{topic}"` · 既存 `match-favorites.html` 等と同階層。

**含まない:** チャット UI · 診断ウィザード · API fetch · Supabase Edge · 課金 UI。

---

## 3. URL 案

### 3.1 内部リンク（MATCH 内）

| 導線元（既存） | リンク先 LP（P16 後） |
|----------------|----------------------|
| `match-mypage.html` 恋愛/婚活 CTA | `match-ai-love-advice.html` / `match-ai-marriage-advice.html`（任意：LP 経由） |
| `match-safety.html` 恋愛 CTA | `match-ai-love-advice.html` |
| `match-profile-create.html` · 完成度 CTA | `match-ai-profile-coach.html` |
| `match-list.html` · talk-bridge メッセージ/デート | `match-ai-message-coach.html` / `match-ai-date-coach.html` |
| `match-swipe.html` 相性詳細 CTA | `match-ai-compatibility-detail.html` |
| `match-review.html` | P16 セクションに 6 LP リンク |

**方針（2 段階）:**

1. **P16-L1:** LP 単体 + review からのリンクのみ（既存インライン CTA はそのまま TASFUL AI 直行可）
2. **P16-L2（任意）:** マイページ等から **LP 経由**に差し替え（説明を読ませたい導線のみ）

### 3.2 外部遷移（TASFUL AI）

```
../ai-workspace.html?mode={MODE}&q={ENCODED_Q}&returnTo={ENCODED_RETURN_TO}
```

生成: `TasuAiWorkspaceLinks.buildMatchCtaUrl()`（`ai-workspace-links.js` · dist 同期済）

---

## 4. UI 構成（全 6 ページ共通テンプレート）

各 LP は **静的 HTML** · パステル MATCH デザイン（`match.css` トークン流用）· 4 タブナビは **マイページ系と同様**（スワイプ/マッチ/安心/マイページ）。

### 4.1 セクション構成

```
┌─────────────────────────────────────┐
│ Header（戻る · ページタイトル）        │
├─────────────────────────────────────┤
│ Hero タイトル + 1 行リード             │
├─────────────────────────────────────┤
│ 説明（MATCH に AI がない理由を明記）    │
├─────────────────────────────────────┤
│ 利用例（3 件 · 箇条書き or カード）     │
├─────────────────────────────────────┤
│ メリット（3 件 · アイコン + 短文）      │
├─────────────────────────────────────┤
│ 注意（1 行）: 相談は TASFUL AI 側      │
├─────────────────────────────────────┤
│ Primary CTA: 「TASFUL AIで相談する」   │
│ Secondary: 関連 MATCH ページへ戻る     │
├─────────────────────────────────────┤
│ Tabbar（既存 4 タブ）                  │
└─────────────────────────────────────┘
```

### 4.2 `data-*` 契約（LP 用）

| 属性 | 用途 |
|------|------|
| `data-page="match-ai-love-advice"` 等 | ページ識別 · smoke probe |
| `data-match-ai-landing` | LP ルートマーカー |
| `data-match-ai-cta` | CTA リンク（既存 `match-ai-cta.js` 再利用） |
| `data-ai-mode` | TASFUL AI `mode`（下表 P16 正） |
| `data-ai-q-template` | 初期プロンプト（静的 · 変数 `{percent}` 等は LP では固定文可） |
| `data-match-ai-landing-back` | Secondary 戻りリンク（例: マイページ） |

**禁止 DOM:** `iframe` · `[contenteditable]` チャット · `fetch` 先 AI API · 診断フォーム POST。

### 4.3 コピー骨子（ページ別）

| LP | タイトル（案） | 説明（1 文） |
|----|----------------|--------------|
| 恋愛 | 恋愛の悩みを、TASFUL AI に相談 | MATCH は出会いに集中。恋愛の相談は TASFUL AI が担当します。 |
| 婚活 | 婚活のアドバイスは TASFUL AI へ | 婚活の戦略・ペース配分は AI 相談で整理できます。 |
| プロフィール | プロフィール改善を TASFUL AI と | 写真・自己紹介・趣味の見せ方を改善するヒントを得られます。 |
| メッセージ | マッチ相手へのメッセージ相談 | 初回メッセージ・返信の書き方を TASFUL AI に相談。 |
| 相性 | 相性を詳しく分析（TASFUL AI） | スワイプの簡易 % を超えた詳細分析は TASFUL AI 側。 |
| デート | デートのプラン・マナー相談 | 初デートの場所選びやマナーを TASFUL AI に相談。 |

---

## 5. CTA 仕様

### 5.1 ボタン

| 項目 | 値 |
|------|-----|
| ラベル（統一） | **「TASFUL AIで相談する」** |
| 要素 | `<a class="match-btn match-btn--primary match-btn--block match-ai-cta ..." data-match-ai-cta>` |
| `href` | **`#` 禁止（実装時）** — `match-ai-cta.js` が `DOMContentLoaded` で解決 |
| `target` | 同一タブ（`_blank` 不使用） |
| `rel` | `noopener`（スクリプト付与） |

### 5.2 解決フロー

```mermaid
sequenceDiagram
  participant LP as MATCH LP
  participant CTA as match-ai-cta.js
  participant Links as ai-workspace-links.js
  participant AI as ai-workspace.html

  LP->>CTA: DOMContentLoaded
  CTA->>Links: buildMatchCtaUrl({ mode, q, returnTo })
  Links->>AI: GET ../ai-workspace.html?mode=&q=&returnTo=
  Note over LP,AI: MATCH 側 fetch/AI 処理なし
```

### 5.3 Secondary CTA（任意）

| ラベル | 遷移先例 |
|--------|----------|
| マイページに戻る | `match-mypage.html` |
| スワイプに戻る | `match-swipe.html`（相性 LP のみ） |

---

## 6. TASFUL AI `mode` 一覧

### 6.1 P16 正（本設計で採用）

| LP | `mode`（P16 正） | 初期 `q`（案） |
|----|------------------|----------------|
| 恋愛相談 | **`match-love-advice`** | `恋愛の悩みを相談したいです。` |
| 婚活相談 | **`match-marriage-advice`** | `婚活のアドバイスが欲しいです。` |
| プロフィール改善 | **`match-profile-coach`** | `マッチング用プロフィールを改善したいです。` |
| メッセージ相談 | **`match-message-coach`** | `マッチ相手へのメッセージの書き方を相談したいです。` |
| 相性分析 | **`match-compatibility-detail`** | `マッチ相手との相性を詳しく分析してほしいです。` |
| デート相談 | **`match-date-coach`** | `初デートのプランやマナーについて相談したいです。` |

### 6.2 P15 既存 `mode` との対応（移行）

P15 インライン CTA は **別名** を使用中。P16 実装時に **エイリアス統一** を推奨。

| P16 正 | P15 既存（dist 同期済） | 移行方針 |
|--------|-------------------------|----------|
| `match-love-advice` | `match-love-consult` | P16-L2: 既存 HTML の `data-ai-mode` を P16 正に更新 · TASFUL AI 側で alias 受容 |
| `match-marriage-advice` | `match-marriage-consult` | 同上 |
| `match-profile-coach` | `match-profile-coach` | **変更なし** |
| `match-message-coach` | `match-message-coach` | **変更なし** |
| `match-compatibility-detail` | `match-compatibility-deep` | P16-L2 で統一 |
| `match-date-coach` | `match-date-coach` | **変更なし** |

**TASFUL AI チーム TODO（MATCH 外）:** 上記 6 `mode` のプロンプトテンプレ · 課金ゲート · `returnTo` からの復帰 UI。P15 旧名は **deprecated alias** として一定期間受容。

### 6.3 `q` パラメータ

| ルール | 内容 |
|--------|------|
| 必須 | LP の Primary CTA では **必ず `q` を付与** |
| 動的 | 相性 LP のみ query `?target=` / `?percent=` 受取時テンプレ展開（**MATCH 側 AI 計算なし** · URL パラメータをそのまま `q` に反映） |
| 長さ | 500 字以内 · URL encode |

---

## 7. `returnTo` 設計

### 7.1 原則

| 項目 | 方針 |
|------|------|
| 目的 | TASFUL AI 利用後に **元の MATCH ページへ戻れる** breadcrumb |
| 値 | **`location.pathname + location.search`**（クエリ保持） |
| 実装 | 既存 `match-ai-cta.js` · `buildMatchCtaUrl()` デフォルト |
| 形式 | `/match/match-ai-love-advice.html`（先頭 `/` · dist ルート相対） |

### 7.2 例

| ページ | `returnTo` 例 |
|--------|---------------|
| 恋愛 LP | `/match/match-ai-love-advice.html` |
| 相性 LP（スワイプから） | `/match/match-ai-compatibility-detail.html?from=swipe` |

TASFUL AI 側は `returnTo` をデコードし「MATCH に戻る」リンク表示（**TASFUL AI 実装 · P16 MATCH 外**）。

### 7.3 エッジケース

| ケース | 対応 |
|--------|------|
| `file://` 直開き | smoke 対象外 · prod-parity のみ |
| 外部サイトから deep link | `returnTo` は LP パスのみ（フォールバック） |
| 長大 query | `returnTo` 800 字上限 · 超過時 pathname のみ |

---

## 8. 既存ファイルへの影響

### 8.1 新規作成（P16 実装時）

| ファイル | 内容 |
|----------|------|
| `match/match-ai-love-advice.html` | 恋愛 LP |
| `match/match-ai-marriage-advice.html` | 婚活 LP |
| `match/match-ai-profile-coach.html` | プロフィール LP |
| `match/match-ai-message-coach.html` | メッセージ LP |
| `match/match-ai-compatibility-detail.html` | 相性 LP |
| `match/match-ai-date-coach.html` | デート LP |
| `match/match-ai-landing.css`（任意） | LP 専用差分 · 基本は `match.css` 拡張で可 |
| `scripts/smoke-match-p16-ai-landing.mjs` | LP smoke |
| `reports/tasful-match-p16-ai-landing-implement-result.md` | 実装後レポート |

### 8.2 変更（最小）

| ファイル | 変更 |
|----------|------|
| `match/match.css` | `.match-ai-landing-*` ブロック追加（パステル） |
| `match/match-review.html` | P16 LP リンク 6 件 |
| `match/match-mypage.html` | 任意：AI 相談メニュー → LP リンク |
| `scripts/smoke-match-p15-l5-dist-sync.mjs` | `MATCH_SYNC_FILES` に 6 LP 追加（P16-L3） |
| `scripts/verify-match-ui-prod-url-review.mjs` | `DIST_SYNC_FILES` 拡張 |
| `deploy/cloudflare/dist/match/*` | **P16-L3** で同期（L1/L2 では触らない） |

### 8.3 触らない

| ファイル | 理由 |
|----------|------|
| `match-api.js` · Edge Functions | AI 処理なし |
| `match-wiring.js` · report/block/verify | L9 固定 |
| `ai-workspace.html` · `ai-workspace-chat.js` | TASFUL AI 側 |
| `match-ai-cta.js` | **原則変更なし**（P16 正 mode は HTML 側 `data-ai-mode` で指定） |

---

## 9. レスポンシブ方針

P15/L5 と同一: **390 / 768 / 1280px** · `match-app--phone` · 横スクロール禁止。

| 幅 | レイアウト |
|----|------------|
| **390px** | 1 カラム · Hero → 説明 → 利用例カード縦積み · CTA full-width · tabbar 固定 |
| **768px** | phone shell 中央 · 利用例 2 列 optional |
| **1280px** | `max-width: 1200px` · メリット 3 列 grid · 本文 `max-width: 640px` 中央 |

**アクセシビリティ:** CTA は `<a>` · 見出し階層 `h1` → `h2` · コントラストは既存 MATCH 準拠。

---

## 10. Smoke 項目

**脚本（計画）:** `scripts/smoke-match-p16-ai-landing.mjs`

| # | チェック | 期待 |
|---|----------|------|
| S1 | 6 LP HTTP 200（`127.0.0.1:8788/match/`） | PASS |
| S2 | 390 / 768 / 1280 · console error 0 | PASS |
| S3 | 横スクロール ≤ 2px | PASS |
| S4 | Primary CTA `href` に `ai-workspace.html` + `mode=` + `returnTo=` | PASS |
| S5 | `iframe` · AI chat widget DOM なし | PASS |
| S6 | `fetch` to AI API なし（network 監視 optional） | PASS |
| S7 | 6 `mode` が P16 正と一致 | PASS |
| S8 | 既存 12 ページ（9+3）回帰 · probe 維持 | PASS |
| S9 | `smoke-match-p15-l5-dist-sync.mjs`（P16-L3 後） | PASS |
| S10 | linked ref Edge P15（`--skip-deploy`） | PASS |

**合格判定（P16 実装後）:** 全 PASS → **`READY_FOR_P16_DIST_SYNC`**（dist 未同期時）→ L3 後 **`READY_FOR_P15_RELEASE_CANDIDATE_LOCAL` 維持 + P16 完了**

---

## 11. 実装順序

| Phase | 内容 | 停止条件 |
|-------|------|----------|
| **P16-L1** | 6 HTML 静的 LP · `match.css` 拡張 · `match-review` リンク · `match-ai-cta.js` 読込 | LP 単体 smoke FAIL で dist 触らない |
| **P16-L2** | 既存 CTA の `data-ai-mode` を P16 正に統一 · マイページ等から LP 導線（任意） | mode 不一致で TASFUL AI 側と調整 |
| **P16-L3** | dist 同期 · `smoke-match-p16` + L5 回帰 · implement レポート | hash drift / console error で停止 |

**並行禁止:** P16-L1 PASS 前に dist 同期しない · TASFUL AI `mode` 未登録でも LP は **`q` 付きリンク** まで実装可（AI 側はフォールバック）。

---

## 12. 非スコープ（再確認）

| 項目 | 提供場所 |
|------|----------|
| AI チャット UI | TASFUL AI |
| プロンプト実行 · 課金 | TASFUL AI |
| MATCH Edge / DB 変更 | なし |
| iframe 埋め込み | **禁止** |
| `tasful.jp` 本番確認 | **8 月まで保留** |

---

## 13. 次ゲート

| 項目 | 状態 |
|------|------|
| P16 設計レポート | **本ファイル** |
| P16 実装 | **未着手** — 別承認 |
| 判定（本計画） | **`READY_FOR_P16_IMPLEMENT`**（承認後） |

---

## 14. 参照

| 文档 | 路径 |
|------|------|
| P15 機能計画（AI 方針） | `reports/tasful-match-p15-feature-plan.md` |
| P15-L4 UI 計画（CTA） | `reports/tasful-match-p15-l4-ui-plan.md` |
| P15-L5 dist 結果 | `reports/tasful-match-p15-l5-dist-sync-result.md` |
| CTA 解決 | `match/match-ai-cta.js` |
| URL ビルダ | `ai-workspace-links.js` |
| デザイントークン | `match/match.css` |
