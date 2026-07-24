# Builder Calendar 本実装計画（P5 完了後）

**作成日:** 2026-07-04  
**前提:** Builder Calendar Supabase 基盤（P3〜P5）は **完成済み・凍結**  
**今回:** 調査・設計のみ（Production DB / Migration / RLS / Write Adapter / E2E 変更 **禁止**）

---

## 0. 完了済み基盤（触らない）

| Phase | 内容 | 根拠 |
| --- | --- | --- |
| **P3** | Supabase Read + Demo fallback | `builder-project-calendar-supabase.js` · `hydrateFromSupabase` |
| **P3.5** | Seed | `builder-calendar-p3.5-supabase-schema-plan.md` |
| **P3.6** | Migration | `builder-calendar-p3.6-deployment-steps.md` |
| **P3.7** | Audit | `builder-calendar-p3.7-staging-preflight-audit.md` |
| **P3.8** | Read Verification | `builder-calendar-p3.8-staging-read-verification.md` |
| **P4** | Write Adapter | `builder-project-write-adapter.js` · 二重書き込み |
| **P5** | RLS + Authenticated Write E2E | `builder-calendar-p5-1-rls-design.md` · E2E **25/25 PASS** |

> **注（参照）:** 上表 P3.5〜P5 のファイル名は設計時点の通称である。リポジトリ上の検証成果物は主に `reports/builder-calendar-p3*` / `reports/builder-calendar-p5*` 配下を参照する（例: `reports/builder-calendar-p3.5-supabase-schema-plan/` · `reports/builder-calendar-p3-supabase/` · `reports/builder-calendar-p5-authenticated-write-e2e/`）。docs 直下に同名の単一 `.md` が無い場合がある。存在しないパスへの新規リンクは作らない。

**凍結対象:** `builder_projects` DDL / RLS / Write Adapter / 既存 Calendar E2E。

---

## 1. Builder ⇔ Talk 接続状況レポート

### 1.1 二系統が並存している（最重要）

| 系統 | データ正本 | 主な入口 | Talk との関係 |
| --- | --- | --- | --- |
| **A. Project Hub Calendar**（P1〜P5） | `tasu_builder_project_hub_v1` + `builder_projects` | `builder/project-calendar.html` | P2 で **入口・戻り**のみ接続 |
| **B. MVP Builder / Talk 運用フロー** | `tasful:builder:mvp:v1` | Talk 通知 · `partner-assignment` · `admin-calendar` · `mvp-thread` | 通知・手配・現場フローが **MVP localStorage** 中心 |

本レポートの「Calendar」は主に **系統 A**。系統 B は既存 Talk 運用デモで、Hub Store とは **ID・スキーマ・永続化が未統合**。

### 1.2 フロー別接続状況

| フロー | 状態 | 実装箇所 | 備考 |
| --- | --- | --- | --- |
| **案件作成（Hub）** | 🟡 部分 | `saveProject` → Write Adapter → `builder_projects` | Talk Room **自動作成なし** |
| **案件作成（MVP）** | 🟡 別系統 | `builder.js` MVP projects | Talk 通知マスタと連動するが Hub Calendar と非共有 |
| **Talk Room 紐付け** | 🟡 仮 ID | `talkRoomId` / `talkThreadId` = `builder-cal-{projectId}` | DB カラムあり。**実 `transaction_rooms` UUID ではない** |
| **メッセージボタン → Talk** | ✅ 接続済（P2） | `messageHref` → `mvp-thread.html` → `chat-detail.html` | `projectId` / `returnTo` / `from=builder_calendar` |
| **Talk → Calendar 復元** | ✅ 接続済（P2） | `restoreFromUrl` · `chat-detail` 戻るバー | 同一案件詳細を再表示 |
| **ステータス変更 → Talk** | ❌ 未接続 | Hub: `updateProject` のみ | Talk システムメッセージ・通知なし |
| **ステータス変更 → カレンダー反映** | ✅ 同一 Store | hydrate / listProjects | **同一タブ内**は即時。他端末・他タブは Realtime なし |
| **スケジュール変更 → カレンダー** | ✅ 同一 Store | `updateSchedule` | 同上 |
| **完了報告** | 🟡 部分 | Calendar UI → `updateCompletion` + draft localStorage | Supabase `completion_report` jsonb へは write 可。**Talk 通知なし** |
| **通知（Hub）** | 🟡 内部のみ | `project.notifications` jsonb | Talk 通知タブ（`talk-builder-notify-master`）と **未連携** |
| **通知（Talk MVP）** | 🟡 別系統 | `talk-builder-notify-master-v1.js` | `builder-ops-flow-*` → MVP カレンダー系 URL。Hub `PRJ-2026-*` とは別 |

