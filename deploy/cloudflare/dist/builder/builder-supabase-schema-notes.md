# Builder MVP → Supabase 移行用スキーマ設計メモ（案）

このメモは **localStorage / demoData のMVP** を、後で Supabase に移しやすくするための「列定義・関係・enum候補」の整理です。
**Supabase接続・SQL作成・RLS設計は次工程**（このファイルは設計ノートのみ）。

## 前提
- **idは基本 uuid**（Supabase側の `id uuid primary key default gen_random_uuid()` を想定）
- demo/localStorage では既存ID（`demo-project-001` 等）を維持
- DDLでは `*_key`（legacy id）列を置き、移行時に uuid との対応付けに使う想定
- 移行時に uuid へ変換できるように、**外部キーは常に *_id を明示**（`project_id / thread_id / partner_id` など）
- actor は **3列へ分解**して保存する（Join不要で表示できる）
  - `actor_id`（uuid or 既存ID）
  - `actor_type`（`owner | partner | admin`）
  - `actor_name`（表示名）

> 実行直前の確認項目は `builder/builder-supabase-execution-checklist.md` を参照。
> **このリポジトリ内のSQL/Function/Scriptは、現時点では未実行**であり、人間確認後にのみ投入する。

## export payload（移行用）について
`builder.js` の `buildSupabaseReadyPayload()` は、MVP状態を「テーブル配列」にフラット化した payload を返します。
- 画像/PDFの `data:` URL は巨大化するため、export時は `"[dataURL omitted]"` に置換（本番は Storage に移す）

## テーブル一覧（候補）
- `builder_partners`
- `builder_projects`
- `builder_project_applications`
- `builder_threads`
- `builder_messages`
- `builder_thread_events`
- `builder_thread_photos`
- `builder_completion_reports`
- `builder_invoice_meta`
- `builder_pdf_outputs`
- `builder_site_attendance`
- `builder_notifications`

---

## 1) builder_partners
**用途**: 協力会社マスタ

- **主キー**: `partner_id`（uuid推奨 / demoは既存）
- **必須**: `display_name`, `partner_type`
- **nullable**: `headline`, `profile`, `updated_at` など
- **enum候補**
  - `partner_type`: `company | individual`
  - `availability`: `available | limited | busy`
  - `status`: `active | paused`
  - `contact_policy`: `tasful_talk_only | owner_allowed | admin_only`
- **jsonb候補**
  - `trades text[]`（もしくは `jsonb`）
  - `areas text[]`

列（案）:
- `partner_id text/uuid pk`
- `display_name text not null`
- `partner_type text not null`
- `trades text[] null`
- `areas text[] null`
- `headline text null`
- `profile text null`
- `contact_policy text null`
- `availability text null`
- `status text null`
- `updated_at timestamptz null`

---

## 2) builder_projects
**用途**: 案件（掲示板/管理案件共通）

- **主キー**: `project_id`
- **外部キー候補**
  - `owner_id` → 将来 `builder_owners` / `auth.users` 等へ
  - `main_thread_id` → `builder_threads.thread_id`
- **必須**: `title`, `kind`, `required_partners`
- **nullable**: `source_template_id`
- **enum候補**
  - `kind`: `builder_board | tasful_managed`
  - `visibility`: `public | private | partner_only | team_only`
  - `status`: MVPではUI計算も混在（将来はサーバ側ステータスに整理）
  - `source`: `tasful | company | partner | public_user`
- **jsonb候補**
  - `selected_partner_ids text[]`（MVP互換用の派生値。正は applications.status='selected'）

列（案）:
- `project_id text/uuid pk`
- `owner_id text/uuid not null`
- `title text not null`
- `kind text not null`
- `status text null`
- `required_partners int not null default 1`
- `selected_partner_ids text[] not null default '{}'`（将来は廃止 or 非正規化キャッシュ）
- `visibility text null`
- `contact_policy text null`
- `main_thread_id text/uuid null`
- `source text null`
- `source_template_id text/uuid null`
- `created_at timestamptz null`

