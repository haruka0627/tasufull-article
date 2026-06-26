# /test — 回帰テスト実行

変更スコープに応じた `scripts/test-*.mjs` を実行する。**存在確認してから実行。** 勝手にテスト修正しない。

## 事前確認

1. `git diff` / `git status --short` — 変更領域を特定
2. `package.json` · `scripts/` — テストファイルの存在確認
3. `.cursor/rules/qa.mdc`, `.cursor/rules/git.mdc` — 領域別テスト一覧
4. 該当 `docs/AI/*.md`

## 領域別テスト（存在するもののみ実行）

| 変更領域 | テスト候補 |
| --- | --- |
| Builder / Builder AI | `scripts/test-builder-ai-tools-adaptation.mjs`, `scripts/test-builder-ai-p1-review.mjs`, `scripts/check-builder-production-ready.mjs` |
| Platform | `scripts/test-platform-finish-phase.mjs`, `scripts/test-platform-next-phase.mjs` |
| TLV | `scripts/test-tlv-tasful-ai-entry.mjs` |
| TASFUL AI / Gateway / 免責 | `scripts/test-tasful-ai-final-phase.mjs`, `scripts/test-ai-terms-disclaimer.mjs` |
| AI 秘書 | `scripts/test-admin-ai-secretary-text-chat-browser.mjs` |
| 全体 / 不明 | 上記主要回帰 + 必要なら `npm run build:pages` |

```bash
node scripts/<test>.mjs
```

存在しないパスはスキップし理由を記載。

## 出力形式

### 実行テスト

- コマンド一覧（実行/スキップと理由）

### PASS / FAIL

| テスト | 結果 |
| --- | --- |

### 失敗ログ

- 失敗テストの出力抜粋

### 影響範囲

- 失敗が及ぶ製品/機能
- Production Ready リスク（AD-008）

### Go / No-Go

- **Go**: 対象テストすべて PASS
- **No-Go**: 1 件でも FAIL または未実行の必須テストあり

推奨 Subagent: `qa-agent`
