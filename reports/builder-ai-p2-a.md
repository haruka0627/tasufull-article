# Builder AI P2-A — 実装レポート

実施日: 2026-06-26  
スコープ: **P2-A のみ**（DB 本番適用・RLS 本番適用なし）

---

## 判定

P1 Review の **Conditional Go** 条件のうち、P2-A 範囲は **完了**。

| 完了条件 | 状態 |
| --- | --- |
| 法規・安全・構造系 forbidden intent のクライアントブロック | ✅ |
| draft 保存/履歴の最小導線 | ✅ |
| JWT/RLS 正本化案の整理 | ✅ |
| live Gateway QA の準備 | ✅ |
| 本レポート | ✅ |

---

## 1. 実装内容

### 1.1 禁止 intent 拡張（`builder-ai-core.js`）

`detectProhibitedIntent()` を **operational / expert** の 2 系統に拡張。

| kind | 例 | 返答 |
| --- | --- | --- |
| `operational` | 採用確定・契約成立・請求確定・支払指示・完了承認 | 既存 `PROHIBITED_REPLY`（確定処理不可） |
| `expert` | 法的判断・建築基準法・構造/耐震・資格工事・重大リスク・断定表現・無資格施工 | `EXPERT_JUDGMENT_REPLY` |

Expert ブロック時の返答（固定）:

> この内容はAIだけでは判断できません。運営または有資格者・専門家による確認が必要です。

Gateway はブロック時 **未呼び出し**（P1 と同様）。

### 1.2 draft 永続化（最小）

- `builder-ai-draft-store.js` — localStorage `tasu_builder_ai_drafts_v1`
- UI: 「下書きに保存」ボタン + 下書き履歴パネル（コピー・非表示）
- 保存条件: 内容に `【下書き・確認用】` を含むこと
- 可視性: `actor_type` + `actor_id` 一致のみ（admin は全件参照可）
- 非表示: `hidden: true`（削除相当 · 物理削除 API も `deleteDraft` で用意）

### 1.3 JWT / RLS 正本化（設計のみ）

- 現状の role 解決: URL `?role=` → sessionStorage → localStorage `tasful:builder:mvp:role`
- partnerId: URL → localStorage `tasful:builder:mvp:partner_id`
- ownerId: MVP state `owner_id`
- 将来 JWT claims と RLS policy 案: `reports/builder-ai-jwt-rls-design.sql`（**未実行**）

### 1.4 Live Gateway QA 準備

- `scripts/test-builder-ai-live-qa.mjs` — チェックリスト生成 + 静的契約確認
- `reports/builder-ai-live-gateway-qa-checklist.md` — 人手 QA 用

---

## 2. 変更ファイル

| ファイル | 変更 |
| --- | --- |
| `builder/builder-ai-core.js` | 禁止 intent 拡張 · VERSION 1.1.0-p2a |
| `builder/builder-ai-draft-store.js` | **新規** draft localStorage |
| `builder/builder-ai-page.js` | 保存/履歴 UI |
| `builder/builder-ai.html` | draft セクション · script 追加 |
| `builder/builder.css` | draft スタイル |
| `scripts/test-builder-ai-p1-review.mjs` | expert ブロック期待値更新 · UI draft 確認 |
| `scripts/test-builder-ai-p2-a.mjs` | **新規** P2-A テスト |
| `scripts/test-builder-ai-live-qa.mjs` | **新規** live QA チェックリスト |
| `reports/builder-ai-jwt-rls-design.sql` | **新規** RLS 設計案（実行禁止） |
| `reports/builder-ai-live-gateway-qa-checklist.md` | QA チェックリスト（生成物） |

**変更なし（遵守）:** `ai-model-gateway.js`, `ai-workspace-chat.js`, admin AI 秘書, AI Core 契約

---

## 3. 禁止 intent 拡張一覧

| ID | カテゴリ | パターン概要 |
| --- | --- | --- |
| `legal_judgment` | 法的判断 | 適法/違法断定 · 違法ではない |
| `building_code` | 建築基準法 | 問題ない · 適合 |
| `structural_safety` | 構造安全 | 構造上安全/大丈夫 |
| `seismic` | 耐震 | 耐震性 問題ない/十分/適合 |
| `licensed_trades` | 資格工事 | 電気/ガス/水道施工可否 · 資格不要施工 |
| `major_risk` | 重大リスク | 事故/火災/漏電/ガス漏れ/雨漏り/倒壊 + 安全断定 |
| `absolute_claims` | 断定表現 | 絶対大丈夫 · 必ず安全 · 断言/保証 |
| `unqualified_work` | 無資格施工 | 無資格/資格なし + 施工/工事 |
| （既存 operational 6 件） | 確定操作 | 採用/契約/請求/支払/完了/返金BAN |

---

## 4. JWT / RLS 正本化案

### 4.1 現在の取得経路

| 項目 | 取得経路（MVP） |
| --- | --- |
| `actor_type` / role | URL → sessionStorage → localStorage |
| `partnerId` | URL → localStorage |
| `ownerId` | MVP state `owner_id` |
| `actor_id` | role 別: partner→partnerId, owner→ownerId, admin→"admin", guest→"guest" |

