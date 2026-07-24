# Builder B3：Data Layer 本番化ロードマップ

**作成日:** 2026-07-04  
**最終更新:** 2026-07-04（Builder Calendar P3〜P5 完了を反映）  
**Git HEAD:** `d0ed090`（初版調査時点）  
**目的:** Builder を localStorage / DEMO から Supabase ベースの商用版へ移行する実装順序の確定  
**参照:** Business Directory 実装（Edge Function + Repository パターン）  
**制約（初版）:** 調査・設計・ロードマップのみ

### 追記: Builder Calendar（Project Hub）進捗（2026-07-04）

| 項目 | 状態 |
| --- | --- |
| Calendar UI / P1 詳細 / P2 Talk 入口・戻り | ✅ |
| P3 Read · P3.5 Seed · P3.6 Migration · P3.7 Audit · P3.8 Read Verify | ✅ |
| P4 Write Adapter · localStorage 二重書き込み | ✅ |
| P5 RLS · Authenticated Write E2E（25/25） | ✅ **基盤凍結** |
| **次:** Talk Room 正本化 · Realtime · Hub/MVP 系統統合 | 📋 [builder-calendar-mainline-plan.md](./builder-calendar-mainline-plan.md) |

本ファイルの Phase 4（案件）・Phase 6（Talk）・Phase 7（完了報告）・Phase 10（通知 / Realtime）は、Calendar 本線では上記計画の **CAL-MAIN-*** として先行実装する。基盤（DDL/RLS/Write Adapter）は再変更しない。

---

## 1. 現状サマリー

Builder v1.0 は **Production Ready · RELEASE FROZEN**（AD-008）。  
全データは **localStorage + ハードコードされた DEMO 定数** で動作している。  
B3 計画のスタブ（`builder-repository.js`, `builder-repositories-local.js`, `builder-repositories-supabase.js`, `builder-b3-init.js`, `builder-config.js`, `builder-data-provider.js`）はファイルとして存在するが、すべて空実装。

**スキーマ設計ノート** は `builder/builder-supabase-schema-notes.md` に 11 テーブル + RLS 方針 + Storage 方針 + Edge Function 設計案が記載済み。  
**実行前チェックリスト** は `builder/builder-supabase-execution-checklist.md` に記載済み。  
**SQL / Migration / Edge Function は未実行。**

---

## 2. ① localStorage 使用箇所一覧

| キー | ファイル | 画面/用途 |
| --- | --- | --- |
| `tasful:builder:mvp:v1` | `builder.js` | MVP 全体状態（projects, partners, threads, specs 等） |
| `tasful:builder:mvp:threads:v1` | `builder.js` | スレッド分離保存 |
| `tasful:builder:mvp:role` | `builder.js`, `builder-actor-identity.js`, `builder-ai-context.js` | 現在のロール（owner/partner/user/vendor） |
| `tasful:builder:mvp:session:role` | `builder.js`, `builder-ai-context.js` | セッションロール |
| `tasful:builder:mvp:partner_id` | `builder.js`, `builder-actor-identity.js`, `builder-ai-context.js` | 現在のパートナー ID |
| `tasful:builder:mvp:notifications:v1` | `builder.js` | 通知一覧 |
| `tasful:builder:mvp:projectTemplates:v1` | `builder.js` | 案件テンプレート |
| `tasful:builder:mvp:reRequests:v1` | `builder.js` | 再依頼一覧 |
| `tasful:builder:admin:partners:v1` | `builder.js`, `builder-partner-evaluation-store.js` | 管理画面パートナー一覧 |
| `tasful:builder:admin:dispatchCandidates:v1` | `builder.js` | 派遣候補 |
| `tasful:builder:admin:calendarAssignments:v1` | `builder.js` | カレンダーアサイン |
| `tasful:builder:admin:notifications:v1` | `builder.js` | 管理画面通知 |
| `tasful:builder:admin:evaluations:v1` | `builder-partner-evaluation-store.js` | パートナー評価 |
| `tasful:builder:admin:evaluation-events:v1` | `builder-partner-evaluation-store.js` | 評価イベント |
| `tasful:builder:admin:partner-visibility:v1` | `builder-partner-evaluation-store.js` | パートナー表示/非表示 |
| `tasful:builder:settings:v1` | `builder.js` | Builder 全体設定 |
| `tasful:builder:projects:v2` | `builder-project-store.js` | 案件ストア（Project Hub） |
| `tasful:builder:vendor-pages:*` | `builder-vendor-pages-store.js` | 業者ページ |
| `tasful:builder:vendor-subscriptions:*` | `builder-vendor-pages-store.js` | 業者サブスクリプション |
| `tasful:builder:contact-reveals:v1` | `builder-contact-reveal.js` | 連絡先開示状態 |
| `tasful:builder:ai:drafts:v1` | `builder-ai-draft-store.js` | Builder AI 下書き |
| `tasu_member_session` | `builder-actor-identity.js` | メンバーセッション情報 |
| `tasful_chat_threads` | `builder-talk-bridge.js` | Talk スレッド情報（Builder 側） |
| `tasu:builder:ops-bench` | `builder.js`（sessionStorage） | 運営ベンチフラグ |

