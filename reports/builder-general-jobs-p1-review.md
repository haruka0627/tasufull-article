# Builder General Jobs P1 — UI・業務フロー確認レポート

**実施日:** 2026-07-05  
**Phase:** P1（調査・整理のみ）  
**前提:** P0-01〜P0-06 **すべて Go**（Staging dual-write · Talk UUID · hydrate 検証済み）  
**種別:** 調査レポート — **コード変更なし**

**正本参照:** `docs/builder-general-jobs-repository-plan.md` · `reports/builder-general-jobs-commercial-readiness-report.md` · `reports/builder-general-jobs-p0-*`

---

## 0. エグゼクティブサマリ

| 観点 | 判定 | 補足 |
| --- | --- | --- |
| **エンドユーザー UI** | デモ完成・商用ラベル未整備 | board レールが正本。投稿は「（demo）」表記 |
| **パートナー UI** | 二重導線あり | nav → `mvp-projects`、応募正本 → `board-projects` |
| **運営 UI** | 横断管理は MVP のみ | `admin-applications` は Talk/Supabase 未連動 |
| **データ層（P0 後）** | Staging で dual-write 可 | デフォルトは依然 `localStorage` 正本 |
| **Talk 連携** | board 選定 path は UUID 化済み | admin/mvp 選定 path は未統一 |
| **レスポンシブ** | 詳細のみ mobile dock | 投稿・一覧・768px は未検証/不統一 |
| **商用運用** | **UI は可、運用導線に穴** | 選定 path 分岐・通知二重・辞退なしが詰まりポイント |

**P1 の結論:** 画面単体は動くが、**正本 URL の統一・運営 path の一本化・商用ラベル化** が商用前の最優先。データ層の本番接続は P0 土台の延長（別フェーズ）として切り分ける。

---

## 1. 現状（ロール別）

### 1.1 利用者（依頼者 / `role=user`）

| ステップ | 正本ページ | 現状の挙動 |
| --- | --- | --- |
| 入口 | `user-dashboard.html` | 「案件を依頼」→ `mvp-project-new.html` |
| 案件投稿 | `mvp-project-new.html` | MVP state 保存。Staging flag ON 時は `createProjectWithMirror` → Supabase + MVP。成功後 `board-project-detail.html?id=` へ遷移 |
| 案件一覧 | `board-projects.html` | タイプタブ（案件/ワーカー/すべて）のみ。キーワード検索なし |
| 案件詳細 | `board-project-detail.html` | 仕様表示 + サイドバー応募状況（owner のみ） |
| 応募確認 | `?view=applications&role=owner` | 通知 or カード CTA から応募パネルへフォーカス |
| 選定/却下 | 詳細サイドバー | `commitBoardApplicationDecision` → Supabase sync + Talk ensure + 通知 |
| 通知 | `mvp-notifications.html?role=user` | Builder MVP 通知ストア。Talk notify とは別入口 |
| Talk 遷移 | `chat-detail.html?thread={UUID}` | 選定後: `talk_room_id` 優先。未選定は thread ボタン非表示 |

**データ:** デフォルト `tasful:builder:mvp:v1`。Staging + `TASU_BUILDER_GENERAL_JOBS_REPO` で Supabase primary + MVP mirror。

### 1.2 パートナー（協力会社 / `role=partner`）

| ステップ | ページ | 現状の挙動 |
| --- | --- | --- |
| 入口 | `index.html` | パートナーダッシュボード |
| 案件一覧（nav 正本） | `mvp-projects.html` | サイドバー「案件一覧」がここを指す |
| 案件一覧（board 正本） | `board-projects.html` | 応募 CTA・dual-write が実装されている方 |
| 案件詳細 | `board-project-detail.html` | 応募状況パネルは非表示。ステータス文言のみ |
| 応募 | 一覧/詳細 `[data-builder-board-apply]` | `boardApplyToProject` → `applyWithMirror`（flag ON 時） |
| 応募管理 | **専用画面なし** | 一覧カード状態 + 詳細文言 + 通知で追跡 |
| 選定後 Talk | 詳細 CTA / 通知 | UUID `chat-detail` or MVP `board-thread` ブリッジ |
| 辞退/取り下げ | **未実装** | Hub カレンダー `partner-assignment` のみ別途あり |

