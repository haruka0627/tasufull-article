# /docs — docs 正本整合性チェック

`docs/` 正本の古さ・矛盾・漏れを検出する。**コード変更は原則しない。** 必要なら docs 修正案のみ提示。

## 確認対象（すべて読む）

- `docs/README.md`
- `docs/PROJECT_STATUS.md`
- `docs/TODO.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/CHANGELOG.md`
- `docs/KNOWN_ISSUES.md`
- `docs/AI/*.md`

## 参照

- `.cursor/rules/docs.mdc`
- `git log --oneline -10` — CHANGELOG / PROJECT_STATUS と HEAD の整合

## 検出目的

| 観点 | 確認内容 |
| --- | --- |
| 古い記述 | 日付・ステータスが HEAD / working tree と矛盾 |
| 矛盾 | README vs PROJECT_STATUS vs TODO vs AI/*.md |
| TODO 未反映 | 完了済みタスクが TODO に残存 |
| CHANGELOG 漏れ | 直近コミットが CHANGELOG 未記載 |
| DECISIONS 違反 | コード/計画が AD-001〜009 に反する記述 |
| AI 仕様不一致 | `docs/AI/*.md` と DECISIONS / rules の surface 境界 |

## 出力形式

### サマリー

- 整合: OK / 要修正 / 未確認

### 指摘一覧

各項目: **ファイル** · **深刻度**（Blocking / High / Medium / Low）· **内容** · **修正案**（パッチ案または追記文）

### docs 更新提案

- 更新すべきファイル一覧（ユーザー承認後に実施）
- 更新不要なら理由

### Go / No-Go

- **Go**: docs 正本は作業判断に使える
- **No-Go**: Blocking あり — 先に docs 修正が必要

ファイル編集はユーザー指示まで行わない。
