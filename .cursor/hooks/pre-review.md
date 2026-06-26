# pre-review — レビュー前チェック

**対応 Command:** `/review`  
**種別:** チェック専用 · 報告専用

## 実行内容

1. `git diff` / `git diff --cached`（name-status 要約）
2. `docs/DECISIONS.md` 照合（AD-001〜008）
3. `.cursor/rules/` · `.cursor/agents/` 担当境界

## 確認

- DECISIONS 違反（統合 · 専用 AI · Gateway · 凍結）
- Rules 違反
- Agent 境界違反（Builder / Platform / TLV / Secretary / TASFUL AI）
- 危険な削除（RLS · 免責 · Gateway 契約）
- 広すぎる変更（件数 · 無関係領域）

## 参照

- `.cursor/commands/review.md`
- `docs/KNOWN_ISSUES.md`

## 出力

- Blocking / High / Medium / Low
- Review Go / No-Go

## 禁止

- 自動修正 · stage · commit