**合計: 約 25 種類の localStorage キー**

---

## 3. ② DEMO データ一覧

### 3.1 コア DEMO 定数（`builder.js`）

| 定数名 | 用途 | データ数 |
| --- | --- | --- |
| `DEMO_PARTNERS` | 協力会社マスタ | 3 件 |
| `DEMO_PROJECTS` | 案件一覧 | 2 件 |
| `DEMO_PROJECT_SPECS` | 案件仕様 | 2 件 |
| `DEMO_PROJECT_LINKS` | 案件-パートナー紐付け | 2 件 |
| `DEMO_TEMPLATES` | 案件テンプレート | 2 件 |
| `DEMO_FAVORITES` | お気に入り | 2 件 |
| `DEMO_STATS_USER` | ユーザー統計 | 3 項目 |
| `DEMO_STATS_ADMIN` | 管理者統計 | 3 項目 |
| `DEMO_RECENT_PROJECTS` | 最近の案件（ユーザー） | 5 件 |
| `DEMO_ADMIN_RECENT_PROJECTS` | 最近の案件（管理者） | 3 件 |
| `DEMO_STATS_GENERAL_USER` | 一般ユーザー統計 | 2 項目 |
| `DEMO_USER_GENERAL_RECENT` | 一般ユーザー最近 | 4 件 |
| `DEMO_USER_RECENT_CHATS` | 一般ユーザーチャット | 4 件 |
| `ADMIN_DEMO_PARTNERS` | 管理画面パートナー | 6 件 |
| `DEMO_APPLICATION_ENRICHMENTS` | 応募補足情報 | 2 件 |
| `BUILDER_THREAD_ID_ALIASES` | スレッド ID 別名 | 8 件 |
| `BUILDER_THREAD_TYPE_BY_ID` | スレッドタイプ | 8 件 |
| 通知デモデータ | シード通知 | 10 件 |

### 3.2 サブモジュール DEMO（他 JS ファイル）

| 定数名 | ファイル | 用途 | データ数 |
| --- | --- | --- | --- |
| `DEMO_CONTACTS` | `builder-contact-reveal.js` | 連絡先情報 | worker 6 件 + vendor 3 件 |
| `DEMO_FIND_WORKERS` | `builder-search-repository.js` | ワーカー検索結果 | 5 件 |
| `DEMO_PARTNERS`（検索用） | `builder-search-repository.js` | パートナー検索結果 | 3 件 |
| `DEMO_JOBS` | `builder-search-repository.js` | 求人検索結果 | 3 件 |
| `SAMPLE_WORKERS` | `builder-ai-candidate-recommend.js` | AI 推薦ワーカー | 4 件 |
| `SAMPLE_PARTNERS` | `builder-ai-candidate-recommend.js` | AI 推薦パートナー | 4 件 |
| `LIST` | `partner-mock-data.js` | パートナー管理モック | 23 件 |
| Flow spec（3 パターン） | `builder-general-flow.js` | 案件フロー種別定義 | 3 パターン |
| `DEMO_JOB_ID` / `DEMO_WORKER_ID` | `builder-board-feed.js` | 掲示板フィード | 2 件 |
| `OWNER_ID` | `builder.js` 他多数 | 運営デフォルト ID | `demo-owner-001` |

### 3.3 固定配列 / Stub