### 1.3 接続済み（使える）

```text
[Calendar 詳細] --メッセージ--> [mvp-thread] --> [chat-detail]
       ^                                              |
       +------------- returnTo / projectId -----------+
```

- Demo / localStorage / Supabase（認証 write）いずれも **入口 URL 契約は共通**
- `builder-cal-*` ID は Talk Supabase を叩かず Demo 入口表示（Console Error 回避済み）

### 1.4 未接続（本実装で埋める）

1. **実 Talk Room 作成** — `transaction_rooms`（または Builder 専用 threads）と `talk_room_id` の正本同期  
2. **案件作成時の Room 自動発行** — Hub `saveProject` 後に thread 確保  
3. **ステータス / 完了報告の Talk 側イベント** — システムメッセージ or Talk 通知カード  
4. **Talk 通知マスタ ↔ Hub notifications** — 二重マスタ解消  
5. **系統 A と系統 B の ID 統合** — `PRJ-2026-*` vs `builder_demo_001` / MVP `project_id`  
6. **他クライアントへのカレンダー反映** — Realtime または再 hydrate

### 1.5 `builder-talk-bridge.js` の位置づけ

- MVP / 一般フロー向けブリッジ（`tasful_chat_threads` localStorage）
- Calendar P2 は **独自 `messageHref`**（`mvp-thread` + `returnTo`）で、bridge の `chatDetailHref` とは **別経路**
- 本実装では **bridge に寄せるか、Calendar 経路を正式契約にするか** を決める必要あり（推奨: Calendar 契約を正とし、bridge から `returnTo` 互換を追加）

---

## 2. Realtime 導入計画

### 2.1 現状

- Builder Calendar / Project Hub に **Supabase Realtime 購読なし**
- Talk チャット本体は既存 Talk スタック（別系統）
- 変更反映は **同一タブの Store 更新** または **ページ再読込 + hydrate**

### 2.2 対象一覧（要 / 不要）

| 領域 | Realtime | 優先 | 理由 |
| --- | --- | --- | --- |
| **案件更新（title / memo / 担当）** | ✅ 要 | P1 | 複数ロール同時閲覧時のカレンダー・詳細ずれ防止 |
| **ステータス変更** | ✅ 要 | **P0** | 現場・運営の判断が遅れると事故る |
| **スケジュール変更** | ✅ 要 | **P0** | カレンダー表示の正。月セル件数・選択日に直結 |
| **完了報告** | ✅ 要 | P1 | 運営確認・Talk 連携のトリガ |
| **通知（Hub jsonb）** | 🟡 条件付き | P1 | 通知 UI を Calendar に出すなら要。Talk 通知に寄せるなら Talk 側 Realtime |
| **チャット連携（メッセージ本文）** | ❌ Calendar では不要 | — | Talk / `chat-detail` 側の責務。Calendar は room メタと未読バッジ程度 |
| **添付 / 現場写真メタ** | 🟡 低 | P2 | ポーリング or 詳細オープン時再取得で足りる場合が多い |
| **Demo fallback 中** | ❌ 不要 | — | localStorage のみ。Realtime 対象外 |

### 2.3 推奨チャネル設計（実装は次フェーズ）