---

## 3) builder_project_applications
**用途**: 応募（project × partner）

- **主キー**: `application_id`
- **外部キー候補**
  - `project_id` → `builder_projects`
  - `partner_id` → `builder_partners`
- **必須**: `project_id`, `partner_id`, `status`, `ts`
- **enum候補**
  - `status`: `applied | selected | rejected`

### 採用状態の正（方針）
- **Supabase本番では `builder_project_applications.status='selected'` が採用済みの正**
- 採用人数は `count(*) filter (where status='selected')` で算出
- `builder_projects.selected_partner_ids` は MVP由来の派生値扱い（将来は廃止推奨）

列（案）:
- `application_id text/uuid pk`
- `project_id text/uuid not null`
- `partner_id text/uuid not null`
- `status text not null`
- `ts timestamptz not null`
- `updated_at timestamptz null`
- unique候補: `(project_id, partner_id)`

---

## 4) builder_threads
**用途**: 案件スレッド（1案件=1スレッド前提でも拡張可能）

- **主キー**: `thread_id`
- **外部キー候補**
  - `project_id` → `builder_projects`

列（案）:
- `thread_id text/uuid pk`
- `project_id text/uuid not null`
- `created_at timestamptz null`

---

## 5) builder_messages
**用途**: Talkメッセージ（スレッド内チャット）

- **主キー**: `msg_id`
- **外部キー候補**
  - `thread_id` → `builder_threads`
  - `project_id` → `builder_projects`（冗長だが検索最適化で保持）
- **必須**: `thread_id`, `ts`, `text`, `actor_*`
- **enum候補**: `actor_type`

列（案）:
- `msg_id text/uuid pk`
- `thread_id text/uuid not null`
- `project_id text/uuid not null`
- `ts timestamptz not null`
- `text text not null`
- `actor_id text not null`
- `actor_type text not null` (`owner|partner`)
- `actor_name text not null`

---

## 6) builder_thread_events
**用途**: タイムラインイベント（応募/採用/入退場/完了/請求など）

- **主キー**: `event_id`
- **外部キー候補**
  - `thread_id` → `builder_threads`
  - `project_id` → `builder_projects`
- **必須**: `type`, `ts`, `actor_*`
- **enum候補**
  - `type`: `created | applied | selected | rejected | check_in | check_out | completed | completion_updated | photo | pdf | invoice_updated | invoice_finalized | invoice_finalized_locked | invoiced`

列（案）:
- `event_id text/uuid pk`
- `thread_id text/uuid not null`
- `project_id text/uuid not null`
- `type text not null`
- `ts timestamptz not null`
- `text text null`
- `actor_id text not null`
- `actor_type text not null`
- `actor_name text not null`

---

## 7) builder_thread_photos
**用途**: 完了写真メタ

- **主キー**: `photo_id`
- **外部キー候補**
  - `thread_id` → `builder_threads`
  - `project_id` → `builder_projects`
- **必須**: `file_name`, `uploaded_at`, `actor_*`
- **jsonb候補**: なし
- **Storageへ移す列**:
  - `url`（dataURLはMVP用。将来は `storage_path` / `public_url` / `signed_url` へ）

列（案）:
- `photo_id text/uuid pk`
- `thread_id text/uuid not null`
- `project_id text/uuid not null`
- `file_name text not null`
- `caption text null`
- `uploaded_at timestamptz not null`
- `actor_id text not null`
- `actor_type text not null`
- `actor_name text not null`
- `url text null`（MVPのみ / 本番はStorageへ）

---

## 7b) builder_site_attendance
**用途**: 現場入退場記録（ops_partner / カレンダー案件）

MVP では `thread.siteData.entry_at` 等に保持し、`buildSupabaseReadyPayload()` で本テーブルへフラット化する。

- **主キー**: `attendance_id`
- **外部キー候補**
  - `thread_id` → `builder_threads`
  - `project_id` → `builder_projects`
- **必須**: `entry_at` または `exit_at` のいずれか
- **nullable**: `exit_at`, `exit_user_id`（入場のみの場合）