| ファイル | 状態 |
| --- | --- |
| `builder-repository.js` | 空スタブ |
| `builder-repositories-local.js` | 空スタブ |
| `builder-repositories-supabase.js` | `isEnabled() → false` のみ |
| `builder-config.js` | `getStorageMode() → "local"` · `isSupabaseEnabled() → false` |
| `builder-data-provider.js` | `getMvpStore() → null` · `getNotificationRepository() → null` |
| `builder-b3-init.js` | `finish()` 空実装 |
| `builder-session.js` | 空スタブ |
| `builder-mvp-store-local.js` | 空スタブ |
| `builder-notification-adapter.js` | 空スタブ |
| `builder-storage-adapter.js` | 空スタブ |

---

## 4. ③ Supabase 化する対象

### 4.1 テーブル（設計ノートより）

| # | テーブル | スキーマ設計状況 | 相当する localStorage / DEMO |
| --- | --- | --- | --- |
| 1 | `builder_partners` | ✅ 列定義済 | `DEMO_PARTNERS` + `ADMIN_DEMO_PARTNERS` |
| 2 | `builder_projects` | ✅ 列定義済 | `DEMO_PROJECTS` + Project Hub store |
| 3 | `builder_project_applications` | ✅ 列定義済 | `DEMO_PROJECT_LINKS` + 応募データ |
| 4 | `builder_threads` | ✅ 列定義済 | `MVP_THREADS_STORAGE_KEY` |
| 5 | `builder_messages` | ✅ 列定義済 | スレッド内 events |
| 6 | `builder_thread_events` | ✅ 列定義済 | タイムラインイベント |
| 7 | `builder_thread_photos` | ✅ 列定義済 | 完了写真 |
| 8 | `builder_site_attendance` | ✅ 列定義済 | 現場入退場 |
| 9 | `builder_completion_reports` | ✅ 列定義済 | 完了報告 |
| 10 | `builder_invoice_meta` | ✅ 列定義済 | 請求情報 |
| 11 | `builder_pdf_outputs` | ✅ 列定義済 | PDF 出力 |
| 12 | `builder_notifications` | ✅ 列定義済 | `MVP_NOTIFICATIONS_KEY` |

### 4.2 追加テーブル候補（スキーマノート外）

| # | テーブル | 用途 | 相当データ |
| --- | --- | --- | --- |
| 13 | `builder_project_templates` | 案件テンプレート | `DEMO_TEMPLATES` |
| 14 | `builder_re_requests` | 再依頼 | `MVP_RE_REQUESTS_KEY` |
| 15 | `builder_favorites` | お気に入り | `DEMO_FAVORITES` |
| 16 | `builder_contact_reveals` | 連絡先開示履歴 | `DEMO_CONTACTS` + 開示状態 |
| 17 | `builder_partner_evaluations` | パートナー評価 | `builder-partner-evaluation-store.js` |
| 18 | `builder_vendor_pages` | 業者ページ | `builder-vendor-pages-store.js` |
| 19 | `builder_calendar_assignments` | カレンダーアサイン | `ADMIN_CALENDAR_ASSIGNMENTS_KEY` |

### 4.3 Supabase Storage（設計ノートより）

| Bucket | 用途 | Path 規約 |
| --- | --- | --- |
| `builder-photos`（private） | 完了写真 | `{project_id}/{thread_id}/{photo_id}/{file_name}` |
| `builder-pdfs`（private） | 完了報告書/請求書 PDF | `{project_id}/{thread_id}/{pdf_id}/{kind}.pdf` |

### 4.4 Edge Function（設計ノートより）

| Function | 用途 |
| --- | --- |
| `builder-create-signed-url` | 権限確認後 Storage signed URL 発行 |
| （追加候補）`builder-notifications` | 通知作成（server-side） |

---

## 5. ④ 実装順（依存関係考慮）

### Phase 1：基盤 — Repository パターン + Supabase Config

| 項目 | 内容 | 依存 |
| --- | --- | --- |
| **1-A** | `builder-config.js` 実装 — `getStorageMode()` で `"local"` / `"supabase"` 切替、feature flags | なし |
| **1-B** | `builder-data-provider.js` 実装 — `getMvpStore()`, `getNotificationRepository()` が Supabase/Local を返す | 1-A |
| **1-C** | `builder-repository.js` 実装 — 共通 CRUD ヘルパー | なし |
| **1-D** | `builder-repositories-supabase.js` 実装 — Supabase クライアントを使った CRUD（Business Directory の `business-directory-repository.js` パターン） | `chat-supabase-config.js` |
| **1-E** | `builder-repositories-local.js` 実装 — localStorage 版（フォールバック/開発用） | 1-C |
| **1-F** | `builder-b3-init.js` 実装 — `finish()` でレポジトリ登録、builder.js へのブリッジ完了 | 1-A～1-E |

