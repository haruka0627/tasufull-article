# post-build — build 後チェック

**対応 Command:** `/build`（`npm run build:pages` 実行後に発火）  
**種別:** チェック専用 · 報告専用

## トリガー

`afterShellExecution` — コマンドに `build:pages` を含む場合

## 確認

- build 成功/失敗（終了出力）
- build により `deploy/cloudflare/dist/` が変化したか
- 生成物をコミット対象に含めるべきか（AD-009 · 選別 stage）
- 失敗時の原因候補
- 次に実行すべき回帰テスト（変更スコープ別）

## 参照

- `docs/DECISIONS.md` AD-009
- `.cursor/commands/build.md` · `.cursor/commands/test.md`

## 出力

- Build PASS / FAIL
- 生成物差分
- 次の回帰候補
- Go / No-Go

## 禁止

- 自動 stage · commit · deploy
- build 失敗時の勝手なコード修正