列（案）:
- `attendance_id text/uuid pk`
- `thread_id text/uuid not null`
- `project_id text/uuid not null`
- `entry_at timestamptz null`
- `entry_user_id text null`
- `exit_at timestamptz null`
- `exit_user_id text null`

> `builder_thread_events.type = check_in | check_out` と併用。イベントはタイムライン表示用、本テーブルは検索・集計用。

---

## 8) builder_completion_reports
**用途**: 完了報告（フォーム入力）

- **主キー**: `report_id`
- **外部キー候補**
  - `thread_id` → `builder_threads`
  - `project_id` → `builder_projects`
- **必須**: `ts`, `updated_at`, `work_content`, `actor_*`
- **nullable**: `note`, `extra_charge_note`

列（案）:
- `report_id text/uuid pk`
- `thread_id text/uuid not null`
- `project_id text/uuid not null`
- `ts timestamptz not null`
- `updated_at timestamptz not null`
- `work_content text not null`
- `note text null`
- `extra_charge boolean not null default false`
- `extra_charge_note text null`
- `actor_id text not null`
- `actor_type text not null`
- `actor_name text not null`

---

## 9) builder_invoice_meta
**用途**: 請求情報（金額/メモ/確定ステータス）

- **主キー**: `invoice_meta_id`
- **外部キー候補**
  - `thread_id` → `builder_threads`
  - `project_id` → `builder_projects`
- **enum候補**
  - `status`: `draft | updated | finalized`
- **nullable**: `amount`, `finalized_*`

列（案）:
- `invoice_meta_id text/uuid pk`
- `thread_id text/uuid not null`
- `project_id text/uuid not null`
- `updated_at timestamptz not null`
- `amount numeric null`
- `note text not null default ''`
- `status text not null default 'draft'`
- `finalized_at timestamptz null`
- `finalized_by_actor_id text null`
- `finalized_by_actor_type text null`
- `finalized_by_actor_name text null`

---

## 10) builder_pdf_outputs
**用途**: PDF生成履歴（完了報告書/請求書）

- **主キー**: `pdf_id`
- **外部キー候補**
  - `thread_id` → `builder_threads`
  - `project_id` → `builder_projects`
- **enum候補**
  - `kind`: `completion_report | invoice`
- **Storageへ移す列**
  - `url`（MVPのdataURL。本番はStorageへ）

列（案）:
- `pdf_id text/uuid pk`
- `thread_id text/uuid not null`
- `project_id text/uuid not null`
- `kind text not null`
- `label text not null`
- `generated_at timestamptz not null`
- `actor_id text not null`
- `actor_type text not null`
- `actor_name text not null`
- `url text null`（MVPのみ / 本番はStorageへ）

---

## 11) builder_notifications
**用途**: 画面内通知ログ

- **主キー**: `notification_id`
- **外部キー候補**
  - `project_id` → `builder_projects`（nullable）
- **enum候補**
  - `tone`: `info | success | warning | danger`（MVPに合わせて調整）

列（案）:
- `notification_id text/uuid pk`
- `ts timestamptz not null`
- `project_id text/uuid null`
- `title text not null`
- `body text not null`
- `tone text not null`
- `actor_id text not null`
- `actor_type text not null`
- `actor_name text not null`

---

## enum候補一覧（まとめ）
- `actor_type`: `owner | partner | admin`
- `application_status`: `applied | selected | rejected`
- `invoice_status`: `draft | updated | finalized`
- `pdf_kind`: `completion_report | invoice`
- `event_type`: `created | applied | selected | rejected | message | check_in | check_out | completed | completion_updated | photo | pdf | invoice_updated | invoice_finalized | invoice_finalized_locked | invoiced`
- `notification_tone`: `info | success | warning | danger`
- `project_kind`: `builder_board | tasful_managed`
- `project_visibility`: `public | private | partner_only | team_only`
- `contact_policy`: `tasful_talk_only | owner_allowed | admin_only`

