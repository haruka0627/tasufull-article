# /release — リリース前確認

本番反映前の Release Go/No-Go を判定する。**deploy / 本番反映は勝手に実行しない。**

## 必ず読む

- `docs/PROJECT_STATUS.md`
- `docs/CHANGELOG.md`
- `docs/KNOWN_ISSUES.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/DECISIONS.md` AD-008, AD-009

## 必ず実行

```bash
git status --short
git log --oneline -10
```

## 確認対象

1. **build 結果** — `npm run build:pages` PASS（未実行なら実行して報告）
2. **主要回帰** — リリース対象領域の `scripts/test-*.mjs` PASS
3. **Cloudflare / deploy** — `deploy/cloudflare/` · `deploy/cloudflare/dist/` · `_redirects` の整合（反映はしない）
4. **凍結遵守** — Builder v1.0 · Platform · TLV · AI 秘書の変更理由
5. **TASFUL AI** — 機能完成 ≠ Production Ready（preflight 確認）

## 参照

- `.cursor/rules/git.mdc`, `.cursor/rules/qa.mdc`
- `.cursor/agents/release-agent.md`, `.cursor/agents/qa-agent.md`

## 出力形式

### Release Go / No-Go

- **Go** / **No-Go** — 1 文理由

### リリース対象

- 製品/領域 · 含めるコミット/ファイル範囲

### 未解決リスク

- KI 番号 · AD 例外 · テスト未 PASS · working tree 混在

### ロールバック方針

- revert 対象 commit · dist 復旧手順（概要）

### 本番反映前チェックリスト

- [ ] build PASS
- [ ] 領域回帰 PASS
- [ ] CHANGELOG / PROJECT_STATUS 更新
- [ ] KNOWN_ISSUES 確認
- [ ] 選別ステージング（`git add -A` 禁止）
- [ ] Cloudflare Pages 反映は人手承認後

deploy · wrangler publish · 本番 DB 操作 — **実行禁止**（提案のみ）。
