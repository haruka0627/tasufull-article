# TASFUL プロジェクトステータス

**最終更新:** 2026-06-26  
**Git HEAD:** `5ed9672`（`cf-pages-deploy`）  
**直近 AI コミット:** `5ed9672` — `feat(ai): Builder AI, Platform finish, TASFUL AI final, and AI terms`（186 files）

---

## 製品別サマリー

| 領域 | ステータス | 備考 |
| --- | --- | --- |
| **Builder** | **Production Ready** | v1.0 · RELEASE FROZEN（`reports/builder-release-status.md`） |
| **Builder AI** | **実装済み** | コミット `5ed9672`。TASFUL AI と**統合しない** |
| **Platform** | **Production Ready** | NB-1M 系スモーク PASS 記録あり。FE 本番昇格・一部 AI 仕上げは残タスク |
| **Platform AI** | **入口接続済** | 専用 AI エンジンなし · TASFUL AI 利用 |
| **TLV** | **Production Ready** | v1.0 · FEATURE FROZEN（`reports/tlv-release-status.md`） |
| **TLV AI** | **導線のみ** | TLV 専用 AI なし · `live/tlv-tasful-ai-entry.js` → Workspace |
| **AI 秘書** | **Production Ready** | RELEASE FROZEN（`reports/ai-ops-secretary-release-status.md`） |
| **TASFUL AI** | **機能完成 · 本番接続未完** | Final Phase 実装済み（`5ed9672`）。本番 E2E / 課金 / Edge は未達 |

---

## AI コミット `5ed9672` の内容

| カテゴリ | 件数（概算） |
| --- | --- |
| AI 規約 / 免責 | 6 |
| TASFUL AI Workspace / Final | 21 |
| Builder AI | 24 |
| Platform AI 配線 | 29 |
| テスト | 10 |
| レポート | 18 |
| `deploy/cloudflare/dist` ミラー | 80 |

**コミット時回帰:** 373/373 PASS（7 スイート）。根拠: `reports/pre-commit-final-check.md`, `reports/ai-selected-staging-result.md`

**意図的に含めなかったもの:** `ai-model-gateway.js`, `package.json`, `supabase/functions/_shared/ai-attachments.ts`, ANPI, Live（TLV 入口除く）, admin-ai-secretary 等

---

## Working tree（コミット後）

| 区分 | 件数 |
| --- | --- |
| **合計** | **440** |
| unstaged 変更 | 196 |
| unstaged 削除 | 1 |
| untracked | 243 |

内訳: `reports/ai-selected-staging-result.md` §8 参照。整理方針は [TODO.md](./TODO.md)。

---

## テスト基準（AI 回帰 · コミット `5ed9672` 時点）

```bash
npm run build:pages
node scripts/test-builder-ai-tools-adaptation.mjs      # 85/85
node scripts/test-builder-ai-p1-review.mjs             # 135/135
node scripts/test-platform-finish-phase.mjs            # 37/37
node scripts/test-platform-next-phase.mjs              # 37/37
node scripts/test-tasful-ai-final-phase.mjs            # 31/31
node scripts/test-ai-terms-disclaimer.mjs              # 32/32
node scripts/test-tlv-tasful-ai-entry.mjs              # 16/16
```

---

## 関連ドキュメント

- 次タスク → [TODO.md](./TODO.md)
- 方針 → [DECISIONS.md](./DECISIONS.md)
- 未解決 → [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)
