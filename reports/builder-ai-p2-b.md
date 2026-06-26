# Builder AI P2-B — 実装レポート

実施日: 2026-06-26  
スコープ: **P2-B**（Supabase/JWT/RLS staging 準備 · **本番 DB/RLS 未適用**）

---

## 判定

| 完了条件 | 状態 |
| --- | --- |
| 本番 DB 未適用 | ✅ |
| Supabase draft 永続化の準備 | ✅ |
| localStorage fallback 維持 | ✅ |
| JWT/RLS 正本化方針明確 | ✅ |
| live Gateway 8 action E2E 準備 | ✅ |
| 本レポート | ✅ |

---

## 1. 実装内容

### 1.1 Supabase draft テーブル設計（staging SQL）

`sql/builder-ai-drafts-staging.sql` を新規作成（**実行禁止 · staging のみ**）。

主要カラム:

| カラム | 用途 |
| --- | --- |
| `project_id` / `thread_id` | 案件・スレッドスコープ（text key · MVP 互換） |
| `actor_type` / `actor_id` | 作成者（guest 不可） |
| `owner_id` / `partner_id` | RLS スコープ補助 |
| `action` | 8 action ID |
| `content` | `【下書き・確認用】` 必須（CHECK + trigger で改ざん禁止） |
| `visibility` | scoped / private / admin_only |
| `hidden` / `archived` | 履歴除外 |
| `is_draft` | 常に true（正式文書へ昇格不可） |
| `metadata` | jsonb（source, local_id 等） |
| `created_at` / `updated_at` | 監査 |

RLS 方針:

- **Guest**: policy なし → 作成・参照不可（FAQ のみ）
- **Owner**: 自 `owner_id` 案件の draft のみ
- **Partner**: 参加案件の draft のみ（applications 経由）
- **Admin**: 全件参照 · 確定データへの書込不可
- **全 role**: `is_draft=true` · content prefix 必須

### 1.2 JWT claim 正本化

新規: `builder/builder-ai-jwt-resolver.js`

| 項目 | dev（現行） | 本番 JWT 正本（将来） |
| --- | --- | --- |
| `actor_type` | URL → sessionStorage → localStorage | `builder_actor_type` / `actor_type` |
| `actor_id` | MVP 派生 ID | `builder_actor_id` / `sub` |
| `owner_id` | MVP state `owner_id` | `builder_owner_id` |
| `partner_id` | URL / localStorage | `builder_partner_id` |
| `is_admin` | `?role=admin` | `builder_is_admin` / `is_ops` |
| project scope | `canAccessProject` | `builder_project_scope` + RLS |
| thread scope | MVP threads | `builder_thread_scope` |

dev fallback は **意図的に残存**。本番では JWT を正本とし、query/localStorage は開発専用。

### 1.3 draft store — Supabase 対応 + fallback

| ファイル | 役割 |
| --- | --- |
| `builder-ai-draft-supabase.js` | Supabase insert/list/hide（session 必須） |
| `builder-ai-draft-store.js` | **localStorage 優先** · Supabase best-effort 同期 |

フロー:

1. バリデーション（draft prefix · guest 拒否）
2. **localStorage に即保存**（AI 回答を失わない）
3. Supabase ready なら非同期 insert · 成功時 `supabase_id` をローカルに反映
4. insert 失敗 → ローカルのみ（エラーにしない）
5. `syncFromSupabase()` で起動時マージ（任意）

### 1.4 Live Gateway 8 action E2E

| スクリプト | 用途 |
| --- | --- |
| `scripts/test-builder-ai-live-e2e.mjs` | Playwright · 8 action · mock Gateway 可 |
| `scripts/test-builder-ai-live-qa.mjs` | チェックリスト + e2e セクション追加 |

E2E 実行:

```bash
npm run build:pages
BUILDER_AI_E2E=1 node scripts/test-builder-ai-live-e2e.mjs
```

実 Edge: `BUILDER_AI_E2E_LIVE_EDGE=1`（要認証 · 課金注意）

---

## 2. 変更ファイル

