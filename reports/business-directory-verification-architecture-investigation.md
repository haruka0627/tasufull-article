# Business Directory — Verification Architecture 設計調査レポート

**日付:** 2026-07-01  
**種別:** 設計調査（**実装なし**）  
**SSOT:** [docs/architecture/business-directory-verification-architecture.md](../docs/architecture/business-directory-verification-architecture.md)

---

## 1. 調査目的

Business Directory に、掲載カテゴリごとの **本人確認 · 資格確認 · 許可確認 · 保険確認 · AI 審査補助** を追加するためのアーキテクチャを策定する。

---

## 2. 作成 / 更新ファイル

| ファイル | 操作 |
| --- | --- |
| `docs/architecture/business-directory-verification-architecture.md` | **新規** — 設計 SSOT |
| `reports/business-directory-verification-architecture-investigation.md` | **新規** — 本レポート |
| `docs/architecture/business-directory-architecture.md` | 更新 — Verification 参照 |
| `docs/business-directory-data-model-design.md` | 更新 — 将来テーブル参照 |

---

## 3. 基本方針（要約）

- Verification は **信頼性・安全性レイヤー** — サブスク課金条件ではない（AD-013）
- **最終承認は運営** — AI は補助のみ（AD-006）
- BD 専用 Edge + Admin — Builder Engine / TASFUL AI Gateway **統合しない**
- 既存 `review_requested` · `approve_listing` · `content_update` · `pending_updates` を **拡張**
- `page_content` / `blocks_json` **不使用**

---

## 4. Verification レベル

| Level | 一般店舗 | 業務サービス |
| --- | --- | --- |
| `basic` | デフォルト | — |
| `optional` | 法人番号任意 · API 準備前 | IT 等 |
| `required` | — | 建設 · 清掃等 |
| `api_verified` | 将来 API 可能時 | 法人 · 許可 DB 連携後 |

---

## 5. DB 設計案（要点）

| テーブル | 役割 |
| --- | --- |
| `business_directory_verification_rules` | カテゴリ別 level · 必須 check · 書類テンプレ |
| `business_directory_verification_requests` | 申請サイクル · AI 結果 · Ops  notes |
| `business_directory_verification_checks` | 項目/API 単位結果 |
| `business_directory_verification_documents` | private Storage 参照 |
| `listings.verification_*` 列 | Public badge キャッシュ |

詳細列定義 → SSOT §3。

---

## 6. AI 審査補助

**やる:** 漏れ指摘 · 形式チェック · カテゴリ矛盾 · スパム · risk_score · 推奨アクション（非確定）  
**やらない:** 自動承認 · 自動公開 · API なし真偽断定

---

## 7. 外部 API（将来）

Provider adapter: `manual` | `houjin` | `invoice` | `mlit` | `prefecture` | `digital_credentials`  
実装・接続は Phase V2 以降。

---

## 8. UI 案

| 側 | 要点 |
| --- | --- |
| Owner | チェックリスト · 書類 · 番号 · AI 不足ガイド |
| Admin | AI レポート · 書類 · チェックリスト · 既存 approve/reject |
| Public | badge のみ |

---

## 9. RLS / Security

- 書類 → **private bucket** · signed URL · Ops/owner のみ
- Public → badge / summary のみ
- audit_logs 拡張必須

---

## 10. Phase 分け

| Phase | 内容 |
| --- | --- |
| V1 | manual rules · AI checklist · Admin 補助 · badge |
| V2 | 法人/インボイス API · documents |
| V3 | 建設/古物/資格 API |
| V4 | renewal · fraud monitoring |

---

## 11. 既存設計整合

| 参照 | 結果 |
| --- | --- |
| `business-directory-architecture.md` | ✅ 境界一致 · Out of Scope 維持 |
| `business-directory-data-model-design.md` | ✅ `review_requests` / RLS 拡張 · `licenses_text` 共存 |
| `business-directory-db-architecture.md` | **ファイルなし** — data model 正本で代替 |
| Phase 3 Builder Lite（page renderer 3a–3f） | ✅ 公開表示のみ · Verification UI 分離 |
| content_update / pending_updates | ✅ 資格変更で re-verification |
| page_content / blocks_json | ✅ 不使用 |

---

## 12. 実施しなかったこと

migration · SQL · Supabase 変更 · 外部 API · Gateway 実装 · UI 実装 · Stripe 変更

---

## 13. TODO（次タスク）

1. Legal — 法人番号 API · 書類保存ポリシー  
2. Staging — V1 migration + private bucket リハーサル  
3. AI prompt SSOT — `docs/AI/BUSINESS_DIRECTORY_VERIFICATION.md`（未作成）  
4. Ops 差戻しテンプレ — Verification 不足コード  
5. カテゴリ seed 拡張 — 電気 · 古物 · 運送等

---

*詳細は [business-directory-verification-architecture.md](../docs/architecture/business-directory-verification-architecture.md) を正本とする。*