### 1.3 運営

| ステップ | ページ | 現状の挙動 |
| --- | --- | --- |
| ダッシュボード | `builder-admin/admin-index.html` | KPI → 応募管理へ |
| 応募一覧 | `admin-applications.html` | MVP state 横断。検索・ステータスフィルターあり |
| 選定/却下 | 同上詳細パネル | `updateAdminApplicationStatus` — **MVP のみ** |
| 案件別管理 | `board-project-detail.html?view=applications` | `commitBoardApplicationDecision` — **商用 path** |
| 手配（別系統） | `admin-dispatch.html` | `assignedPartners` — 応募選定とは独立 |
| Talk 生成 | board owner path のみ | admin 選定では `ensureBoardMatchThread` / `syncTalkRoomAfterSelection` **未実行** |
| 通知 | admin: `admin-applications` href | board: Talk Platform + MVP notify（UUID href） |
| 完了まで | Talk 内完了報告フロー | `submitThreadCompletionReport` → `approveThreadCompletionReport`（board path 経由時のみ保証） |

**運営の実質正本:** 商用整合性は **`board-project-detail` + `commitBoardApplicationDecision`**。`admin-applications` はデモ横断 UI として残存。

### 1.4 UI 全体

| 項目 | 現状 |
| --- | --- |
| 導線 | USER: board レール / PARTNER: mvp + board 混在 |
| ボタン配置 | 詳細: サイドバー CTA 群（応募・Talk・やり取り一覧・編集）。モバイル: ≤480px の固定 apply dock |
| ラベル | 「投稿（demo）」「トークへ」「チャットで相談する」「TASFUL TALK」が混在 |
| レスポンシブ | `board-project-detail` は `tasful-app-mobile*.css` 適用。`mvp-project-new` は未適用 |
| 44px タップ | `builder.css` 全体で多くのボタンに `min-height: 44px`。apply dock は 48px（≤480px のみ） |
| 表示崩れ | P0 E2E / UI review で **Console Error 0**（1280 · Talk 中心）。board 投稿/一覧/詳細の 768/390 未カバー |
| スクリーンショット証跡 | `reports/ui-review/builder-general/` — 8 step · 1280 のみ · Talk 完了フロー中心 |

### 1.5 業務フロー（エンドツーエンド）

```text
[依頼者]
user-dashboard → mvp-project-new → board-project-detail
  → 応募待ち → (?view=applications) 選定/却下
  → Talk (UUID) → 完了報告 → 承認

[パートナー]
index / board-projects → board-project-detail → 応募
  → 選定通知 → chat-detail → 作業 → 完了報告提出

[運営 — 推奨 path]
board-project-detail?view=applications → commitBoardApplicationDecision
  → syncTalkRoomAfterSelection → Platform notify

[運営 — 現状の穴 path]
admin-applications → updateAdminApplicationStatus
  → MVP 更新のみ（Talk 未開通 · Supabase 未同期）
```

**P0 完了後の改善点:** board path は Staging で Supabase + UUID Talk が動作。ただし **デフォルト環境・運営 admin path・パートナー nav** は旧挙動のまま。

---

## 2. 問題点（カテゴリ別）

### 2.1 導線・正本 URL

| ID | 問題 | 商用リスク |
| --- | --- | --- |
| F-01 | USER と PARTNER で一覧/詳細 URL が二重（`board-*` vs `mvp-*`） | 応募が dual-write を通らない path がある |
| F-02 | 投稿キャンセル → `mvp-projects.html`（パートナー向け） | 依頼者が迷子 |
| F-03 | 詳細ブランドリンク → `index.html`（パートナー） | 依頼者の戻り先が不自然 |
| F-04 | 通知入口が Builder MVP と Talk notify で二重 | 未読見落とし |
| F-05 | `board-threads.html` は Talk home へ即リダイレクト | 「やり取り一覧」ラベルと実態不一致 |

