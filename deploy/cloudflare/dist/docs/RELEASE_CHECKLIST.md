# TASFUL リリースチェックリスト

**最終更新:** 2026-06-26  
**用途:** 領域別の Go/No-Go ゲート。詳細手順は `docs/production-release-checklist.md` 等のレガシー doc も併用。

---

## 共通（全デプロイ）

- [ ] `npm run build:pages` PASS
- [ ] 秘密情報（API key · client secret）が diff に含まれない
- [ ] `deploy/cloudflare/dist` に意図したミラーのみ含む（`git add -A` 禁止）
- [ ] 凍結領域（TLV / Builder v1.0 / AI 秘書）— UI 変更が Critical/Security 以外でない

---

## AI コミット（`5ed9672` 以降の AI 変更）

- [ ] `node scripts/test-builder-ai-tools-adaptation.mjs` — 85/85
- [ ] `node scripts/test-builder-ai-p1-review.mjs` — 135/135
- [ ] `node scripts/test-platform-finish-phase.mjs` — 37/37
- [ ] `node scripts/test-platform-next-phase.mjs` — 37/37
- [ ] `node scripts/test-tasful-ai-final-phase.mjs` — 31/31
- [ ] `node scripts/test-ai-terms-disclaimer.mjs` — 32/32
- [ ] `node scripts/test-tlv-tasful-ai-entry.mjs` — 16/16
- [ ] `ai-model-gateway.js` を意図せず含めていない
- [ ] プローブ JSON/画像を含めていない

---

## Builder（Production Ready v1.0）

- [ ] `node scripts/check-builder-production-ready.mjs` PASS
- [ ] Builder AI 変更時 — isolation テスト（上記 AI 回帰）
- [ ] P2-C 前 — **本番 DB に staging SQL を流さない**

参照: `reports/builder-release-status.md`

---

## Platform（Production Ready）

- [ ] Platform NB-1M スモーク（該当スクリプト）PASS
- [ ] Content Gate / moderation 配線漏れなし（NB-1M スコープ）
- [ ] Google OAuth — Dashboard 設定 + staging E2E（[AI/PLATFORM_AI.md](./AI/PLATFORM_AI.md)）
- [ ] Featured カード · お気に入り DB — 未完了ならリリースノートに明記

参照: `reports/platform-nb1m-frontend-prod-deploy-ready.md`

---

## TLV（Production Ready v1.0 · FROZEN）

- [ ] TLV 変更時のみ — Playwright / QA 全 PASS
- [ ] TLV 専用 AI を追加していない（導線のみ）

参照: `reports/tlv-v1-production-ready/`

---

## AI 秘書（Production Ready · FROZEN）

- [ ] `admin-ai-secretary-*` 変更時 — secretary ブラウザ/回帰
- [ ] Gateway postUserCommand 契約を破っていない

参照: `reports/ai-ops-secretary-release-status.md`

---

## TASFUL AI Workspace（本番接続）

**Production Ready 判定: 現時点 NO**（preflight）

- [ ] Supabase Edge functions デプロイ（Vision · attachments）
- [ ] Gemini / Serper credits 正常
- [ ] 本番 URL で `ai-workspace.html` + JS MIME 確認（Access 考慮）
- [ ] 課金 enforcement 最小実装（任意だが PR 判定では P1）

参照: `reports/tasful-ai-production-preflight.md`

---

## コミット前（working tree 整理）

- [ ] 選別ステージング手順書に従う（`reports/ai-selected-staging-plan.md`）
- [ ] `git diff --cached --name-status` で除外ファイル混入チェック
- [ ] 440 件一括コミット **No Go**
