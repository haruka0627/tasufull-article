# HP-MIGRATION-4 — Wix Code Selection Report

**Date:** 2026-06-18  
**Phase:** HP-MIGRATION-4（Wix 追加移植 vs 現状維持の選別）  
**Verdict:** **READY_FOR_FINAL_CONTENT_FILL**

---

## Executive Summary

既存 **16 ページ**（`/company/` 9 · `/iwasho/` 7）を精査した結果、**レイアウト用 Wix 埋め込み HTML/CSS/JS を追加移植すべきページは 0** です。HP-MIGRATION-2/3 で `source/wix/tasful-company-home.embed.html` の本文は `corp-biz-*` + 静的 HTML に変換済みです。

残作業は **文案・法務・フォーム URL・未回収ページの扱い** が中心であり、次フェーズは Wix コード移植ではなく **FINAL CONTENT FILL** です。

| 区分 | 件数 |
|------|------|
| Wix コード追加移植が必要 | **0** |
| 現状ページのまま（軽微修正のみ） | **10** |
| 文案・法務・フォーム URL の充足が必要 | **6** |
| nav 非表示 / 要方針決定 | **1** |

---

## 1. 現在存在するページ一覧

### `/iwasho/`（7 ページ）

| # | Path | Title | Nav | robots |
|---|------|-------|-----|--------|
| 1 | `/iwasho/index.html` | ホーム | 表示 | index |
| 2 | `/iwasho/about.html` | 会社概要 | 表示 | index |
| 3 | `/iwasho/services.html` | サービス | 表示 | index |
| 4 | `/iwasho/partners.html` | パートナー | 表示 | index |
| 5 | `/iwasho/contact.html` | お問い合わせ | 表示 | index |
| 6 | `/iwasho/privacy.html` | プライバシーポリシー | フッター法務のみ | index |
| 7 | `/iwasho/team.html` | チーム | **非表示** | **noindex** |

### `/company/`（9 ページ）

| # | Path | Title | Nav | robots |
|---|------|-------|-----|--------|
| 1 | `/company/index.html` | Corporate TOP | 表示 | index |
| 2 | `/company/services.html` | サービス | 表示 | index |
| 3 | `/company/vision.html` | ビジョン | 表示 | index |
| 4 | `/company/about.html` | 会社概要 | 表示 | index |
| 5 | `/company/faq.html` | FAQ | 表示 | index |
| 6 | `/company/contact.html` | お問い合わせ | 表示 | index |
| 7 | `/company/legal/terms.html` | 利用規約 | フッター法務 | index |
| 8 | `/company/legal/privacy.html` | プライバシーポリシー | フッター法務 | index |
| 9 | `/company/legal/tokushoho.html` | 特定商取引法に基づく表記 | フッター法務 | index |

**合計: 16 ページ**（新規追加なし · 削除なし）

---

## 2. ページ別分類

分類は複数タグ可。Primary = 次アクションの主因。

### IWASHO

| Page | Primary | Tags | 根拠 |
|------|---------|------|------|
| `index.html` | **KEEP_AS_IS** | NEEDS_IMAGE_FILL（任意） | embed の IWASHO ブロックを分割反映済。構造・文案十分 |
| `about.html` | **KEEP_AS_IS** | — | 建設事業カード + dl 完成 |
| `services.html` | **KEEP_AS_IS** | — | 対応工事 6 項目は embed から展開済 |
| `partners.html` | **KEEP_AS_IS** | NEEDS_TEXT_FILL（任意） | 専用 Wix ページ未回収。現文案で暫定可 |
| `contact.html` | **NEEDS_FORM_URL** | — | Wix Forms JS は移植しない方針。外部 URL のみ要設定 |
| `privacy.html` | **NEEDS_LEGAL_TEXT** | NEEDS_TEXT_FILL | 簡易 4 条のみ。Wix/docx 原文なし · 正式版要作成 |
| `team.html` | **HIDE_OR_REMOVE** | NEEDS_WIX_CODE（条件付） | 本文未回収 · placeholder のみ |

### TASFUL `/company/`

