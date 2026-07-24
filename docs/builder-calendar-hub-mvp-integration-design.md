# CAL-MAIN-05：Hub Calendar / MVP Talk 運用 統合方針レポート

**作成日:** 2026-07-04  
**種別:** 調査・設計のみ（実装禁止）  
**前提:** CAL-MAIN-01〜04 完了（Talk Room 正本化 · 作成時 ensure · Talk イベント · Realtime）

> **注:** 本ファイルは **設計時点**の文書である。本文の履歴的記述（「次実装」等）は書き換えない。  
> **現在の完了状態**は [builder-calendar-hub-primary-completion.md](./builder-calendar-hub-primary-completion.md)（CAL-MAIN-19 · Hub Primary Go）を正とする。

---

## 0. 結論サマリ（先に読む）

| 決定項目 | 提案 |
| --- | --- |
| **正本 DB** | `public.builder_projects`（Hub Calendar 本線） |
| **正本 localStorage（移行中）** | `tasu_builder_project_hub_v1`（ミラー / fallback） |
| **正本画面（案件カレンダー）** | `builder/project-calendar.html` |
| **正本画面（運営手配フロー）** | 当面 `partner-assignment` / `mvp-thread` を維持し、**段階的に Hub 詳細 + Talk に寄せる** |
| **通知の寄せ先** | **Talk 通知タブをユーザー向け正本**。Hub `project.notifications` は案件内タイムライン用に縮小 |
| **Talk Room ID** | Hub の `talk_room_id` / `talk_thread_id`（UUID）を唯一の正本。MVP `main_thread_id` / `thread_id` は移行キー |
| **既存 MVP データ** | 一括削除しない。マッピングテーブル（論理）で ID 対応付け後、読み取りアダプタ経由で段階移行 |
| **次実装** | CAL-MAIN-06 = **ID マッピング層 + 通知ディスパッチの単一入口** | ✅ 実装済 |

**原則:** 系統 A（Hub）を **データ・カレンダー・Talk Room の正本** とし、系統 B（MVP）は **業務フロー UI のレガシーシェル** として残し、徐々に A の API を呼ぶ形に寄せる。逆（MVP を正本）にはしない。

---

## 1. 二系統の現状

### 1.1 系統 A — Hub Calendar 本線

| 項目 | 内容 |
| --- | --- |
| **画面** | `project-calendar.html` · `project-hub.html` · `project-detail.html` |
| **Store** | `builder-project-store.js` |
| **localStorage** | `tasu_builder_project_hub_v1` |
| **DB** | `builder_projects`（Read/Write/Realtime 済み） |
| **Talk** | `talk_room_id`（UUID）· 作成時/開始時 ensure · ステータス/完了 → システムメッセージ |
| **ID 例** | `PRJ-2026-003`（Demo）· UUID（Supabase seed / 新規） |

### 1.2 系統 B — MVP Talk 運用

| 項目 | 内容 |
| --- | --- |
| **画面** | Talk 通知 · `partner-assignment.html` · `mvp-thread.html` · `admin-calendar` · board 系 |
| **Store** | `builder.js` 内 MVP state |
| **localStorage** | `tasful:builder:mvp:v1`（+ role / partner_id / notifications 等） |
| **通知** | `talk-builder-notify-master-v1.js`（`builder-ops-flow-*` 等） |
| **Talk** | `main_thread_id` / `thread_id`（例: `builder_thread_demo_001`）· `builder-talk-bridge.js` → `tasful_chat_threads` |
| **ID 例** | `builder_demo_001` · `demo-project-001` · `thread-demo-001` |

### 1.3 並存の帰結

- **同じ「新宿区 外装改修」でも ID が違う**（Hub: `PRJ-2026-*` / Supabase: `a0000000-…` / MVP: `builder_demo_001`）
- Calendar と Talk 通知から入ると **別オブジェクト** を見る
- CAL-MAIN-01〜04 は系統 A のみ強化済み。系統 B の Review PASS（運営手配デモ）は **別レール**

---

## 2. データ構造比較表

### 2.1 案件（Project）