| ファイル | 変更 |
| --- | --- |
| `sql/builder-ai-drafts-staging.sql` | **新規** staging DDL + RLS |
| `builder/builder-ai-jwt-resolver.js` | **新規** JWT 正本 + dev fallback |
| `builder/builder-ai-draft-supabase.js` | **新規** Supabase adapter |
| `builder/builder-ai-draft-store.js` | Supabase 同期 · guest 拒否 · archived |
| `builder/builder-ai-page.js` | guest 保存非表示 · sync on init |
| `builder/builder-ai.html` | Supabase client + 新 script |
| `scripts/test-builder-ai-p2-b.mjs` | **新規** |
| `scripts/test-builder-ai-live-e2e.mjs` | **新規** |
| `scripts/test-builder-ai-live-qa.mjs` | e2e セクション |
| `scripts/test-builder-ai-p1-review.mjs` | guest draft ボタン非表示 |
| `reports/builder-ai-jwt-rls-design.sql` | staging SQL 参照追記 |

**変更なし:** `ai-model-gateway.js`, AI Core 契約, TASFUL AI / TLV / Talk / AI秘書

---

## 3. JWT claim 正本化方針（確定）

本番では Supabase `custom_access_token_hook` に以下を追加（P2-C で hook 拡張）:

```json
{
  "builder_actor_type": "owner|partner|admin",
  "builder_actor_id": "<canonical id>",
  "builder_owner_id": "<owner text id>",
  "builder_partner_id": "<partner key or uuid>",
  "builder_is_admin": false
}
```

クライアント解決順:

1. JWT session `app_metadata`（正本）
2. `TasuBuilderAIContext.resolveActor()`（dev fallback）

---

## 4. RLS policy staging 案

詳細: `sql/builder-ai-drafts-staging.sql`

検証観点（staging 適用後 · 人手/自動）:

- [ ] Guest INSERT/SELECT 拒否
- [ ] Owner が他社 project draft を見えない
- [ ] Partner が未参加 project draft を見えない
- [ ] Admin が全件 SELECT 可
- [ ] content 改ざん UPDATE 拒否（trigger）
- [ ] `is_draft=false` への UPDATE 拒否
- [ ] hidden / archived が一覧から除外

---

## 5. draft store fallback 方針

| 条件 | 動作 |
| --- | --- |
| Supabase 未設定 | localStorage のみ |
| 未ログイン | localStorage のみ |
| insert 失敗 | localStorage 保持 · ユーザー成功 |
| guest | 保存/一覧不可（RLS 整合） |
| content | `【下書き・確認用】` 必須 |

---

## 6. live Gateway E2E 準備状況

- 8 action マトリクス: `test-builder-ai-live-e2e.mjs`
- mock Gateway で surface/skipSearch/draft prefix/forbidden を自動検証
- 実 Edge は `BUILDER_AI_E2E_LIVE_EDGE=1` で切替
- QA チェックリスト: `reports/builder-ai-live-gateway-qa-checklist.md`

---

## 7. テスト結果

実施日: 2026-06-26

| コマンド | 結果 |
| --- | --- |
| `npm run build:pages` | **PASS** |
| `node scripts/test-builder-ai-p1.mjs` | **52/52 PASS** |
| `node scripts/test-builder-ai-p1-review.mjs` | **87/87 PASS** |
| `node scripts/test-builder-ai-p2-a.mjs` | **40/40 PASS** |
| `node scripts/test-builder-ai-p2-b.mjs` | **36/36 PASS** |
| `node scripts/test-builder-ai-live-qa.mjs` | **PASS**（チェックリスト生成） |
| `BUILDER_AI_E2E=1 node scripts/test-builder-ai-live-e2e.mjs` | **22/22 PASS**（mock Gateway · 8 action） |

---

## 8. 既存サービスへの影響

| サービス | 影響 |
| --- | --- |
| TASFUL AI / TLV / Platform / AI秘書 | **なし** |
| Gateway | **変更なし** |
| Talk AI drafts | **独立**（別 store） |
| Builder MVP 画面 | builder-ai.html のみ Supabase script 追加 |

---

## 9. P2-C 推奨スコープ

1. **staging DB に `builder-ai-drafts-staging.sql` 適用**（本番禁止）
2. **custom_access_token_hook 拡張** — builder_* claims 注入
3. **draft store の Supabase 正本化** — list/read を DB 優先に切替
4. **RLS 自動検証** — supabase test harness / service role なし JWT テスト
5. **Live Edge E2E** — `BUILDER_AI_E2E_LIVE_EDGE=1` CI ジョブ（staging のみ）
6. **MVP localStorage role 段階廃止** — 本番 URL から dev query 無効化

---

## 重要ルール（再確認）

- 本番 DB / RLS **未適用**
- Gateway 本体 **未変更**
- AI Core 契約 **未変更**
- Builder AI は TASFUL AI と **統合しない**
- すべての AI 出力は **下書き** · 契約/請求/採用/完了承認には使わない