**検証:** `builder.js` が既存の localStorage パスを通らず、Data Provider 経由で動作すること。

---

### Phase 2：DB スキーマ + Migration

| 項目 | 内容 | 依存 |
| --- | --- | --- |
| **2-A** | `sql/builder-schema.sql` 作成 — テーブル DDL（型・制約・インデックス） | スキーマノート |
| **2-B** | Staging 環境へ migration 実行 | 2-A |
| **2-C** | `builder_partners` / `builder_projects` の seed 投入 | 2-B |
| **2-D** | RLS 設計確定 → `sql/builder-rls-policies.sql` 作成 | 2-A + Auth 方針 |
| **2-E** | Storage bucket 作成（`builder-photos`, `builder-pdfs`） | 2-B |

**検証:** Supabase MCP（Staging · read_only）でテーブル/RLS 確認。

---

### Phase 3：認証（Auth）

| 項目 | 内容 | 依存 |
| --- | --- | --- |
| **3-A** | `builder-session.js` 実装 — Supabase Auth セッション管理 | 1-D, 2-A |
| **3-B** | `builder-actor-identity.js` 実装 — Supabase JWT から actor 解決（`app_metadata.role` / `partner_id` / `owner_id`） | 3-A |
| **3-C** | ロール切替 UI（owner/partner/user/vendor）を Supabase Auth ベースに | 3-B |
| **3-D** | RLS ポリシー実装（owner/partner/admin の権限境界） | 2-D, 3-B |

**検証:**
- owner: 自分の project が見える/更新できる
- partner: 応募済み project が見える、selected のみ操作可
- admin: 全件操作可
- 未認証: アクセス不可

---

### Phase 4：案件（Projects）

| 項目 | 内容 | 依存 |
| --- | --- | --- |
| **4-A** | `builder_projects` テーブル → Repository CRUD | Phase 2, 3 |
| **4-B** | `builder_project_applications` テーブル → Repository CRUD | 4-A |
| **4-C** | `builder_project_templates` テーブル → Repository CRUD | 4-A |
| **4-D** | `builder_re_requests` テーブル → Repository CRUD | 4-A |
| **4-E** | `builder_favorites` テーブル → Repository CRUD | 4-A |
| **4-F** | `builder-project-store.js` を Repository 経由に書き換え | 4-A～4-E |
| **4-G** | `builder.js` の `DEMO_PROJECTS` / `DEMO_TEMPLATES` 等を削除、Repository に置換 | 4-F |

**検証:** 案件一覧/詳細/テンプレート/お気に入りが Supabase 経由で CRUD 可能。`localStorage` 使用廃止。

---

### Phase 5：パートナー

| 項目 | 内容 | 依存 |
| --- | --- | --- |
| **5-A** | `builder_partners` テーブル → Repository CRUD | Phase 2, 3 |
| **5-B** | `builder_partner_evaluations` テーブル → Repository CRUD | 5-A |
| **5-C** | `builder-partner-evaluation-store.js` を Repository 経由に書き換え | 5-B |
| **5-D** | `builder.js` の `DEMO_PARTNERS` / `ADMIN_DEMO_PARTNERS` 削除 | 5-A |
| **5-E** | `partner-mock-data.js` 廃止 | 5-A |

**検証:** パートナー一覧/詳細/評価/管理が Supabase 経由で動作。

---

### Phase 6：Talk（メッセージ）

| 項目 | 内容 | 依存 |
| --- | --- | --- |
| **6-A** | `builder_threads` テーブル → Repository CRUD | Phase 2, 3 |
| **6-B** | `builder_messages` テーブル → Repository CRUD | 6-A |
| **6-C** | `builder_thread_events` テーブル → Repository CRUD | 6-A |
| **6-D** | `builder-talk-bridge.js` を Repository 経由に書き換え | 6-B, 6-C |
| **6-E** | `builder.js` のスレッド関連 localStorage を削除、Repository に置換 | 6-D |

**検証:** スレッド一覧/メッセージ送受信/タイムラインが Supabase 経由で動作。

---

### Phase 7：現場・完了報告

