# TODO Release Readiness Audit

**日付:** 2026-06-28  
**対象:** [docs/TODO.md](../docs/TODO.md) 全体棚卸し  
**種別:** 整理のみ（実装 · migration · UI · Payment · Gateway **変更なし**）

---

## 1. 実施内容

| # | 作業 |
| --- | --- |
| 1 | `docs/TODO.md` 先頭に **Release Readiness** セクション追加 |
| 2 | Release P0 / P1 / Later / Future / Done / Deprecated 分類 |
| 3 | 各項目に サービス · 優先度 · 状態 · ブロッカー · 次アクション |
| 4 | 重複・旧ラベル・方針ズレを **Deprecated 候補** に分離 |
| 5 | Legacy セクションは履歴として残置（削除しない） |

**参照 docs（最小）:** ROADMAP · BUILDER_AI · BUILDER_MONETIZATION · BUILDER_PROVIDER_LISTING · BUILDER_CREDITS · BUILDER_AI_CONDITIONAL_SEARCH

---

## 2. Release P0 サマリー（4 件）

| ID | サービス | ブロッカー要約 | 次アクション |
| --- | --- | --- | --- |
| REL-P0-01 | Repo/Docs | docs 設計正本未コミット | 選別ステージング |
| REL-P0-02 | TLV Payment | 運用 6 件 No-Go | Runbook Step 1–10 |
| REL-P0-03 | AI 秘書 | prod Secret · 残高 · smoke | deploy + 1 往復 |
| REL-P0-04 | Pages | 未 deploy 資産 | build:pages → alias smoke |

**本番公開不能の直接原因:** REL-P0-02（TLV Payment Go 時）· REL-P0-03（秘書本番時）· REL-P0-04（静的配信更新時）· REL-P0-01（正本ドrift）

---

## 3. Release P1 サマリー（8 件）

| ID | サービス | 要点 |
| --- | --- | --- |
| REL-P1-01 | TASFUL AI | 動画/音楽 API 任意 |
| REL-P1-02 | Platform | featured · favorites · OAuth |
| REL-P1-03 | Builder AI | P2-C **staging のみ** |
| REL-P1-04 | Builder 検索 | P2 LLM · UI |
| REL-P1-05 | Contact Reveal | M0–M3（公開範囲次第） |
| REL-P1-06 | Provider Listing | L1–L3 Free/Boost |
| REL-P1-07 | Business Directory | 本番運用 |
| REL-P1-08 | Builder git | 6-H コミット · push |

---

## 4. Later / Future 境界

| 分類 | 例 |
| --- | --- |
| **Later** | Gemini Live 4-B · P2-C 本番 · Site Assistant P2+ · TLV DEV 候補 |
| **Future** | Live Vision 実装 · TLV/Creator 数値 · Membership · Builder Credits · AI Membership 実装 · Enterprise Sponsored |

**判断:** Builder v1.0 **RELEASE FROZEN** → 本番改修は P1 staging または Later。Credits / Enterprise / Advanced Sponsored は **Future 固定**。

---

## 5. Done（代表 · 完了済みを P0 から除外）

- TASFUL AI Workspace 本番接続（課金 P1/P2 · Search · deploy）
- TLV Payment Engine **Development Complete**
- Business Directory Phase 1–7 · Production Step 4 Go
- Builder AI Phase 3–6（Tools · Vision · Live 4-A · Project 6-A〜H）
- Builder 条件検索 P0/P1
- Builder Monetization / Provider Listing / Credits **設計 Draft**
- AI 秘書 DeepSeek + Orchestrator **実装 commit 済**（deploy のみ P0）
- Live Platform Vision **6 設計書 + AD-014**

---

## 6. Deprecated 候補（統合済み）

| 項目 | 理由 | 移行先 |
| --- | --- | --- |
| 旧 §1「440 件未コミット」 | 数値・HEAD 矛盾 | REL-P0-01 |
| AI Membership の旧 **P0** ラベル | Draft · 実装 Future | REL-F-04 |
| Live Vision 設計の **P0** ラベル | Release P0 と混同 | Done + REL-F-01 |
| `Creator Economy - Numeric Design` 全節 | Creator Economy v1 と重複 | REL-F-02 · Deprecated バナー |
| Builder P2-C を Release P0 扱い | FROZEN · staging のみ | REL-P1-03 |

---

## 7. Builder 課金・掲載 — Release 分類

| 機能 | 分類 | 根拠 |
| --- | --- | --- |
| 条件検索 Repository | **Done** | P1 実装済 · 検索無料 |
| 条件検索 P2 LLM | **P1/Later** | Pro · 未接続 |
| Contact Reveal | **P1**（Reveal 公開時 **P0**） | 設計 Draft · 都度課金 |
| Provider Free Listing | **P1** | 掲載無料 |
| Provider Boost | **P1** | 月額 · sponsored 明示 |
| Sponsored TOP / Enterprise | **Future** | 設計 Draft |
| Builder Credits | **Future** | BC-0 のみ Done |

---

## 8. 重複 TODO 統合方針

| 重複 | 統合 |
| --- | --- |
| Creator Economy v1 vs Numeric Design | 正本 v1 · Numeric = Deprecated |
| TLV Payment Release Ops（Legacy 内 checklist） | Release Readiness REL-P0-02 に集約 |
| Builder Backlog（Monetization / Listing / Credits） | Legacy 末尾維持 · 分類は Release Readiness 早見表 |
| AI 秘書 deploy 残 | REL-P0-03 + Legacy P0-3 両方（内容同一 · Legacy は詳細） |

---

## 9. 変更ファイル

| ファイル | 変更 |
| --- | --- |
| `docs/TODO.md` | Release Readiness 追加 · Legacy ラベル修正 · Deprecated バナー |
| `reports/todo-release-readiness-audit.md` | 本レポート |

**未変更:** コード · DB · UI · Payment · Gateway · dist

---

## 10. 推奨次ステップ（運用）

1. **REL-P0-01** — 設計 docs（Builder 課金/掲載/Credits/本 audit）を選別コミット
2. **REL-P0-02** — TLV Payment Runbook 人手ゲート（Dashboard · Go Approval）
3. **REL-P0-04** — 公開範囲に応じ `build:pages` + smoke
4. 公開後 **REL-P1-05/06** — Contact Reveal / Provider Listing の実装順を Product 判断

---

*Audit only · 2026-06-28*