## リレーション（概略）
- `builder_projects (1) -> (1) builder_threads`（将来は複数スレッドも可）
- `builder_threads (1) -> (n) builder_messages`
- `builder_threads (1) -> (n) builder_thread_events`
- `builder_threads (1) -> (n) builder_thread_photos`
- `builder_threads (1) -> (n) builder_pdf_outputs`
- `builder_projects (1) -> (n) builder_project_applications`
- `builder_partners (1) -> (n) builder_project_applications`

## Storage移行方針（メモ）
- `builder_thread_photos.url` は本番では Storage へ移す
  - `storage_bucket`, `storage_path`, `public_url` or `signed_url` を列として追加（次工程）
- `builder_pdf_outputs.url` も同様（PDFの実体は Storage）

---

## RLS設計（案・次工程で実装）
このセクションは **設計方針**のみ。DDLに `enable row level security` や `create policy` はまだ入れません。

### ロール境界（想定）
- **owner**: `builder_projects.owner_id` に紐づく依頼元（案件管理者）
- **partner**: 応募/採用される協力会社（`builder_partners` を代表するユーザー）
- **admin**: 運営・管理（全件アクセス可）

> Supabase実装では `auth.uid()` を使う想定。
> owner/partner/admin の紐づけは次工程で「profiles/rolesテーブル」か「JWTカスタムクレーム」で確定する。

### project単位アクセスの基本ルール
- **owner**: 自分の `project` は CRUD 可能
- **partner**:
  - 自分が応募した `project` は閲覧可（`builder_project_applications.partner_id = self`）
  - そのうち **採用された**案件のみ、入退場/完了報告/写真アップロード等の操作可
- **admin**: 全件 CRUD 可

### テーブル別ポリシー方針（概略）
#### builder_projects
- SELECT: owner（自分のproject）/ partner（自分が応募したproject）/ admin（全件）
- UPDATE/DELETE: owner（自分のproject）/ admin（全件）

#### builder_project_applications
- SELECT: owner（自分のproject配下）/ partner（自分のrowのみ）/ admin（全件）
- INSERT: partner（自分のpartnerとしてのみ応募作成可）
- UPDATE:
  - owner: `selected/rejected` 更新（採用/却下）
  - partner: 原則不可（キャンセル要件が出たら追加）

#### builder_threads / builder_messages / builder_thread_events / builder_thread_photos / builder_completion_reports / builder_invoice_meta / builder_pdf_outputs
- SELECT:
  - owner: thread.project_id が ownerのproject
  - partner: 自分が応募しているproject（閲覧OK）
  - admin: 全件
- INSERT（操作系・例）:
  - messages: owner or partner（応募者であれば可）
  - thread_events:
    - check_in/check_out/completed/photo: **採用済みpartnerのみ**
    - selected/rejected/invoice_*: **owner/adminのみ**
  - thread_photos: **採用済みpartnerのみ**
  - completion_reports: **採用済みpartnerのみ**
  - invoice_meta: **owner/adminのみ**
  - pdf_outputs: **owner/adminのみ**（方針次第で partner生成も可）

#### builder_notifications
- SELECT:
  - owner: 自分のproject
  - partner: 自分が応募しているproject
  - admin: 全件
- INSERT: server-side（Edge Function）へ寄せるのが望ましい

---

## Storage運用ルール（案・次工程で実装）
### バケット構成案
- photos bucket: `builder-photos`
  - path: `builder-photos/{project_id}/{thread_id}/{photo_id}/{file_name}`
- pdf bucket: `builder-pdfs`
  - path: `builder-pdfs/{project_id}/{thread_id}/{pdf_id}/{kind}.pdf`

### signed_url の想定
- **有効期限**: 5分〜60分（運用/UXで調整）
- **発行者**: server-side（Edge Function）推奨
- **アクセス制御**: RLSで project単位の閲覧権限を確認してから signed_url を返す

### MVPからの移行メモ
- MVPは `photos.url` / `pdf_outputs.url` が `data:` URL の場合あり
- 移行時は dataURL を Storage へアップロードして `storage_path` 等へ置換する