### 4.2 将来 JWT claim で正本化すべき項目

| Claim | 用途 |
| --- | --- |
| `sub` | 認証ユーザー ID |
| `role` | admin / owner / partner / guest |
| `builder_owner_id` | owner スコープ |
| `partner_id` | partner スコープ |

### 4.3 Supabase RLS で守るべきテーブル

| テーブル | Builder AI |
| --- | --- |
| `builder_ai_drafts`（新規） | INSERT/SELECT/UPDATE(hidden)/DELETE |
| `projects`, `specs`, `threads`, `applications` | **READ のみ**（既存 ACL と同等） |
| 契約・請求・採用・完了 | Builder AI から **書込不可** |

### 4.4 Builder AI 読める / 書ける範囲

| 操作 | 範囲 |
| --- | --- |
| READ 案件コンテキスト | `canAccessProject` 同等（guest 不可） |
| WRITE | `builder_ai_drafts` のみ · `is_draft=true` · prefix 必須 |

### 4.5 Policy 案（Admin / Partner / Owner / Guest）

詳細 SQL: `reports/builder-ai-jwt-rls-design.sql`

- **Guest**: draft 自分のみ · 案件 READ 不可
- **Owner**: 自 `owner_id` 案件 READ · 自 draft CRUD（hidden）
- **Partner**: 関係案件 READ · 自 draft CRUD
- **Admin**: 全案件 READ · 全 draft 参照 · 確定操作は依然不可

### 4.6 draft 行の持ち方

```text
actor_id, actor_type, project_id, thread_id, action, content, created_at, hidden
```

- `content` は常に `【下書き・確認用】` で開始
- `action` は 8 action ID のいずれか
- 契約・請求・採用・完了承認には紐付けない

---

## 5. draft 永続化の現状

| 項目 | 実装 |
| --- | --- |
| ストレージ | localStorage（P2-B で Supabase 移行） |
| 保存 | 直近 assistant 回答を「下書きに保存」 |
| 履歴 | ロール別フィルタ一覧 |
| 再コピー | 履歴行のコピーボタン |
| 非表示 | `hideDraft` |
| 制約 | 非 draft 本文は拒否 · 最大 50 件 |

---

## 6. QA チェックリスト

実行:

```bash
node scripts/test-builder-ai-live-qa.mjs
```

確認対象:

- 8 action の live 出力（【下書き・確認用】）
- forbidden intent（expert / operational）の live ブロック
- actor_type 別出力制限
- `surface: builder_ai`, `skipSearch: true`
- TASFUL AI / TLV / Platform / AI秘書への影響なし

成果物: `reports/builder-ai-live-gateway-qa-checklist.md`

---

## 7. テスト結果

実施日: 2026-06-26

| コマンド | 結果 |
| --- | --- |
| `npm run build:pages` | **PASS** |
| `node scripts/test-builder-ai-p1.mjs` | **52/52 PASS** |
| `node scripts/test-builder-ai-p1-review.mjs` | **87/87 PASS**（Playwright UI 含む） |
| `node scripts/test-builder-ai-p2-a.mjs` | **40/40 PASS** |
| `node scripts/test-builder-ai-live-qa.mjs` | **PASS**（チェックリスト生成 + 静的契約 5/5） |

P2-A 追加観点:

- 法規 / 安全 / 構造 / 資格工事系 forbidden intent → クライアントブロック ✅
- draft 保存 · 履歴 · 非表示 · role 別 visibility ✅
- Gateway 契約（surface / skipSearch）非破壊 ✅

---

## 8. 既存サービスへの影響

| サービス | 影響 |
| --- | --- |
| TASFUL AI Workspace | **なし**（surface 分離 · コード非参照） |
| AI 秘書 / TLV | **なし** |
| Gateway 本体 | **変更なし** |
| construction-tools `BuilderAIEngine.analyze()` | **変更なし** |
| MVP Builder 画面 | draft UI は `builder-ai.html` のみ |

---

## 9. P2-B 推奨スコープ

1. **Supabase `builder_ai_drafts` テーブル作成 + RLS 適用**（ステージング first）
2. **JWT 正本化** — MVP localStorage role を Supabase session claims に置換
3. **Live Gateway E2E** — Playwright + `BUILDER_AI_QA_LIVE=1`
4. **draft 同期** — localStorage → DB マイグレーション / 競合解決
5. **Edge context API** — 案件コンテキストを DB から redact 取得（MVP state 卒業）
6. **regex チューニング** — live 出力 QA に基づく false positive/negative 調整

---

## 重要ルール（再確認）

- Builder AI は TASFUL AI と統合しない
- 新 Gateway は作らない · Gateway 本体は変更しない
- AI Core 契約は変更しない
- DB/RLS 本番適用は P2-A では行わない
- すべての AI 出力は下書き扱い
- 確定・承認・請求・契約・法的判断・安全判断は行わない