| Channel | テーブル / イベント | クライアント動作 |
| --- | --- | --- |
| `builder-projects` | `builder_projects` `postgres_changes` UPDATE/INSERT | `hydrateFromSupabase` 差分マージ or 該当 ID 再取得 → `refresh()` |
| （将来）`builder-notifications` | 正規化通知テーブル | 未読バッジ更新 |

**不要なこと:** Calendar が `transaction_messages` を直接購読すること（Talk に任せる）。

### 2.4 Realtime 前の前提（ブロッカー）

| 前提 | 状態 |
| --- | --- |
| Staging `builder_projects` + RLS | ✅ P5 |
| Realtime publication（`supabase_realtime`）にテーブル追加 | ⬜ Production / Staging 要確認 |
| 認証セッション前提の購読 | ✅ Auth write 済み。anon は SELECT 範囲のみ |
| 競合解決（local 編集中に remote 更新） | ⬜ 未設計（楽観的 UI + 最終 hydrate 推奨） |

---

## 3. localStorage 残存一覧（削除しない）

対象スコープ: **Project Hub Calendar 系統**（系統 A）。MVP 全体キーは参考として末尾に記載。

### 3.1 Calendar / Hub 直結

| Key / 箇所 | 用途 | Supabase 化 | 今後 | 当面残す理由 |
| --- | --- | --- | --- | --- |
| `tasu_builder_project_hub_v1` | 案件配列の正本（fallback） | Read/Write 二重化済み | **Production 移行後に縮小** | Demo fallback · オフライン · write 失敗時の安全網 |
| `readAll` / `writeAll` | 上記の I/O | Adapter 経由で DB も更新 | 残す（fallback 層） | P5 設計どおり二重書き込み |
| `ensureSeed` / `seedDemoProjects` | 初回 Demo 3 件 | Seed は Staging にも投入済 | Demo モード時のみ | 未設定・失敗時の画面保証 |
| `listProjectsLocal` | fallback 読み取り | — | 残す | hydrate 失敗時 |
| `tasu_builder_cal_completion_draft_v1` | 完了報告 UI 下書き | ❌ 未統合 | **下書き専用として残す** or `completion_report` に統合検討 | 未送信ドラフト。本番同期前の UX |
| `tasu-supabase-auth`（参照のみ） | Write Adapter が `owner_id` 取得 | Auth セッション | 残す | Supabase Auth 標準 |

### 3.2 Supabase 化済み（local はミラー）

| データ | DB | localStorage |
| --- | --- | --- |
| 案件本体・日程・ステータス | `builder_projects` | ミラー |
| 完了報告（確定保存） | `completion_report` jsonb | ミラー |
| 添付メタ | `attachments` jsonb | ミラー |
| 現場写真メタ | `site_photos` jsonb | ミラー |
| Hub 内通知 | `notifications` jsonb（想定） | ミラー |
| Talk room ID 文字列 | `talk_room_id` / `talk_thread_id` | ミラー |

### 3.3 系統 B（MVP）— Calendar 本線外だが残存

| Key | 用途 | Calendar 本線との関係 |
| --- | --- | --- |
| `tasful:builder:mvp:v1` | MVP 案件・手配 | **未統合** — Talk 通知フローが依存 |
| `tasful:builder:mvp:role` 等 | ロール切替 | Auth 移行後に廃止候補 |
| `tasful_builder_notify_master_v1` / Talk notify | 運営通知カード | Hub notifications と二重 |
| `tasful_chat_threads` | `builder-talk-bridge` | Calendar P2 経路とは別 |

**今回は削除しない。** Production 移行フェーズで系統統合後に段階削除。

---

## 4. Builder 本実装ロードマップ最新版

### 4.1 完了済み

| 領域 | 状態 |
| --- | --- |
| Calendar UI（Cyber · 操作性 Phase2/3） | ✅ 凍結（UI 微調整禁止） |
| P1 案件詳細・現場アクション | ✅ |
| P2 Talk 入口・戻り | ✅ |
| P3〜P5 Supabase 基盤 | ✅ **凍結** |
| Authenticated Write E2E | ✅ 25/25 |