| 概念 | 系統 A（Hub） | 系統 B（MVP） | 統合時の正本フィールド |
| --- | --- | --- | --- |
| 主キー | `id` | `project_id` | `builder_projects.id`（UUID 推奨） |
| タイトル | `name` | `title` | `title`（DB）/ `name`（UI は mapper） |
| 種別 | `category` · `source` | `kind` · `board_type` · `projectKind` | `kind` + `category` |
| ステータス | `inquiry` / `estimating` / `contracted` / `in_progress` / `completed` | `open` / assignment 系 | **Hub 体系を正** · MVP はマッピング表で変換 |
| 手配状態 | （弱い）`assignedVendor` | `assignment_status` · `selected_partner_ids` · `calendar_assigned_partner_id` | **新規カラム or jsonb `assignment`**（実装は後続） |
| 日程 | `scheduleStartDate` / `scheduleEndDate` / `schedulePhase` | `specs.period.start/end` | Hub 日程フィールド |
| 現場 | `siteAddress` · `managerName` · `managerPhone` | `specs.site_address` 等 | Hub |
| Talk | `talkRoomId` / `talkThreadId`（UUID） | `main_thread_id` · thread 内 `thread_id` | **Hub `talk_room_id`** |
| 完了 | `completion` jsonb | thread siteData / completion UI | Hub `completion_report` |
| 通知 | `notifications[]`（案件内） | MVP notifications + Talk master | 下記 §4 |

### 2.2 ステータス体系マッピング（案）

| MVP / 業務語 | Hub `status` | 備考 |
| --- | --- | --- |
| open / 募集中 | `inquiry` or `estimating` | 掲示板案件 |
| 手配中 / pending | `contracted` | assignment は別フィールド |
| 作業中 | `in_progress` | |
| 完了 | `completed` | completion jsonb と併用 |
| キャンセル | （要追加 or `cancelled`） | Hub にキャンセルが薄い場合は拡張 |

### 2.3 通知体系

| 層 | キー / 場所 | 用途 | ユーザー可視 |
| --- | --- | --- | --- |
| **Talk 通知タブ** | `talk-builder-notify-master-v1` · Talk notify store | 運営↔パートナー行動フロー | ✅ 正本候補 |
| **MVP 通知** | `tasful:builder:mvp:notifications:v1` | Builder 内ベル | 🟡 レガシー |
| **Hub 案件内通知** | `project.notifications` jsonb | 案件タイムライン補助 | 🟡 案件詳細のみ |
| **CAL-MAIN-03** | Talk システムメッセージ | ステータス/完了の room 内記録 | ✅ room 内 |

### 2.4 Talk Room / Message

| | 系統 A | 系統 B |
| --- | --- | --- |
| Room ID | `transaction_rooms.id`（UUID）· `listing_type=builder_calendar` | デモ thread 文字列 · `tasful_chat_threads` |
| 作成 | `ensureTalkRoomForProject` | bridge / MVP スレッド生成 |
| イベント | `builder-project-talk-events.js` → local mirror + best-effort insert | Talk workflow システムメッセージ |

---

## 3. 画面・導線

### 3.1 現状マップ

```text
[User] 一般案件投稿 ──► board / public-board ──► MVP threads
                              │
[User] ワーカー/業者検索 ──► Talk (partner_user / vendor) ──► builder-talk-bridge
                              │
[Ops] Talk通知(builder-ops-flow) ──► partner-assignment ──► mvp-thread
                              │                                    │
                              └────────── ✗ 未接続 ──────────────┘
                                                                  │
[Hub] project-calendar ◄── Talk returnTo ── chat-detail ◄── メッセージ
         │
         └── builder_projects (Supabase)
```

### 3.2 二重表示リスク

| リスク | 発生条件 | 深刻度 |
| --- | --- | --- |
| 同一現場が Calendar と通知で別 ID | Demo シードが別名 | 高（現状発生） |
| Partner が assignment と Calendar で別案件を見る | 導線が分かれている | 高 |
| 完了報告が mvp-thread と Calendar 詳細で二重 | 両方に UI がある | 中 |

