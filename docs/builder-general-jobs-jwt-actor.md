# Builder 一般案件 — JWT Actor（RL-03）

**対象:** 本番ホストでのロール / actor 解決  
**実装変更:** なし（既存 `builder-actor-identity.js` 正本）

---

## 1. 原則

| 環境 | ロール正本 | partner_id 正本 |
| --- | --- | --- |
| **本番** (`isProductionHost`) | Supabase JWT · deal 参加者 | `talk_user_id` / actorId |
| **ローカル / Staging dev** | URL `?role=` · localStorage（検証用ロール） | `?partner_id=` · localStorage |

P3 で本番ホストは **demo ロールメニュー非表示**（`renderMvpRole`）。

---

## 2. モジュール

| ファイル | 役割 |
| --- | --- |
| `builder/builder-actor-identity.js` | `getViewRole` · `getBuilderActor` · `isProductionHost` |
| `builder/builder.js` | `getRole()` / `getPartnerId()` — prod 時 identity 委譲 |
| `builder/builder-session.js` | `resolveOwnerIdForInsert` · `getApplicantAuthUid` |

---

## 3. 一般案件での actor

| 操作 | owner_id / applicant |
| --- | --- |
| 投稿 | `owner_id = auth.uid()::text` |
| 応募 | `applicant_auth_uid = auth.uid()::text` + `partner_key` |
| 選定/却下 | 案件 owner の JWT |
| 取り下げ | 応募者 JWT（DELETE RLS P3） |

---

## 4. 本番接続前チェックリスト

- [ ] 未ログイン時は投稿/応募不可（UI + RLS）
- [ ] `?role=partner` URL だけで本番が切り替わらない
- [ ] `commitBoardApplicationDecision` は owner actor のみ
- [ ] Talk UUID notify は `chat-detail.html?thread={UUID}` 維持

---

## 5. 検証

ローカル: `http://127.0.0.1:8788` + Staging 認証（RL-02）  
本番: デプロイ後に JWT ログインで手動 smoke（人間）

**参照:** `docs/builder-general-jobs-repository-plan.md` §3 Auth