| Page | Primary | Tags | 根拠 |
|------|---------|------|------|
| `index.html` | **KEEP_AS_IS** | NEEDS_IMAGE_FILL（任意） | embed 全文相当を corp-biz に変換済 |
| `services.html` | **KEEP_AS_IS** | — | Platform + AI セクション完成 |
| `vision.html` | **KEEP_AS_IS** | — | Hero + 3 軸。index と重複だが独立ページとして成立 |
| `about.html` | **NEEDS_TEXT_FILL** | NEEDS_LEGAL_TEXT | 〇〇株式会社 · 所在地/代表者未記載 |
| `faq.html` | **KEEP_AS_IS** | NEEDS_TEXT_FILL（任意） | 4 問は migration 生成。Wix FAQ 追加有無は人間確認 |
| `contact.html` | **NEEDS_FORM_URL** | — | 仮 CTA · partner ブロックは静的で完結 |
| `legal/terms.html` | **NEEDS_TEXT_FILL** | — | `tasful-terms.md` 全文移植済。法人名 〇〇 のみ差替 |
| `legal/privacy.html` | **NEEDS_LEGAL_TEXT** | NEEDS_TEXT_FILL | 骨子 4 条 · docx 全文未転記 |
| `legal/tokushoho.html` | **NEEDS_LEGAL_TEXT** | NEEDS_TEXT_FILL | 骨子 dl · docx 全文未転記 |

---

## 3. Wix コード追加移植が必要なページ

### 結論: **該当 0 ページ**

| 回収済み Wix 資産 | 扱い | 対象ページ |
|-------------------|------|------------|
| `source/wix/tasful-company-home.embed.html` | **移植完了**（`corp-biz-*` + 静的 HTML） | company/index, services, vision · iwasho/index, about, services |
| 同 embed 内 inline `<style>` | **Drop**（`corp-layout.css` へ移行済） | 全 biz ページ |
| 同 embed 内 `/contact` `/partner` リンク | **Drop**（brand 別 contact + `#partner`） | CTA セクション |
| Wix Forms embed JS | **Drop**（外部 URL へ置換） | contact ×2 |

### 条件付き（資産回収後のみ検討）

| Page | 条件 | 理由 |
|------|------|------|
| `/iwasho/team.html` | Wix に team 専用ページが存在し HTML が回収できた場合 | 現 repo に IWASHO 個別 Wix ページなし。回収後も **Wix JS ではなく HTML 本文の転記** で足りる見込み |

**Wix Forms を iframe/embed でそのまま載せる案は非推奨** — Wix 依存を再導入するため。`NEEDS_FORM_URL` で Google Forms / 既存 Wix フォーム URL へのリンクで足りる。

---

## 4. Wix コード不要（現状ページのまま）なページ

以下 **10 ページ** は構造・レイアウト・主要文案が揃っており、**Wix embed の追加移植なし** で公開候補（法務/フォーム除く）。

| Brand | Page | 備考 |
|-------|------|------|
| IWASHO | `index.html` | 任意: pillar 絵文字 → 画像差替 |
| IWASHO | `about.html` | — |
| IWASHO | `services.html` | — |
| IWASHO | `partners.html` | 任意: Wix 専用文案があれば追記 |
| TASFUL | `index.html` | 任意: `2.png` 等の hero ビジュアル |
| TASFUL | `services.html` | — |
| TASFUL | `vision.html` | — |
| TASFUL | `faq.html` | 任意: FAQ 追補 |
| TASFUL | `legal/terms.html` | 条文本体は完成 · 法人名差替のみ |

---

## 5. nav 非表示ページの扱い

### 対象: `/iwasho/team.html`

| 項目 | 現状 | 推奨 |
|------|------|------|
| ファイル | 存在（削除しない） | **維持** |
| nav / footer リンク | `visible: false`（`scripts/migrate-corp-hp-content.mjs`） | **非表示継続** |
| robots | `noindex, nofollow` | **維持** |
| 公開 | URL 直打ちのみ到達可 | **本番公開前も noindex 継続** |

**方針（HP-MIGRATION-4 決定）:**