### 4.2 実装中 / 直後（本ドキュメントのスコープ）

| 項目 | 状態 |
| --- | --- |
| Talk 本接続設計 | ✅ 本レポート |
| Realtime 計画 | ✅ 本レポート |
| localStorage 残存棚卸し | ✅ 本レポート |
| 本実装ロードマップ更新 | ✅ 本レポート |

### 4.3 次フェーズ（実装）

| ID | 内容 | 依存 |
| --- | --- | --- |
| **CAL-MAIN-01** | Talk Room 正本化（実 room ID 発行・`talk_room_id` 更新） | ✅ Talk 開始時 ensure |
| **CAL-MAIN-02** | 案件作成 → Room 自動 ensure | ✅ `saveProject` provisional + 非同期昇格 |
| **CAL-MAIN-03** | ステータス / 完了報告 → Talk システムメッセージ | ✅ `builder-project-talk-events.js` |
| **CAL-MAIN-04** | `builder_projects` Realtime → Calendar refresh | ✅ `builder-project-calendar-realtime.js` |
| **CAL-MAIN-05** | Hub / MVP 統合方針 | ✅ [builder-calendar-hub-mvp-integration-design.md](./builder-calendar-hub-mvp-integration-design.md) |
| **CAL-MAIN-06** | ID マッピング層 + 通知ディスパッチ入口 | ✅ `builder-project-id-map.js` · `builder-notify-dispatch.js` |
| **CAL-MAIN-07** | partner-assignment の Hub 読取アダプタ | ✅ `builder-partner-assignment-hub-adapter.js` |
| **CAL-MAIN-08** | 運営案件作成を Hub `saveProject` に寄せる | ✅ `builder-admin-calendar-hub-write.js` |
| **CAL-MAIN-09** | MVP write 停止条件 · Hub 正本化範囲 | ✅ [mvp-write-stop-design](./builder-calendar-mvp-write-stop-design.md) |
| **CAL-MAIN-10** | 受諾/辞退 Hub dual-write（local assignment） | ✅ `writeAssignmentDecision` |
| **CAL-MAIN-11** | 運営作成 Hub-primary | ✅ `createHubPrimaryProject` |
| **CAL-MAIN-12** | assignment jsonb + MVP 通知縮小 | ✅ [assignment-jsonb-design](./builder-calendar-assignment-jsonb-design.md) |
| **CAL-MAIN-13** | assignment Read/Write Adapter 往復 | ✅ `writeAssignment` · hydrate merge |
| **CAL-MAIN-14** | Staging 手動 Migration + partner RPC 設計 | ✅ [runbook](./builder-calendar-assignment-staging-runbook.md) |
| **CAL-MAIN-15** | MVP 通知縮小（calendar_assignment 系） | ✅ Talk 成功時 MVP ベル no-op |
| **CAL-MAIN-16** | assignment jsonb DB 往復 preflight（P5-5 Auth） | ✅ Go |
| **CAL-MAIN-17** | MVP assignment_status write 停止（条件付き） | ✅ DB 成功+hydrate 時 no-op · flag 付き |
| **CAL-MAIN-18** | assignment_status Read 棚卸し · Hub 表示優先 | ✅ 本線 Hub → MVP fallback（削除なし） |
| **CAL-MAIN-19** | Hub Primary 最終監査 · 完了判定 | ✅ **Hub Primary 完了（Go）** |

**CAL-MAIN-19（2026-07-04）:** assignment の Hub Write/Read/Hydrate/Realtime を最終監査し **Hub Primary 完了**。レポート [hub-primary-completion](./builder-calendar-hub-primary-completion.md)。MVP 削除は別フェーズ。

| — | 完了下書きの扱い確定（local 維持 or jsonb） | P2（Hub Primary 外） |

### 4.4 ブロッカー

