# TASFUL 既知の問題・未確認事項

**最終更新:** 2026-06-26  
**ルール:** 推測で「完了」にしない。解消したら項目を削除または「解決」に更新。

---

## KI-001 — `ai-model-gateway.js` 未コミット差分

| 項目 | 内容 |
| --- | --- |
| **状態** | working tree に +73 行程度の変更（mockReply · attachments 関連） |
| **方針** | AI フェーズでは Gateway 契約変更なし（AD-005） |
| **影響** | `5ed9672` には含まれず。本番接続・Vision とセットで判断 |
| **参照** | `reports/pre-commit-final-check.md`, `reports/ai-selected-staging-plan.md` |

---

## KI-002 — working tree 440 件

| 項目 | 内容 |
| --- | --- |
| **状態** | コミット `5ed9672` 後も 440 件残存 |
| **リスク** | 次の `git add -A` で ANPI / Live / Gateway 等が混入 |
| **対応** | [TODO.md](./TODO.md) P0-1 · 選別ステージングのみ |

---

## KI-003 — TASFUL AI Production Ready = NO

| 項目 | 内容 |
| --- | --- |
| **状態** | 機能は Final Phase 完了（`5ed9672`）。preflight 判定は **NO** |
| **ブロッカー例** | Edge Vision 未デプロイ · Gemini 429 · Serper 枯渇 · CF Access · 課金 enforcement 未実装 |
| **参照** | `reports/tasful-ai-production-preflight.md` §10–11 |
| **注** | 「完成済み」= 製品機能実装完了。「Production Ready」≠ 本番接続完了 |

---

## KI-004 — Platform 本番 FE 昇格のタイミング

| 項目 | 内容 |
| --- | --- |
| **状態** | NB-1M レポート時点で Production FE は旧 commit · G1/G2 No-Go 記載 |
| **矛盾** | PROJECT_STATUS は「Platform Production Ready」（製品品質）と「デプロイ未反映」を併記 |
| **対応** | 本番 deploy 前に `reports/platform-nb1m-frontend-prod-deploy-ready.md` を再確認 |

---

## KI-005 — Platform Finish 残（コード上）

| 項目 | 内容 |
| --- | --- |
| **未完了** | index featured バッジ · お気に入り Supabase 同期 · Google OAuth 実機 E2E |
| **参照** | `reports/platform-finish-phase.md` §9 |

---

## KI-006 — `supabase/functions/_shared/ai-attachments.ts` untracked

| 項目 | 内容 |
| --- | --- |
| **状態** | untracked · `5ed9672` 除外 |
| **関連** | KI-001 Gateway · TASFUL AI 本番 Vision |
| **未決** | UD-001 と同様にマージ判断待ち |

---

## KI-007 — `package.json` wrangler compatibility-date

| 項目 | 内容 |
| --- | --- |
| **状態** | unstaged · AI 無関係 |
| **内容** | `dev` スクリプトに `--compatibility-date=2026-06-24` |

---

## KI-008 — admin-ai-secretary 未コミット phase ファイル

| 項目 | 内容 |
| --- | --- |
| **状態** | working tree に `admin-ai-secretary-phase2.js` 等（untracked/modified） |
| **注** | AI 秘書本体は Production Ready（凍結）。phase ファイルは **別スコープ · 未コミット** |
| **未確認** | phase ファイルが v1.1 凍結を破る変更かどうか diff 未監査 |

---

## KI-009 — 本 `docs/` 正本は未コミット

| 項目 | 内容 |
| --- | --- |
| **状態** | 2026-06-26 作成 · git 未 add |
| **対応** | 内容確認後に別コミット |

---

## KI-010 — TLV ビジネスシミュレータ変更（AI スコープ外）

| 項目 | 内容 |
| --- | --- |
| **状態** | `reports/tlv-business-simulator/**` 等が working tree に modified |
| **対応** | AI コミットから除外済。別 PR または revert 判断 |

---

## KI-011 — dist 未コミット 248 件

| 項目 | 内容 |
| --- | --- |
| **状態** | `deploy/cloudflare/dist/` に AI スコープ外の untracked/modified が残存 |
| **対応** | 領域別 build + 選別 add。`git add -A` 禁止 |

---

## KI-012 — Builder AI 本番 DB / RLS

| 項目 | 内容 |
| --- | --- |
| **状態** | `sql/builder-ai-drafts-staging.sql` はコミット済みだが **DB 未適用**（staging も未実施の可能性） |
| **次** | P2-C — `reports/builder-ai-p2-b.md` §9 |

---

## 解決済み

| ID | 解決 |
| --- | --- |
| — | AI 186 件選別コミット `5ed9672` 完了（2026-06-26） |