### 2.2 業務フロー・二重操作

| ID | 問題 | 商用リスク |
| --- | --- | --- |
| B-01 | 選定/却下が **3 path**（board / admin / mvp-project-detail） | 運営が admin で操作すると Talk が開かない |
| B-02 | `admin-applications.html` に dual-write / hydrate 未ロード | Staging データと画面が乖離 |
| B-03 | パートナー応募辞退・取り下げなし | 誤応募後にリカバリ不能 |
| B-04 | 「案件を編集」→ `mvp-project-new?project_id=` だが submit は常に新規 ID | 編集不能・ユーザー不信 |
| B-05 | `admin-dispatch`（手配）と応募選定が別概念だが運営が混同しやすい | オペレーションミス |
| B-06 | デモ `?from=notify` で `setRole("owner")` 強制 | 本番 Auth と不整合 |

### 2.3 UI / UX

| ID | 問題 | 商用リスク |
| --- | --- | --- |
| U-01 | 投稿ボタン「投稿（demo）」+ owner ロール gate alert | 本番感がない |
| U-02 | 投稿フォームに `source`・`kind`・連絡ポリシー等の内部項目が露出 | 一般ユーザーには難解 |
| U-03 | Talk CTA 文言不統一（トークへ / チャット / TASFUL TALK） | 操作意図が伝わりにくい |
| U-04 | パートナー向け「応募中案件」一覧なし | 応募後の追跡が煩雑 |
| U-05 | apply dock は ≤480px のみ。481〜768px はサイドバー CTA が fold 下 | タブレットで応募しづらい |
| U-06 | `mvp-project-new` に mobile shell なし | 390 で投稿 UX 未検証 |
| U-07 | board 一覧にキーワード/エリア/予算フィルターなし | 案件増加時に探索困難 |
| U-08 | UI review が Talk 1280 のみ。board 画面 768/390 未証跡 | リリース前の視覚リスク |

### 2.4 データ・権限（UI 影響のみ — 実装は別フェーズ）

| ID | 問題 | 備考 |
| --- | --- | --- |
| D-01 | デフォルト `localStorage` 正本 | マルチデバイス不可（P0 は Staging flag 時のみ） |
| D-02 | 運営横断 RLS 未設計 | admin UI は認証ユーザー視点のみ |
| D-03 | `builder-board-adapter` / `builder-partner-adapter` は stub | UI から adapter 経由の統一 API が未完了 |

---

## 3. 改善案

### 3.1 導線統一（F 系）

| 改善案 | 内容 |
| --- | --- |
| **正本 URL 一本化** | 一般案件は `board-projects` → `board-project-detail` → `mvp-project-new`（投稿のみ）を全ロール共通正本にする |
| **nav 修正** | `PARTNER_NAV.projects` を `board-projects.html` に変更。`mvp-projects` はダッシュボード要約 or リダイレクト |
| **戻りリンク修正** | 投稿キャンセル・詳細ブランドを `user-dashboard` / `board-projects` / `index` をロールに応じて出し分け |
| **通知統合案** | ダッシュボード + board 一覧に Builder 未読バッジ。Talk notify との役割をヘルプ1行で明示 |
| **やり取り一覧** | `board-threads` リンクを Talk chat タブ直リンクに改名、または Builder スレッド一覧を復活 |

### 3.2 業務フロー一本化（B 系）

| 改善案 | 内容 |
| --- | --- |
| **選定 API 統一** | `updateAdminApplicationStatus` / mvp-project インライン選定を廃止し、すべて `commitBoardApplicationDecision` に委譲 |
| **admin ページ接続** | `admin-applications.html` に dual-write + hydrate + talk-room スクリプトを board 詳細と同順でロード |
| **応募取り下げ** | `boardWithdrawApplication(partner)` — status `withdrawn` または DELETE（RLS 別途） |
| **編集** | `project_id` クエリでフォーム preload + update path、または編集ボタンを feature flag で非表示 |
| **運営ガイド** | admin-index に「選定は案件詳細から実施（Talk 開通保証）」の運用注記 |