| # | ブロッカー | 影響 |
| --- | --- | --- |
| B1 | ~~仮 Talk Room ID~~ | ✅ CAL-MAIN-01/02 で解消（既存仮 ID は開始時昇格） |
| B2 | ~~系統 A（Hub）と系統 B（MVP）の二重マスタ~~ | ✅ Hub Primary（CAL-MAIN-10〜19）。MVP は fallback のみ |
| B3 | ~~Realtime 未実装~~ | ✅ CAL-MAIN-04（publication は環境依存） |
| B4 | **Production `builder_projects` 未適用**（Staging のみ想定） | Production 移行タスクが別途必要 |
| B5 | AD-008 Builder v1.0 FROZEN | UI 変更不可。データ接続のみ |

### 4.5 Production 移行時に実施する項目

| # | 項目 | 備考 |
| --- | --- | --- |
| 1 | Staging と同一 Migration / RLS を Production に **手動**適用 | MCP Production 禁止 |
| 2 | Realtime publication に `builder_projects` 追加 | Dashboard / SQL |
| 3 | Seed / 初期データ移行スクリプト dry-run | localStorage → DB |
| 4 | `chat-supabase-config` Production ref 確認 | 手動 |
| 5 | Authenticated Write E2E を Production 相当で再実行 | 既存スクリプト流用 |
| 6 | Demo fallback の本番フラグ方針 | 障害時のみ / 常時ミラー |
| 7 | MVP キー段階廃止計画 | CAL-MAIN-05 後 |

B3 全体ロードマップ（`docs/builder-b3-production-roadmap.md`）の Phase 6（Talk）・Phase 7（完了報告）・Phase 10（通知）・Phase 10-E（Realtime）と対応。

---

## 5. 次フェーズ優先順位（P0 / P1 / P2）

### P0（次に実装すべき）

1. **Talk Room 正本化** — 仮 `builder-cal-*` をやめ、作成時に実 room を発行して `talk_room_id` を保存  
2. **案件作成 → Room 自動紐付け** — Calendar / Hub から作った案件が Talk で開けること  
3. **スケジュール・ステータス変更の他端末反映方針確定** — Realtime（推奨）or 明示リロード UX

### P1

1. **完了報告 → Talk / 運営通知**（システムメッセージ or Talk 通知カード）  
2. **`builder_projects` Realtime 購読** → `refresh()`（競合は最終 hydrate）  
3. **系統 A/B 統合方針のプロダクト決定**（MVP 通知を Hub に寄せるか、bridge を正にするか）  
4. **完了下書き**の仕様固定（local のまま / jsonb draft フラグ）

### P2

1. 添付・写真メタの Realtime（必要なら）  
2. Hub `notifications` と Talk 通知マスタの統合  
3. localStorage ミラー縮小（Production 安定後）  
4. `builder-talk-bridge` と Calendar `messageHref` の API 統一

---

## 6. 実装時の制約（再掲）

| 禁止 | 理由 |
| --- | --- |
| Production Supabase 変更 / Migration / RLS 修正 | 基盤凍結 |
| Write Adapter 改修（本フェーズ） | P5 完了済み |
| 既存 Calendar E2E 破壊的変更 | 回帰維持 |
| Calendar UI デザイン変更 | 凍結 |
| 大規模リファクタ | 依頼範囲外 |

**許可される最小実装の例（次スプリント）:** Talk Room 発行ヘルパの追加、作成フローからの 1 呼び出し、Realtime subscribe の薄いラッパ。基盤ファイルの契約変更は避ける。

---

## 7. 参照

| 文書 |
| --- |
| `builder/builder-calendar-p4-phase4-localStorage-deprecation-report.md` |
| `builder/builder-calendar-p5-1-rls-design.md` |
| `builder/builder-supabase-schema-notes.md` |
| `docs/builder-b3-production-roadmap.md` |
| `scripts/test-builder-calendar-p2-talk.mjs` |
| `scripts/test-builder-calendar-p5-authenticated-write-e2e.mjs` |