| 項目 | 内容 | 依存 |
| --- | --- | --- |
| **7-A** | `builder_site_attendance` テーブル → Repository CRUD | Phase 6 |
| **7-B** | `builder_completion_reports` テーブル → Repository CRUD | Phase 6 |
| **7-C** | `builder_calendar_assignments` テーブル → Repository CRUD | Phase 6 |
| **7-D** | `builder-project-calendar.js` を Repository 経由に書き換え | 7-A, 7-C |
| **7-E** | `builder-project-detail.js` の完了報告 UI を Repository 経由に | 7-B |

**検証:** 現場入退場/カレンダー/完了報告が Supabase 経由で動作。

---

### Phase 8：Storage（画像・PDF）

| 項目 | 内容 | 依存 |
| --- | --- | --- |
| **8-A** | `builder_thread_photos` テーブル → Repository CRUD | Phase 6 |
| **8-B** | `builder_pdf_outputs` テーブル → Repository CRUD | Phase 6 |
| **8-C** | `builder-storage-adapter.js` 実装 — Supabase Storage アップロード/ダウンロード | 2-E |
| **8-D** | Edge Function `builder-create-signed-url` 実装 | 8-C |
| **8-E** | Storage policy 実装（RLS 連携） | 2-D, 8-D |
| **8-F** | dataURL → Storage 移行（既存 DEMO データの変換） | 8-E |

**検証:** 写真アップロード/PDF 生成/署名 URL 発行/権限チェック。

---

### Phase 9：検索

| 項目 | 内容 | 依存 |
| --- | --- | --- |
| **9-A** | `builder-search-repository.js` を Supabase クエリに書き換え | Phase 4, 5 |
| **9-B** | `builder-conditional-search.js` Supabase 連携 | 9-A |
| **9-C** | 全文検索インデックス（必要に応じて `pg_trgm`） | 9-A |
| **9-D** | `builder-search-ui-adapter.js` を Repository 経由に | 9-A |

**検証:** ワーカー検索/パートナー検索/求人検索/条件検索が Supabase 経由で動作。`DEMO_FIND_WORKERS` / `DEMO_JOBS` 削除。

---

### Phase 10：通知

| 項目 | 内容 | 依存 |
| --- | --- | --- |
| **10-A** | `builder_notifications` テーブル → Repository CRUD | Phase 2, 3 |
| **10-B** | `builder-notification-adapter.js` 実装 — `countUnread`, `markAsRead`, `markAllAsRead`, `persistFromMvp` | 10-A |
| **10-C** | 通知シード（`notif-demo-*`）を Supabase に移行 | 10-A |
| **10-D** | Edge Function `builder-notifications`（server-side 通知作成） | 10-A |
| **10-E** | Supabase Realtime によるリアルタイム通知（オプション） | 10-D |

**検証:** 通知一覧/未読カウント/既読化が Supabase 経由で動作。

---

### Phase 11：Admin（管理画面）

| 項目 | 内容 | 依存 |
| --- | --- | --- |
| **11-A** | `admin-partners.html` / `admin-dispatch.html` を Repository 経由に | Phase 5 |
| **11-B** | `admin-applications.html` を Repository 経由に | Phase 4 |
| **11-C** | `admin-calendar.html` を Repository 経由に | Phase 7 |
| **11-D** | `admin-reviews.html` を Repository 経由に | Phase 4 |
| **11-E** | `admin-notifications.html` を Repository 経由に | Phase 10 |

**検証:** 管理画面の全機能が Supabase 経由で動作。

---

### Phase 12：請求・決済・Contact Reveal

| 項目 | 内容 | 依存 |
| --- | --- | --- |
| **12-A** | `builder_invoice_meta` テーブル → Repository CRUD | Phase 7 |
| **12-B** | `builder_contact_reveals` テーブル → Repository CRUD | Phase 4 |
| **12-C** | Stripe 連携（Contact Reveal 550 円決済 + 完了時コミッション） | 12-A, 12-B |
| **12-D** | Stripe Webhook → Edge Function（支払い完了 → 開示フラグ更新） | 12-C |
| **12-E** | `builder-billing-policy.js` の課金ロジックを実際の支払いに接続 | 12-C |

**検証:** 連絡先開示の 550 円決済、案件完了時のコミッション計算、請求書生成。

---

### Phase 13：業者ページ