### 3.3 UI 商用化（U 系）

| 改善案 | 内容 |
| --- | --- |
| **ラベル** | 「投稿（demo）」→「案件を投稿する」。ロール KPI をユーザー向けステータスに |
| **フォーム簡素化** | 一般ユーザー投稿で `source`/`kind` を hidden + デフォルト `builder_board` / `public_user` |
| **Talk CTA** | 統一文案「TASFUL Talk で相談」+ `resolveBoardChatHref` 一本 |
| **パートナー応募一覧** | `board-projects` に「応募済み」フィルター or `?filter=my-applications` |
| **レスポンシブ** | 投稿に mobile shell。apply dock を 768 まで拡張 or sticky CTA |
| **検索** | `builder-search-ui-adapter.js` を board 一覧に接続（キーワード・エリア） |
| **QA 証跡** | board 投稿/一覧/詳細を 1280/768/390 で Playwright キャプチャ追加 |

---

## 4. 改善項目一覧（優先度付き）

| ID | 項目 | 現状 | 問題 | 改善案 | 優先度 | 影響ファイル |
| --- | --- | --- | --- | --- | --- | --- |
| P1-01 | 選定/却下 path 一本化 | 3 path 併存 | admin 選定で Talk 未開通 | 全入口を `commitBoardApplicationDecision` に統一 | **P1** | `builder.js`, `admin-applications.html`, `mvp-project-detail.html` |
| P1-02 | admin 応募管理の Supabase/Talk 接続 | MVP のみ | Staging データ乖離 | dual-write + hydrate + talk-room スクリプト追加 | **P1** | `admin-applications.html`, `builder-general-jobs-dual-write.js`, `builder-board-applications-hydrate.js` |
| P1-03 | パートナー nav → board 一覧 | `mvp-projects` | 応募が正本外 path | `PARTNER_NAV` を `board-projects.html` に | **P1** | `builder-nav-config.js`, `index.html` |
| P1-04 | 戻り導線修正 | cancel/brand 不一致 | 依頼者迷子 | ロール別戻り先を `user-dashboard` / `board-projects` に | **P1** | `mvp-project-new.html`, `board-project-detail.html`, `builder.js` |
| P1-05 | 商用ラベル化 | 「投稿（demo）」 | 本番感なし | CTA 文言・ロール表示の商用化 | **P1** | `mvp-project-new.html`, `builder.js`, `board-projects.html` |
| P1-06 | 投稿フォーム簡素化 | 内部項目露出 | ユーザー混乱 | hidden デフォルト + 必須項目のみ表示 | **P1** | `mvp-project-new.html`, `builder.js` |
| P1-07 | Talk CTA 文言統一 | 4種類混在 | 操作不明 | 単一文案 + `resolveBoardChatHref` | **P1** | `board-project-detail.html`, `builder.js`, `board-projects.html` |
| P1-08 | 通知入口整理 | MVP + Talk 二重 | 見落とし | バッジ統合 + 役割説明 | **P1** | `user-dashboard.html`, `board-projects.html`, `mvp-notifications.html` |
| P2-01 | 案件編集 or 非表示 | 編集リンクあり・未実装 | 不信 | update path 実装 or ボタン非表示 | **P2** | `mvp-project-new.html`, `builder.js` |
| P2-02 | パートナー応募取り下げ | なし | 誤応募リカバリ不可 | `boardWithdrawApplication` + UI | **P2** | `builder.js`, `board-project-detail.html`, RLS（別フェーズ） |
| P2-03 | パートナー応募中一覧 | なし | 追跡困難 | my-applications フィルター | **P2** | `board-projects.html`, `builder.js`, `builder-board-feed.js` |
| P2-04 | board 一覧検索/フィルター | タブのみ | 探索困難 | search adapter 接続 | **P2** | `board-projects.html`, `builder-search-ui-adapter.js` |
| P2-05 | レスポンシブ QA | Talk 1280 のみ | 390/768 未証跡 | Playwright キャプチャ拡張 | **P2** | `scripts/capture-*.mjs`, `reports/ui-review/builder-general/` |
| P2-06 | apply dock 768 対応 | ≤480px のみ | タブレット UX | sticky CTA 拡張 | **P2** | `builder.css`, `board-project-detail.html` |
| P2-07 | 投稿画面 mobile shell | 未適用 | 390 投稿未検証 | `tasful-app-mobile*.css` 適用 | **P2** | `mvp-project-new.html` |
| P2-08 | adapter 実装 | stub | API 分散 | `applyToProject` / `commitBoardMutation` 実装 | **P2** | `builder-board-adapter.js`, `builder-partner-adapter.js` |
| P2-09 | やり取り一覧ラベル修正 | redirect のみ | 誤解 | Talk 直リンクに改名 | **P2** | `board-project-detail.html`, `board-threads.html` |
| P2-10 | 運営オペガイド | なし | admin/dispatch 混同 | admin-index 注記 + 運用 doc | **P2** | `builder-admin/admin-index.html`, `docs/` |
| P3-01 | `mvp-projects` 役割縮小 | 並存 | メンテ負荷 | ダッシュボード要約化 or 301 | **P3** | `mvp-projects.html`, `builder.js` |
| P3-02 | `mvp-project-detail` 廃止方向 | 並存 | 二重メンテ | board 詳細へ統合リダイレクト | **P3** | `mvp-project-detail.html`, `builder.js` |
| P3-03 | demo role 強制除去 | `?from=notify` hack | 本番 Auth 不整合 | `builder-actor-identity.js` 一本化 | **P3** | `builder.js`, `builder-actor-identity.js` |
| P3-04 | 本番 repo flag デフォルト ON | Staging のみ | マルチデバイス不可 | 本番接続フェーズ（P0 延長） | **P3** | `builder-config.js`, `builder-general-jobs-staging-flags.js` |
| P3-05 | 運営横断 RLS | owner/applicant のみ | 運営 DB 操作不可 | service role / ops policy（別フェーズ） | **P3** | `supabase/`（**本タスク範囲外**） |

