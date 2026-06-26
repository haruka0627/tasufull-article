# pre-release — リリース前チェック

**対応 Command:** `/release`  
**種別:** チェック専用 · 報告専用

## 実行内容

1. `git status --short`
2. `git log --oneline -10`
3. `docs/PROJECT_STATUS.md` · `docs/CHANGELOG.md` · `docs/KNOWN_ISSUES.md` 存在確認

## 必須確認

- build 結果があるか（`npm run build:pages` — `/build`）
- 主要回帰結果があるか（`/test`）
- 未解決 issue がリリース阻害か（KI 番号）
- CHANGELOG 更新済みか
- rollback 方針があるか
- deploy 対象が明確か

## 参照

- `docs/RELEASE_CHECKLIST.md`
- `docs/DECISIONS.md` AD-008, AD-009
- `.cursor/commands/release.md`

## 出力

- Release Go / No-Go
- 未解決リスク
- 本番反映前チェックリスト
- Rollback 方針

## 禁止

- **deploy / wrangler publish / production apply は実行禁止**