### 3.3 正本画面の提案

| 役割 | 正本画面（目標） | 当面のレガシー |
| --- | --- | --- |
| **案件カレンダー（全員）** | `project-calendar.html` | Partner Dashboard 埋め込み cal は表示のみ or リンク |
| **案件詳細・現場アクション** | Calendar 右パネル / Mobile sheet → 必要なら `project-detail.html` | `mvp-project-detail` |
| **運営→パートナー手配** | 将来: Hub 案件 + Talk Room | `partner-assignment.html`（Phase 移行中維持） |
| **スレッド会話** | `chat-detail.html`（`talk_room_id`） | `mvp-thread.html`（リダイレクト継続可） |
| **通知一覧** | Talk 通知タブ | Builder 内ベルは要約リンクのみ |

---

## 4. 通知の寄せ先

### 4.1 推奨

| 種別 | 正本 | 理由 |
| --- | --- | --- |
| **ユーザーが「気づく」通知** | **Talk 通知タブ** | 既に Review PASS · クロスプロダクト共通 UI |
| **Room 内の事実記録** | **Talk システムメッセージ**（CAL-MAIN-03） | 監査・会話文脈 |
| **案件詳細の履歴** | Hub `timeline` / 必要なら `notifications` jsonb | 案件ページ内表示のみ |
| **MVP 通知キー** | 移行完了まで **読み取り専用** | 一括削除禁止 |

### 4.2 既存通知の扱い

1. `builder-ops-flow-*` デモは **動作デモとして維持**（E2E・Review 用）
2. 新規発行する運営通知は **Talk 通知マスタ API（将来単一ディスパッチャ）** 経由のみ
3. Hub `addNotification` は「案件内メモ的通知」に限定し、Push/タブ通知には使わない

---

## 5. 業務フロー別の正本案

### 5.1 一般案件投稿（builder_board）

| 段階 | 現状 | 正本案 |
| --- | --- | --- |
| 投稿 | board / MVP | `builder_projects`（`kind=builder_board`）に作成 |
| 応募 | MVP applications | `builder_project_applications`（B3 Phase 4 系） |
| やりとり | board-thread / Talk | `talk_room_id` → `chat-detail` |
| カレンダー | 非表示 or 別 | 日程があれば **Hub Calendar に自動掲載** |

### 5.2 ワーカー検索からのやりとり

| 段階 | 現状 | 正本案 |
| --- | --- | --- |
| 検索 | find-workers | 維持 |
| Talk | `partner_user` / bridge | `ensureTalkRoom` + `listing_type` を worker 用に分離可 |
| Calendar | 非連動 | **案件化した場合のみ** Hub に `saveProject`（任意） |

※ ワーカー相談は「案件化前」が多い → **無理に Calendar 必須にしない**。案件化した瞬間に系統 A へ載せる。

### 5.3 業者検索からのやりとり

| 段階 | 現状 | 正本案 |
| --- | --- | --- |
| 検索 | partners | 維持 |
| Talk | `vendor_user` / contact reveal | Talk Room 正本 |
| 550 円開示 | `builder-contact-reveal.js`（local） | 決済実装時も **target = talk_room_id or project id** を Hub 側に記録 |

### 5.4 運営からパートナーへの案件手配（最重要・系統 B の中核）

| 段階 | 現状（MVP） | 正本案 |
| --- | --- | --- |
| 案件登録 | Talk 通知 `builder-ops-flow-001` | Ops が Hub で `saveProject`（自動 Room ensure 済み） |
| パートナー通知 | Talk 通知マスタ | Talk 通知（`projectId` = Hub UUID） |
| 受諾 UI | `partner-assignment.html` | **Phase1:** 同 UI が Hub Store を読むアダプタ |
| スレッド | `mvp-thread` | `chat-detail?thread={talk_room_id}` |
| カレンダー | admin/partner cal（MVP） | **Hub `project-calendar`**（Realtime 済み） |
| 入退場 | mvp-thread photos | 将来 `builder_site_attendance` · 当面 thread メタ |

### 5.5 完了報告