---

## 5. 推奨実装順

商用運用で **詰まりを防ぐ順** に並べる。DB/本番接続は UI 導線整理の後でもよいが、**選定 path 統一は最優先**（Talk 未開通は致命）。

### Wave 1 — 業務正本の固定（P1 · 推定 1〜2 スプリント）

1. **P1-01** 選定/却下を `commitBoardApplicationDecision` に一本化（admin + mvp-project 委譲）
2. **P1-02** `admin-applications.html` に P0 スクリプトスタック追加
3. **P1-03** パートナー nav を `board-projects` に
4. **P1-04** 戻り導線（cancel / brand / breadcrumb）修正

**完了条件:** 運営が admin から選定しても Talk UUID + Platform notify が発火。パートナーは nav から応募して dual-write 通過。

### Wave 2 — 商用 UI ラベル・フォーム（P1 · 推定 1 スプリント）

5. **P1-05** 「投稿（demo）」等の商用ラベル化
6. **P1-06** 投稿フォーム簡素化（内部項目 hidden）
7. **P1-07** Talk CTA 文言統一
8. **P1-08** 通知入口・バッジ整理

**完了条件:** 新規ユーザーがデモ用語なしで投稿〜応募〜選定〜Talk まで進める。8788 で 1280/768/390 · Console Error 0。

### Wave 3 — パートナー体験・編集（P2 · 推定 1〜2 スプリント）

9. **P2-02** 応募取り下げ
10. **P2-03** 応募中案件フィルター
11. **P2-01** 案件編集 or 非表示
12. **P2-04** 一覧検索/フィルター

### Wave 4 — レスポンシブ・品質（P2 · 推定 1 スプリント）

13. **P2-05** board 画面 Playwright QA（1280/768/390）
14. **P2-06** apply dock / sticky CTA 768 対応
15. **P2-07** 投稿 mobile shell
16. **P2-09** やり取り一覧ラベル修正

### Wave 5 — 構造整理・本番接続（P2〜P3 · 別フェーズ）