---

## Edge Function: signed_url 発行（案）
目的:
- **project閲覧権限を確認してから** Storage の signed_url を発行する

設計:
- function: `supabase/functions/builder-create-signed-url/index.ts`
- input:
  - `bucket`: `builder-photos | builder-pdfs`
  - `path`: storage path
  - `expiresIn`（秒、10〜3600で丸め）
- flow:
  - JWT検証（Authorization header）
  - pathから `project_id` を抽出（先頭segment）
  - DB側の `builder_can_read_project(project_id)` 相当をRPCで確認（TODO）
  - OKなら `createSignedUrl`、NGなら403

注意:
- 署名URL発行は server-side 推奨（service role / edge function）
- Storage policyは「極力閉じる」方針が安全

## 実行前チェックリスト（SQL/Function/Migration）
- **SQLはまだ実行しない**（このリポジトリでは設計/実装準備のみ）
- `sql/builder-rls-policies.sql` の helper function / claim名を確定
- `sql/builder-storage-policies.sql` のパスから `project_id` を uuid として抽出できることを確認
- Storage bucketは private 前提（publicにしない）
- Edge Function `builder-create-signed-url` は
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - DB RPC `builder_can_read_project(p_project_id uuid)`
  が揃ってからデプロイ/動作確認する
- Migration script `--execute` は次工程で実装
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  を用意してから実行（今回はenvチェックのみ）

---

## 移行スクリプト設計（dry-run）
設計スクリプト:
- `scripts/migrate-builder-export-to-supabase.mjs`

仕様:
- 入力: export JSONファイル
- default: dry-run（接続/insertなし）
- `--execute`: 将来の実insert用フラグ（現状TODO）

dry-runで行うこと:
- テーブルごとの件数表示
- insert順序の表示
- legacy id → uuid map の生成（計画用）
- dataURL / omitted の警告表示

insert順序（想定）:
1. `builder_partners`
2. `builder_projects`
3. `builder_threads`
4. `builder_project_applications`
5. `builder_messages`
6. `builder_thread_events`
7. `builder_thread_photos`
8. `builder_completion_reports`
9. `builder_invoice_meta`
10. `builder_pdf_outputs`
11. `builder_notifications`

実行前確認事項:
- key列（`*_key`）とuuid列（`id`）の運用方針
- partner/ownerのauth紐づけ方針（claims/rolesテーブル）
- Storage bucket/policy、署名URL発行の責務分離

---

## selected_partner_ids の中間テーブル化（推奨）
現状:
- `builder_projects.selected_partner_ids uuid[]`（配列）

中間テーブル案:
- table: `builder_project_selected_partners`（または `builder_project_partner_links`）
- columns:
  - `id uuid PK`
  - `project_id uuid FK -> builder_projects`
  - `partner_id uuid FK -> builder_partners`
  - `status text CHECK ('applied','selected','rejected')`
  - `created_at / updated_at`

利点:
- RLSが単純（partnerは自分rowだけ、ownerは自分project配下だけ）
- 採用人数/応募者一覧がSQLで簡単
- 状態追加（invited等）がしやすい

懸念:
- 移行で配列→テーブルへ変換が必要
- `builder_project_applications` と役割が近い

推奨:
- 本番運用なら **中間テーブル化（または applications をリンクテーブルとして拡張）** を推奨
- `selected_partner_ids` は将来的に廃止できる（applications.status='selected' を正とする）

## 次工程（TODO）
- Supabase側の **SQL DDL** 作成（型/制約/インデックス）→ `sql/builder-schema.sql`
- RLS設計（owner/partner/運営の権限境界、project単位のアクセス制御）
- Storage設計（bucket, path規約, signed url期限, メタデータ）
- 移行スクリプト（export payload → insert順序、id変換マップ）

---

## 実行前の最終確認
実行前のチェックリストは `builder/builder-supabase-execution-checklist.md` を参照。
**このリポジトリ内のSQL/Function/Scriptは、現時点では“準備”であり、まだ実行しない。**
