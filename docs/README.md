# TASFUL 開発ドキュメント（正本）

**最終更新:** 2026-06-26  
**目的:** 「次に何をやるか」「どこまで終わったか」「何を決定したか」を、会話ログではなく **リポジトリ内** から確認する。

---

## この `docs/` について

| ファイル | 用途 |
| --- | --- |
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | **現状スナップショット**（製品別ステータス・直近コミット） |
| [TODO.md](./TODO.md) | **次にやること**（優先順・担当領域） |
| [ROADMAP.md](./ROADMAP.md) | 中長期のフェーズと完了/未完了 |
| [DECISIONS.md](./DECISIONS.md) | **決定事項**（アーキテクチャ・統合方針） |
| [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) | リリース前ゲート |
| [CHANGELOG.md](./CHANGELOG.md) |  notable 変更履歴 |
| [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) | 未解決・要確認・矛盾の記録 |

### AI 領域（詳細）

| ファイル | 用途 |
| --- | --- |
| [AI/TASFUL_AI.md](./AI/TASFUL_AI.md) | TASFUL AI Workspace（総合 AI） |
| [AI/BUILDER_AI.md](./AI/BUILDER_AI.md) | Builder 専用 AI |
| [AI/PLATFORM_AI.md](./AI/PLATFORM_AI.md) | Platform → TASFUL AI 入口 |
| [AI/SECRETARY_AI.md](./AI/SECRETARY_AI.md) | AI 運営秘書 |
| [AI/TLV_AI.md](./AI/TLV_AI.md) | TLV → TASFUL AI 導線 |

---

## 一次情報（フェーズレポート）

実装の詳細・テスト結果は `reports/` に残る。正本は **本 `docs/`**、根拠・差分の深掘りは reports を参照。

| レポート | 内容 |
| --- | --- |
| `reports/ai-selected-staging-result.md` | AI 選別コミット `5ed9672` の結果 |
| `reports/ai-selected-staging-plan.md` | 選別ステージング手順 |
| `reports/pre-commit-final-check.md` | コミット前回帰（373/373 PASS） |
| `reports/builder-ai-*.md` | Builder AI 設計・P1/P2 |
| `reports/platform-finish-phase.md` | Platform バッジ・お気に入り・AI 入口 |
| `reports/tasful-ai-final-phase.md` | TASFUL AI Final（履歴・メディア・資料） |
| `reports/tasful-ai-production-preflight.md` | 本番接続 preflight（Production Ready: NO） |

---

## レガシー / 領域別チェックリスト

`docs/` 直下の既存ファイル（Talk / Anpi / デプロイ手順等）は引き続き有効。本 README の正本セットと **矛盾する場合は本 README 配下のステータス系を優先**し、差分は [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) に記録する。

例: `docs/production-release-checklist.md`, `docs/local-dev.md`, `docs/anpi-*`

---

## 更新ルール

1. フェーズ完了・方針決定 → `PROJECT_STATUS.md` + 該当 `AI/*.md` + `DECISIONS.md`
2. 次タスク確定 → `TODO.md` + `ROADMAP.md`
3. コミット・リリース → `CHANGELOG.md`
4. 未確認・ブロッカー → `KNOWN_ISSUES.md`
5. **推測で「完了」にしない** — 根拠（コミット・テスト・レポート）が無い場合は KNOWN_ISSUES へ