| 項目 | 内容 | 依存 |
| --- | --- | --- |
| **13-A** | `builder_vendor_pages` テーブル → Repository CRUD | Phase 5 |
| **13-B** | `builder-vendor-pages-store.js` を Repository 経由に書き換え | 13-A |
| **13-C** | `builder-vendor-pages-ui.js` を Repository 経由に | 13-A |
| **13-D** | Business Directory 連携（`listPublishedForBusinessDirectory()` 実装） | 13-A, BD MVP-2 |

**検証:** 業者ページ CRUD、サブスクリプション管理、BD 連携。

---

### Phase 14：移行・セットアップ

| 項目 | 内容 | 依存 |
| --- | --- | --- |
| **14-A** | `scripts/migrate-builder-export-to-supabase.mjs` `--execute` 実装 | Phase 2 |
| **14-B** | legacy ID → UUID 変換マップ生成 | 14-A |
| **14-C** | dataURL 画像の Storage 移行スクリプト | Phase 8 |
| **14-D** | `export-device-localStorage.html` 廃止 | 14-A |

---

### Phase 15：最終整理

| 項目 | 内容 | 依存 |
| --- | --- | --- |
| **15-A** | 全 DEMO 定数削除（`DEMO_PARTNERS`, `DEMO_PROJECTS` 等） | Phase 4～13 |
| **15-B** | 全 localStorage キー廃止（フォールバック用を除く） | Phase 4～13 |
| **15-C** | `builder-config.js` の `getStorageMode()` を `"supabase"` にデフォルト変更 | 15-B |
| **15-D** | E2E テスト整備 | 15-A～15-C |
| **15-E** | Production 環境 migration | 15-D |

---

### 依存関係グラフ

```
Phase 1（基盤）
  ├── Phase 2（DB スキーマ + Migration）
  │     └── Phase 3（認証）
  │           ├── Phase 4（案件）
  │           │     ├── Phase 9（検索）
  │           │     ├── Phase 12-B（Contact Reveal）
  │           │     └── Phase 11-B（Admin 応募）
  │           ├── Phase 5（パートナー）
  │           │     ├── Phase 11-A（Admin パートナー）
  │           │     └── Phase 13（業者ページ）
  │           ├── Phase 6（Talk）
  │           │     ├── Phase 7（現場・完了報告）
  │           │     │     ├── Phase 11-C（Admin カレンダー）
  │           │     │     └── Phase 12-A（請求）
  │           │     └── Phase 8（Storage）
  │           └── Phase 10（通知）
  │                 └── Phase 11-E（Admin 通知）
  └── Phase 14（移行）
        └── Phase 15（最終整理）
```

---

## 6. ⑤ Business Directory と共通化できるもの

| # | 共通化項目 | BD 側 | Builder 流用可否 | 備考 |
| --- | --- | --- | --- | --- |
| 1 | **Repository パターン** | `business-directory-repository.js`（Edge API wrapper） | ✅ 完全流用可 | `builder-repository.js` → Edge Function 呼出の同一パターン |
| 2 | **Supabase クライアント** | `tasu-supabase-client.js` + `chat-supabase-config.js` | ✅ 完全流用可 | 既存ファイルそのまま使用 |
| 3 | **Auth セッション** | `member-auth.js` / `member-profile.js` | ✅ 完全流用可 | ログイン状態・プロフィール表示 |
| 4 | **Edge Function パターン** | `supabase/functions/business-directory/index.ts` | ✅ 設計流用可 | POST + action ディスパッチ方式 |
| 5 | **Mock モード** | `bdMock=1` + `createMockRepository()` | ✅ 設計流用可 | `builderMock=1` 等の開発用フォールバック |
| 6 | **Storage パターン** | BD の画像ストレージ運用 | ✅ 設計流用可 | signed URL 発行/RLS 連携 |
| 7 | **RLS 設計** | BD の `owner_user_id` ベース RLS | ⚠️ 一部流用可 | Builder は role が 4 種（owner/partner/user/vendor/admin）で複雑 |
| 8 | **Stripe 連携** | BD のサブスクリプション決済 | ⚠️ 一部流用可 | Builder は Contact Reveal 550 円 + 完了コミッションで決済モデルが異なる |
| 9 | **Admin ページ** | BD の `admin/listing.html` + `admin/reviews.html` | ⚠️ 参考可 | Builder 管理画面は別物だが、構成は参考になる |
| 10 | **ダッシュボード UI** | `dashboard.css` + `dash-*` 共通コンポーネント | ✅ 既に使用中 | サイドバー・ヘッダー・レイアウト |
| 11 | **カテゴリ** | `business-directory-categories.js` | ❌ 非該当 | Builder は業種（工種）マスタが異なる |
| 12 | **Plan/課金** | `business-directory-plan.js` | ❌ 非該当 | Builder は独自の課金ポリシー（`builder-billing-policy.js`） |