| 段階 | 現状 | 正本案 |
| --- | --- | --- |
| 入力 | Calendar 詳細 or mvp-thread | **Calendar / project-detail を正** |
| 保存 | Hub `completion_report` + Talk メッセージ（CAL-MAIN-03） | 維持・強化 |
| 承認/差戻し | MVP 通知フロー | Talk 通知 + Hub status 更新 |

### 5.6 550 円情報開示料

| 項目 | 正本案 |
| --- | --- |
| 対象 | **一般案件・業者/ワーカー連絡先開示**（運営案件は対象外の既存方針を維持） |
| 記録 | `builder_contact_reveals`（将来）/ 当面 local キー |
| Calendar | 直接関係なし。案件に紐づく場合は `project_id` を Hub ID で持つ |

### 5.7 案件完了時 5〜10% 手数料

| 項目 | 正本案 |
| --- | --- |
| トリガ | Hub `status=completed` または completion 承認 |
| 計算 | `finance` / billing policy（既存表示ロジック） |
| 決済 | Stripe（B3 Phase 12）· **Hub project id を invoice キーに** |
| MVP | 表示メモのみの現状を、Hub 完了イベントに接続してから実装 |

---

## 6. 設計決定（必須7項目）

### 6.1 正本 DB / 正本 localStorage

| 優先 | ストア |
| --- | --- |
| 1 | **`builder_projects`（Supabase）** |
| 2 | `tasu_builder_project_hub_v1`（ミラー・fallback） |
| 3 | `tasful:builder:mvp:v1`（レガシー読み取り専用へ段階移行） |

### 6.2 正本画面

- **カレンダー:** `project-calendar.html`
- **会話:** `chat-detail.html`（`talk_room_id`）
- **通知:** Talk 通知タブ
- **手配 UI:** 移行完了まで `partner-assignment` を維持し、裏のデータだけ Hub に切替

### 6.3 通知の寄せ先

- **ユーザー通知 = Talk 通知タブ**
- **Room 内事実 = システムメッセージ（CAL-MAIN-03）**
- Hub jsonb notifications = 案件詳細の補助のみ

### 6.4 Talk Room ID の扱い

- **唯一の正本:** `builder_projects.talk_room_id`（= `talk_thread_id`）
- MVP `main_thread_id` / デモ `builder_thread_demo_001` は **legacy_thread_id** としてマッピング表に保持
- 新規は必ず `ensureTalkRoomForProject`（CAL-MAIN-01/02）

### 6.5 既存 MVP データの扱い

| 方針 | 内容 |
| --- | --- |
| 削除 | **しない**（依頼どおり） |
| 一括変換 | **しない** |
| マッピング | `legacy_project_id` → `hub_project_id` の対応を **アダプタ層** で持つ（最初はコード定数 / JSON、後で DB） |
| デモ E2E | `builder-ops-flow-*` はマッピング経由で Hub 案件を指すよう **後続フェーズで差し替え** |

### 6.6 段階移行プラン

| Phase | 名前 | 内容 | 破壊 |
| --- | --- | --- | --- |
| **M0** | 方針固定 | 本ドキュメント | なし |
| **M1** | マッピング層 | `TasuBuilderProjectIdMap`（legacy ↔ hub）· 通知 href 生成を一箇所に | 低 |
| **M2** | 通知ディスパッチ | 新規通知は Talk タブ + Hub projectId のみ | 低 |
| **M3** | 手配 UI のデータ源切替 | `partner-assignment` が Hub Store / `builder_projects` を読む | 中 |
| **M4** | mvp-thread の薄化 | 常に `chat-detail` へ寄せ（既存リダイレクト強化） | 低 |
| **M5** | MVP write 停止 | MVP state は read-only · 書き込みは Hub のみ | 中 |
| **M6** | レガシー削除候補 | MVP キー削除は Production 安定後 | 高（別承認） |

### 6.7 P0 / P1 / P2