17. **P2-08** board/partner adapter 実装
18. **P2-10** 運営オペガイド
19. **P3-01〜03** legacy ページ縮小・Auth 一本化
20. **P3-04〜05** 本番 repo デフォルト · 運営 RLS（インフラ連携）

---

## 6. 影響ファイル（実装時マスター）

### HTML

| ファイル | 主な改善 ID |
| --- | --- |
| `builder/user-dashboard.html` | P1-08 |
| `builder/mvp-project-new.html` | P1-04, P1-05, P1-06, P2-01, P2-07 |
| `builder/board-projects.html` | P1-07, P1-08, P2-03, P2-04 |
| `builder/board-project-detail.html` | P1-04, P1-07, P2-02, P2-06, P2-09 |
| `builder/mvp-project-detail.html` | P1-01, P3-02 |
| `builder/mvp-projects.html` | P1-03, P3-01 |
| `builder/admin-applications.html` | P1-01, P1-02 |
| `builder/mvp-notifications.html` | P1-08 |
| `builder/board-threads.html` | P2-09 |
| `builder-admin/admin-index.html` | P2-10 |

### JavaScript

| ファイル | 主な改善 ID |
| --- | --- |
| `builder/builder.js` | P1-01, P1-04, P1-05, P1-06, P1-07, P2-01, P2-02, P2-03 |
| `builder/builder-nav-config.js` | P1-03 |
| `builder/builder-board-feed.js` | P2-03, P2-04 |
| `builder/builder-general-jobs-dual-write.js` | P1-02（ロード順） |
| `builder/builder-board-applications-hydrate.js` | P1-02 |
| `builder/builder-project-talk-room.js` | P1-01, P1-02 |
| `builder/builder-board-adapter.js` | P2-08 |
| `builder/builder-partner-adapter.js` | P2-08 |
| `builder/builder-search-ui-adapter.js` | P2-04 |

### CSS / テスト

| ファイル | 主な改善 ID |
| --- | --- |
| `builder/builder.css` | P2-06 |
| `scripts/test-builder-general-jobs-p0-*.mjs` | 回帰（各 Wave 後） |
| `scripts/capture-*.mjs` | P2-05 |

### 参照のみ（本 P1 では変更しない）

- `supabase/migrations/*`, `supabase/manual/*` — P3-05
- `deploy/cloudflare/functions/*` — 対象外
- `chat-detail.html`, `talk-home.html` — Talk 側は Builder href 統一のみ

---

## 7. 検証観点（実装フェーズ用チェックリスト）

各 Wave 完了時に以下を 8788 で確認する。

| # | 確認項目 | 期待 |
| --- | --- | --- |
| 1 | 依頼者: 投稿 → 一覧 → 詳細 → 応募確認 | デモ用語なし・戻り導線正しい |
| 2 | パートナー: nav 一覧 → 応募 → ステータス | dual-write 通過（Staging） |
| 3 | 運営: admin 選定 | Talk UUID 生成 · Platform notify |
| 4 | 通知 → `?view=applications` | 応募パネルフォーカス |
| 5 | selected → `chat-detail.html?thread={UUID}` | rejected は Talk なし |
| 6 | hydrate `source=supabase` | MVP fallback 維持 |
| 7 | Viewport 1280 / 768 / 390 | 表示崩れなし · Console Error 0 |
| 8 | 主要 CTA | min-height ≥ 44px |

**既存 PASS を維持:** `node scripts/test-builder-general-jobs-p0-01-repository.mjs` 〜 `p0-06` · CAL-MAIN-15 回帰。

---

## 8. 関連レポート

| レポート | 内容 |
| --- | --- |
| `reports/builder-general-jobs-commercial-readiness-report.md` | P0 前の全体ギャップ（データ層中心） |
| `reports/builder-general-jobs-p0-01` 〜 `p0-06` | Repository · dual-write · Talk UUID 証跡 |
| `reports/ui-review/builder-general/report.json` | Talk 完了フロー UI review（1280） |
| `docs/builder-general-jobs-repository-plan.md` | DB/RLS 設計正本 |

---

*本レポートは P1 調査のみ。実装・DB 変更は別タスクで着手する。*