### 共通化推奨事項

1. **Repository → Edge Function パターンをそのまま踏襲**
   - `builder-repository.js` = `business-directory-repository.js` と同じ構造
   - Edge Function `supabase/functions/builder/index.ts` を作成
   - POST + `action` ディスパッチ方式

2. **Mock モードの流用**
   - `builderMock=1` クエリパラメータで localStorage フォールバック
   - 開発/テスト時は既存 DEMO データを使い続けられる

3. **共通モジュールの再利用**
   - `tasu-supabase-client.js`
   - `chat-supabase-config.js`
   - `member-auth.js`
   - `member-profile.js`
   - `dashboard.css` + ダッシュボード共通レイアウト

---

## 7. ⑥ リスク

| # | リスク領域 | 内容 | 深刻度 | 対策 |
| --- | --- | --- | --- | --- |
| 1 | **認証** | MVP は URL パラメータ + localStorage の role 切替。Auth 不在 | 🔴 高 | Phase 3 で Supabase Auth 導入必須。JWT claims 設計（`actor_id`, `actor_type`, `partner_id`, `owner_id`）が RLS の前提 |
| 2 | **RLS** | 4 ロール（owner/partner/user/vendor） + admin。プロジェクト単位の複雑な権限 | 🔴 高 | スキーマノートの RLS 設計方針をベースに、段階的にポリシー実装。テスト必須 |
| 3 | **Storage** | MVP は dataURL で画像/PDF を保持。サイズ・セキュリティ問題 | 🟡 中 | Phase 8 で Supabase Storage + signed URL に移行。既存 dataURL の変換スクリプト必要 |
| 4 | **検索性能** | DEMO は配列フィルタ。実データではフルテキスト検索/インデックス必要 | 🟡 中 | `pg_trgm` 拡張 + 全文検索インデックス。条件検索（業種/エリア/予算）の複合クエリ最適化 |
| 5 | **通知** | MVP はハードコードされたデモ通知のみ | 🟡 中 | Phase 10 で DB 通知 + Realtime。既存 10 件のデモ通知は seed として移行 |
| 6 | **Talk** | `builder-talk-bridge.js` が `tasful_chat_threads` localStorage を読み書き | 🟡 中 | Phase 6 で Supabase に移行。Talk 側（`talk-home.html`）との整合性確認 |
| 7 | **決済** | Contact Reveal 550 円 + 完了コミッション（5-10%）の実際の課金未実装 | 🔴 高 | Phase 12 で Stripe Checkout + Webhook。BD の Stripe 連携パターンを参考にしつつ、異なる課金モデルに対応 |
| 8 | **データ移行** | localStorage → Supabase の初期データ投入。ID 変換・dataURL 変換 | 🟡 中 | Phase 14 の移行スクリプトで対応。dry-run 必須 |
| 9 | **並行開発** | Builder v1.0 は FROZEN。B3 変更が既存機能を壊さないこと | 🟡 中 | Phase 1 の Data Provider パターンで local/supabase 切替可能に。段階的移行 |
| 10 | **RLS と Auth JWT** | JWT claims の設計が未確定（`auth.jwt()` vs `current_setting`） | 🔴 高 | Phase 3 で確定必須。実行前チェックリストの「JWT claims 最終仕様」に従う |
| 11 | **Edge Function 依存** | BD は全操作が Edge Function 経由。Builder も同様にするとレイテンシ増 | 🟢 低 | 読み取りは Supabase クライアント直接、書き込みは Edge Function のハイブリッドも検討 |
| 12 | **パフォーマンス** | 400+ 行の builder.js が巨大。全 DEMO データ参照を置換する作業量 | 🟡 中 | Phase ごとに search & replace。`builder-b3-init.js` のブリッジパターンで段階的移行 |

---

## 8. ⑦ 優先順位

### P0 — 商用化必須（Phase 1～12 + Phase 14～15）