| 優先 | 項目 | CAL ID |
| --- | --- | --- |
| **P0** | ID マッピング層（legacy → hub） | **CAL-MAIN-06** |
| **P0** | 通知 href / projectId の単一生成（Talk 通知が Hub ID を持つ） | CAL-MAIN-06 |
| **P1** | partner-assignment の Hub 読み取りアダプタ | ✅ CAL-MAIN-07 |
| **P1** | 運営案件作成を Hub `saveProject` に統一 | ✅ CAL-MAIN-08 |
| **P1** | assignment フィールドの Hub 表現（jsonb or 列） | 要 schema 議論 · 別承認 |
| **P2** | MVP write 停止 · デモシード統合 | CAL-MAIN-09 設計済 · 実装は CAL-MAIN-10〜 |
| **P2** | 550 円 / 手数料の Hub project 紐付け実装 | Billing フェーズ |
| **P2** | localStorage MVP キー削除 | Production 後 |

---

## 7. 段階移行ロードマップ（図）

```text
M0 方針 ──► M1 ID Map + 通知入口 ──► M2 通知が Hub ID のみ
                      │
                      ▼
              M3 手配 UI → Hub 読取 ──► M4 chat-detail 一本化
                      │
                      ▼
              M5 MVP write 停止 ──► M6 レガシー削除（承認後）
```

**並行して触らないもの:** `builder_projects` DDL/RLS/Write Adapter 契約、Calendar UI、CAL-MAIN-01〜04 の挙動。

---

## 8. CAL-MAIN-06 実装（完了）

**タイトル:** ID マッピング層 + 通知ディスパッチ入口

| 成果物 | 内容 |
| --- | --- |
| `builder/builder-project-id-map.js` | `legacyToHub` / `hubToLegacy` / `talkRoomToHub` / `resolveHubProjectId` / `enrichNotifyPayload` · LS `tasu_builder_project_id_map_v1` |
| `builder/builder-notify-dispatch.js` | `notifyPartnerNewProject` · `enrichMasterRows` · `resolveActionHref` |
| デモマップ | `builder_demo_001` ↔ `PRJ-2026-001`（+ Supabase UUID 別名） |
| 通知 | master 行に `hubProjectId` · `legacyProjectId` · `hubHref`（Calendar）。**legacy `href` / path は変更しない**（既存導線互換） |
| テスト | `scripts/test-builder-calendar-cal-main-06-id-map.mjs`（34 PASS） |

**やらない（維持）:** MVP キー削除、schema 変更、partner-assignment の全面書き換え。

---

## 9. リスクとブロッカー

| # | リスク | 緩和 |
| --- | --- | --- |
| R1 | Demo ID と Supabase UUID の二重シード | M1 マップ · 新規は UUID のみ |
| R2 | Review/E2E が MVP パス依存 | マップで旧 URL を維持しつつ中身を Hub に |
| R3 | assignment が Hub に無い | M3 前にフィールド設計（jsonb 推奨 · schema 変更は別チケット） |
| R4 | 通知マスタがハードコード | ディスパッチ入口で新規のみ制御 |
| R5 | AD-008 UI 凍結 | データ層・導線 URL のみ変更 |

---

## 10. 参照

| 文書 / コード |
| --- |
| [builder-calendar-mainline-plan.md](./builder-calendar-mainline-plan.md) |
| `builder/builder-project-store.js` · `builder-project-talk-room.js` · `builder-project-talk-events.js` |
| `builder/builder.js`（MVP_STORAGE_KEY · DEMO_PROJECTS） |
| `talk-builder-notify-master-v1.js` |
| `builder/builder-talk-bridge.js` |
| `builder/builder-contact-reveal.js` |
| `docs/builder-b3-production-roadmap.md` |

---

## 11. 承認チェックリスト（実装前）

- [x] 正本を Hub（`builder_projects`）とすることで合意
- [x] 通知正本を Talk タブとすることで合意
- [x] partner-assignment を当面残すことで合意
- [x] CAL-MAIN-06（マップ層のみ）の実装着手承認
- [ ] assignment 用 schema 拡張が必要になった時点で別 ADR / Migration チケット化
- [ ] CAL-MAIN-07（partner-assignment Hub 読取）着手承認
