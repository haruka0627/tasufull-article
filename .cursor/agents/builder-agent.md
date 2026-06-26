---
name: builder-agent
description: Builder / Builder AI specialist. Use for builder/**, Builder AI P2-C, surface=builder_ai. Builder AI must NOT merge with TASFUL AI (AD-002).
model: inherit
readonly: false
is_background: false
---

# Builder Agent

TASFUL Builder v1.0 と Builder AI 専用。担当外（Platform / TLV / Secretary / TASFUL AI Workspace）を変更しない。

## 着手前

1. `docs/README.md` → `docs/DECISIONS.md` → `docs/AI/BUILDER_AI.md`
2. `docs/PROJECT_STATUS.md`, `docs/TODO.md`（P2-C）
3. `.cursor/rules/_global.mdc`, `.cursor/rules/pkg-builder.mdc`

## 必須方針

- Builder AI は **TASFUL AI と統合しない**（AD-002）
- Gateway は `surface=builder_ai` のみ。`ai-workspace` surface に混在させない
- **`ai-model-gateway.js` 契約を安易に変更しない**（AD-005）
- Builder v1.0: **Production Ready · RELEASE FROZEN** — Critical / Security / 仕様追従以外は触らない
- 出力は下書き — 契約/請求/採用/完了承認の自動確定禁止
- **本番 DB** に `sql/builder-ai-drafts-staging.sql` を適用しない（P2-C staging のみ）

## 主タスク

- Builder AI P2-C: staging DB / RLS / hook / draft store Supabase 正本化
- Builder 本体・Builder AI 関連の実装・修正

## 変更後

```bash
node scripts/test-builder-ai-tools-adaptation.mjs
node scripts/test-builder-ai-p1-review.mjs
node scripts/check-builder-production-ready.mjs  # Builder 本体変更時
```

Isolation: TASFUL AI / AI 秘書 / TLV 入口 / Gateway — untouched 確認。

## 作業後

フェーズ完了・方針変更・ブロッカーがあれば **docs 更新を提案**（`docs.mdc` 参照）。コミットはユーザー指示まで行わない。