| Phase | 内容 | 理由 |
| --- | --- | --- |
| Phase 1 | Repository パターン + Supabase Config | 全 Phase の基盤。データソース抽象化 |
| Phase 2 | DB スキーマ + Migration | テーブルがなければ何も始まらない |
| Phase 3 | 認証（Auth） | RLS の前提。ユーザー識別の正を確立 |
| Phase 4 | 案件（Projects） | Builder の中心機能。パートナー/Talk の前提 |
| Phase 5 | パートナー | 案件に必須のリソース |
| Phase 6 | Talk（メッセージ） | ユーザー間コミュニケーション |
| Phase 7 | 現場・完了報告 | 案件クローズに必須 |
| Phase 8 | Storage（画像・PDF） | 写真/書類の永続化 |
| Phase 9 | 検索 | 案件・パートナー発見に必須 |
| Phase 10 | 通知 | ユーザーエンゲージメントに必須 |
| Phase 11 | Admin（管理画面） | 運営に必須 |
| Phase 12 | 請求・決済・Contact Reveal | 収益化に必須 |
| Phase 14 | 移行・セットアップ | 本番稼働に必須 |
| Phase 15 | 最終整理 | DEMO コード削除、E2E テスト |

### P1 — 公開後（Phase 13）

| Phase | 内容 | 理由 |
| --- | --- | --- |
| Phase 13 | 業者ページ | BD 連携含むが、コアフローには影響しない |

### P2 — Future（Phase 外・将来検討）

| 項目 | 内容 | 理由 |
| --- | --- | --- |
| Supabase Realtime | リアルタイム通知・メッセージ | Phase 10 のオプション。Polling で十分な場合は後回し |
| 全文検索高度化 | 自然文検索（LLM 連携） | REL-F-07 で Future 扱い |
| 分析ダッシュボード | 案件/パートナー統計 | 運用データが溜まってから |
| 外部連携 | 会計ソフト/労務管理 | 顧客要望次第 |

---

## 9. 留意事項

### 9.1 Production Ready 凍結（AD-008）

Builder v1.0 は **Production Ready · RELEASE FROZEN**。
B3 変更は **Critical / Security / 仕様追従** に該当する（data layer 本番化は仕様追従）。
ただし、UI/レイアウト変更は禁止。内部データフローのみ変更。

### 9.2 Builder AI は TASFUL AI と統合しない（AD-002）

Builder AI のデータ層（`builder-ai-draft-store.js`, `builder-ai-draft-supabase.js`）は B3 移行後も `surface=builder_ai` を維持。TASFUL AI Workspace に混在させない。

### 9.3 `ai-model-gateway.js` 契約は変更しない（AD-005）

B3 移行は Gateway 契約に影響しない。触らない。

### 9.4 AI 出力は下書き（AD-006）

Builder AI の出力は本番化後も下書き扱い。請求・採用・完了承認の自動確定禁止は維持。

### 9.5 選別コミット（AD-007）

Builder 変更は Builder ファイルのみを `git add`。Admin/Platform/TLV/Secretary のファイルを混在させない。

### 9.6 検証環境（8788）

全検証は `http://127.0.0.1:8788` のみ。`file://` 禁止。
`npm run dev`（Wrangler Pages Dev）使用。

### 9.7 実行前チェックリスト

`builder/builder-supabase-execution-checklist.md` の「SQL実行前の必須確認（人間チェック）」全項目をクリアしてから Phase 2 以降に着手すること。
特に JWT claims 設計と `auth.jwt()` vs `current_setting` の確定が必要。

---

## 10. 参考資料

| 資料 | パス |
| --- | --- |
| スキーマ設計ノート | `builder/builder-supabase-schema-notes.md` |
| 実行前チェックリスト | `builder/builder-supabase-execution-checklist.md` |
| BD Repository 実装 | `business-directory-repository.js` |
| BD Common | `business-directory/business-directory-common.js`（mock モード参照） |
| BD 運用 runbook | `docs/runbooks/business-directory-oncall.md` |
| Builder 課金方針 | `builder/builder-billing-policy.js` |
| 決定事項 | `docs/DECISIONS.md`（AD-001～AD-015） |
| 現状 TODO | `docs/TODO.md` |
| Global rules | `.cursor/rules/_global.mdc`, `pkg-builder.mdc` |

---

*このロードマップは調査・設計のみ。実装/Migration/DB 変更/Edge 変更/Commit は未実施。*