1. **短期:** `HIDE_OR_REMOVE` ではなく **「hidden stub」** として保持 — nav 非表示 · noindex · placeholder 1 行
2. **中期:** Wix team ページ原文が回収できれば **NEEDS_TEXT_FILL** で本文差替 · nav 表示は **人間判断**（不要なら非表示のまま）
3. **長期:** ページ追加/削除禁止のため **ファイル削除・404 化は行わず**、noindex 維持を推奨

---

## 6. 公開前に人間確認が必要な項目

| # | 項目 | 影響ページ | 優先度 | ブロッカー |
|---|------|------------|--------|------------|
| H-1 | **正式法人名**（〇〇株式会社 → 実名） | about, terms, privacy, tokushoho | P0 | 法務公開前 |
| H-2 | **代表者・所在地** | about, privacy, tokushoho | P0 | 特商法 |
| H-3 | **外部お問い合わせフォーム URL** | contact ×2, CTA on index/partners | P0 | 問合せ導線 |
| H-4 | **プライバシーポリシー全文**（docx から転記） | privacy ×2 | P0 | 法務 |
| H-5 | **特商法表記全文** | tokushoho | P0 | EC/有料機能 |
| H-6 | **IWASHO privacy** — 個人事業 vs 法人表記 | iwasho/privacy | P1 | 法務 |
| H-7 | **team.html** — 公開するか hidden のままか | team | P1 | 任意 |
| H-8 | **Wix 移行メモ削除**（`corp-legal-meta` の source 表記等） | contact, privacy, terms, about | P1 | 見た目 |
| H-9 | **pillar 絵文字 → 正式アイコン/写真** | index ×2, vision | P2 | ブランド |
| H-10 | **`images/corp/tasful/2.png` の用途** | company/index 等 | P2 | 任意 |
| H-11 | **FAQ 追補** — Wix 側に追加 Q&A があるか | faq | P2 | 任意 |
| H-12 | **パートナー登録** — 別 URL か contact #partner で足りるか | contact, index CTA | P2 | 任意 |

---

## 7. 回収済み / 未回収 Wix 資産マップ

| 資産 | 状態 | 使うページ |
|------|------|------------|
| `source/wix/tasful-company-home.embed.html` | ✅ repo | company/* biz · iwasho/* biz |
| `source/wix/tasful-terms.md` | ✅ repo | legal/terms |
| `source/wix/tasful-images/1.png` | ✅ 使用中（header） | 全 company |
| `source/wix/tasful-images/2.png` | ⚠ 未使用 | 要人間判断 |
| `images/corp/iwasho/logo.jpg` | ✅ 使用中 | 全 iwasho |
| `Downloads/TASFUL_*.docx` | ❌ repo 外 | privacy, tokushoho |
| IWASHO 個別 Wix ページ | ❌ 未回収 | team, privacy 正式版 |
| Wix Forms URL | ❌ 未設定 | contact ×2 |

---

## 8. 次フェーズ作業順（FINAL CONTENT FILL）

1. **H-1〜H-3** — 法人情報 + フォーム URL（人間入力）
2. **H-4〜H-5** — docx から privacy / tokushoho 全文転記（Wix コード不要）
3. **terms / about** — 〇〇置換のみ
4. **H-8** — 移行メモ文言削除
5. **H-9〜H-12** — ブランド polish（任意）

---

## 9. Out of Scope（遵守）

- 新規ページ作成 · ページ追加 — **なし**
- TASFUL プラットフォーム本体 — **未変更**
- Auth / Supabase / Stripe / Builder / Market / Connect — **未変更**

---

## Verdict Rationale

**READY_FOR_FINAL_CONTENT_FILL**

Wix **コード**選別は完了。追加 embed 移植は不要で、残タスクは文案・法務 docx 転記・フォーム URL・法人表記の **コンテンツ充足** に集約される。`NEEDS_HUMAN_DECISION` 相当の項目（H-1〜H-7）はあるが、Wix HTML/JS の有無ではなく **事業者情報と法務原文** の入力待ちであり、**BLOCKED ではない**。

| 判定 | 条件 |
|------|------|
| NEEDS_HUMAN_DECISION | team 公開可否 · FAQ 追補 — 並行確認可（選別を止めない） |
| BLOCKED | 該当なし — docx は repo 外だが Downloads から転記可能 |
