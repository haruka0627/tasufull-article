# AI 運営秘書（Secretary AI）

**最終更新:** 2026-06-26  
**ステータス:** **Production Ready** · RELEASE FROZEN  
**確定日:** 2026-06-17

---

## 概要

AI 運営秘書は **TASFUL 運営 OPS 専用**（`admin-operations-dashboard` 系）。Builder AI · TASFUL AI Workspace · Platform 入口とは **独立**。

| 項目 | 内容 |
| --- | --- |
| **リリース** | RELEASE OK · **RELEASE FROZEN** |
| **P0 / P1** | なし（2026-06-17 時点） |
| **本番接続レビュー** | PASS（要修正 0） |

---

## スコープ

| 担当 | 非担当 |
| --- | --- |
| Inbox · Connect triage · OPS 支援 | Builder 案件文案 |
| 運営ダッシュボード AI | Platform 掲載マッチング |
| Action Registry / postUserCommand | TASFUL AI 一般チャット |

---

## AI コミット `5ed9672` との関係

| 項目 | 内容 |
| --- | --- |
| **含む** | なし — secretary ファイルは意図的に除外 |
| **working tree** | `admin-ai-secretary-phase*.js` 等が **未コミット** で存在（[KNOWN_ISSUES.md](../KNOWN_ISSUES.md) KI-008） |
| **未確認** | phase ファイルが v1.1 凍結と矛盾するか — diff 監査待ち |

---

## テスト（参考）

| スクリプト | 備考 |
| --- | --- |
| `scripts/test-admin-ai-secretary-text-chat-browser.mjs` | pre-commit 時 PASS（6 checks）— `5ed9672` 外 |

---

## 変更ルール（凍結）

- **許可:** Critical Bug · Security · Supabase 仕様追従
- **禁止:** 新機能 · UI 変更（v1.1 計画まで）

---

## 関連

- [TASFUL_AI.md](./TASFUL_AI.md) — 一般 Workspace（別製品）
- [BUILDER_AI.md](./BUILDER_AI.md) — Builder 専用（別 surface）

**レポート:** `reports/ai-ops-secretary-release-status.md`, `reports/ai-secretary-text-chat-first.md`（未コミット）
