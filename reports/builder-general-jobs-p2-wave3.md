# Builder General Jobs — P2 Wave 3 報告

**日付:** 2026-07-05  
**フェーズ:** P2 Wave 3（P2-01〜P2-04）  
**判定:** **Go**

---

## 概要

一般案件のパートナー体験と案件管理導線を整備。Migration / Seed / Edge Functions / `commitBoardApplicationDecision` は未変更。P0-06・P1 Wave 1・P1 Wave 2 回帰はすべて維持。

---

## 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `builder/builder-general-jobs-dual-write.js` | `withdrawWithMirror` · 再応募時 `withdrawn_board_applications` クリア |
| `builder/builder-board-applications-hydrate.js` | hydrate 結果から取り下げ overlay を除外 |
| `builder/builder-search-ui-adapter.js` | `filterFromBoardQuery` 追加 |
| `builder/builder.js` | 取り下げ・応募中一覧・検索フィルター・編集非表示 |
| `builder/board-projects.html` | 応募中ショートカット · 検索フォーム |
| `builder/board-project-detail.html` | 取り下げボタン · 編集リンク削除 |
| `scripts/test-builder-general-jobs-p2-wave3-smoke.mjs` | 新規 smoke + 回帰 |
| `deploy/cloudflare/dist/builder/*` | `npm run build:pages` 同期 |

---

## 実装内容

### P2-02 パートナー応募取り下げ

- `boardWithdrawApplication` / `withdrawWithMirror` を追加。
- 取り下げ可能条件: `status === "applied"` かつ未選定（`selected` / `rejected` / `completed` / `invoiced` 不可）。
- MVP: `applications` から除去し `withdrawn_board_applications` に記録。
- hydrate: Supabase 読み込み時も overlay で取り下げ分を除外（UI 整合）。
- 再応募時は withdrawn 記録を自動クリア。
- 導線: 一覧カード `data-builder-board-withdraw` · 詳細 `data-builder-board-pd-withdraw`（confirm 付き）。
- **制約（既知）:** Staging RLS 上、応募者は Supabase row の UPDATE/DELETE 不可。DB 行は `applied` のまま残る可能性あり（MVP overlay でパートナー UI は整合）。Migration 禁止のため P2+ で RLS 拡張が必要。

### P2-03 パートナー応募中一覧

- `board-projects.html?view=my-applications` で応募中（`applied`）のみ表示。
- パートナー向けショートカット「応募中の案件」を `board-projects` メニューに追加。
- 一覧タイトルを「応募中の案件」に切替。

### P2-01 案件編集

- 調査: `mvp-project-new.html?project_id=` は submit 時に常に新規 `uid("proj")` を発行し編集未実装。
- **商用前対応:** `board-project-detail.html` から「案件を編集」リンクを削除（非表示）。

### P2-04 board 一覧検索/フィルター（最小）

- `board-projects.html` に検索フォーム追加:
  - キーワード
  - エリア（東京 / 神奈川 / 千葉 / 埼玉）
  - 工種（自由入力）
  - ステータス（募集中 / 応募あり / 選定済み）
- `matchesBoardListSearchFilter` + `TasuBuilderSearchRepository.filterSourceRows` の二段フィルター。
- リセットボタン付き。

---

## 検証結果

| コマンド | 結果 |
| --- | --- |
| `node scripts/test-builder-general-jobs-p2-wave3-smoke.mjs` | **20/20 Go** |
| P0-06 回帰（smoke 内） | PASS |
| P1 Wave 1 回帰（smoke 内） | PASS |
| P0-04 talk-room 回帰（smoke 内） | PASS |
| P0-05 notification UUID 回帰（smoke 内） | PASS |

**8788 確認**

| 項目 | 結果 |
| --- | --- |
| HTTP Status | 200（board-projects / my-applications / detail） |
| Console Error | 0 |
| Viewport | smoke は 1280（手動 390/768 は P2-05 残課題） |

**維持確認**

- `selected` → Talk Room UUID · `chat-detail.html?thread={UUID}` — P1 回帰 PASS
- `rejected` → Talk Room なし — P1 回帰 PASS
- `commitBoardApplicationDecision` 未変更
- local fallback 維持

---

## Go / No-Go

**Go** — P2 Wave 3 スコープ完了。商用パートナー導線の最小要件を満たす。

---

## 残課題

| ID | 内容 | 優先 |
| --- | --- | --- |
| P2-DB-withdraw | Supabase 応募取り下げの RLS / status 拡張（Migration 要） | P3 |
| P2-01-edit | 案件編集の `project_id` プリロード + update path | P3 |
| P2-05 | 390 / 768 レスポンシブ QA | P2 次 |
| P2-owner-withdraw-ghost | オーナー画面に Supabase 上の取り下げ前応募が残る場合の表示整理 | P3 |
| P3+ | 本番 SQL · billing · Production Ready 判定 | 別フェーズ |

---

## 参照

- `reports/builder-general-jobs-p2-wave3/result.json` — 自動検証ログ
- `reports/builder-general-jobs-p1-wave2.md` — 直前フェーズ
- `docs/TODO.md` — 次タスク正本
