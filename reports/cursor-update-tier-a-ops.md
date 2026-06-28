# Cursor 3.9 Tier A — 運用改善（TASFUL）

**日付:** 2026-06-28  
**目的:** Customize / Bugbot / `/review` / Indexing 向けの安全な Tier A 導入  
**スコープ:** `.cursorignore` · `.cursor/BUGBOT.md` · 既存 command/hook 最小整合

---

## 実施内容

| # | 項目 | 結果 |
| --- | --- | --- |
| 1 | `.cursorignore` 更新 | 完了 |
| 2 | `.cursor/BUGBOT.md` 追加 | 完了 |
| 3 | `/review` 整合 | `review.md` · `pre-review.md` に BUGBOT 参照を1行追加 |
| 4 | Rules / Agents 改変 | **なし**（`.mdc` · `agents/*.md` 未変更） |
| 5 | Cloud / Worktrees / MCP | **未導入**（スコープ外） |

---

## 変更ファイル一覧

| ファイル | 操作 |
| --- | --- |
| `.cursorignore` | 更新 |
| `.cursor/BUGBOT.md` | 新規 |
| `.cursor/commands/review.md` | 最小更新（BUGBOT 参照） |
| `.cursor/hooks/pre-review.md` | 最小更新（BUGBOT 参照） |
| `reports/cursor-update-tier-a-ops.md` | 本レポート |

---

## `.cursorignore` 除外対象

| カテゴリ | パターン |
| --- | --- |
| 依存 | `node_modules/` |
| Wrangler / dist 生成物 | `.wrangler/`, `deploy/cloudflare/dist/`, `dist/.wrangler/`, `dist/.dev.vars` |
| キャッシュ / カバレッジ | `coverage/`, `.cache/`, `deno.lock` |
| レポート画像 | `reports/**/screenshots/`, `reports/**/*.png|jpg|webp`, `screenshots/` |
| Secret / ローカル生成 config | `.env`, `.env.local`, `live-zego-config.js`, dist 内 zego config |
| セッション | `reports/gate-d-auth-storage.json` |
| 一時 | `.tmp-*.sql`, `supabase/.temp/`, `.tmp.driveupload/`, `backups/` |

**インデックス対象のまま（除外しない）:** `docs/`, `scripts/`, `deploy/cloudflare/functions/`, `platform-live/`, `builder/`, `live/`（ソース）, `reports/*.md`, `reports/*.json`

---

## BUGBOT.md レビュー方針（要約）

1. **Blocking:** `git add -A` 禁止 · Secret 露出 · Production 設定 · Gateway 契約 · AI 統合違反（AD-002〜005） · 凍結領域の機能追加
2. **領域境界:** Builder / Platform / TLV / TASFUL AI / 秘書 / Platform Live — クロス変更を High で flag
3. **8788 検証:** `file://` 無効 · 完了報告は HTTP/Console/Viewport 必須
4. **dist:** 主レビュー対象にしない · 意図しない dist 直編集を flag
5. **UI:** current vs target/reference スクショ比較必須
6. **Playwright:** 状態ベース wait 優先 · 固定 sleep 回避 · 進行中 UI 文言の誤 PASS 防止
7. **docs:** DECISIONS 優先 · 推測完了禁止

正本は引き続き `.cursor/rules/` と `docs/DECISIONS.md`。

---

## `/review` 運用上の注意

| 項目 | 内容 |
| --- | --- |
| **Command** | `.cursor/commands/review.md` — diff レビュー · 修正は報告のみ |
| **Hook** | `beforeSubmitPrompt` → `/review` 時に `pre-review` チェック起動 |
| **Bugbot 連携** | Cursor 3.7+ pre-push `/review` は `.cursor/BUGBOT.md` を PR レビュー方針として参照可能 |
| **二重ガード** | Hook（pre-review）+ Command（review）+ BUGBOT.md（PR/Bugbot）— 内容は整合、役割分担 |
| **変更なし** | `hooks.json` · `block-dangerous-shell.mjs` · agents 定義 |
| **Auto-review** | Windows では sandbox 制限あり — 危険 shell は従来どおり hook + 手動承認 |

### 推奨フロー

1. 選別 `git add`（AD-007）
2. `/review` または Cursor pre-push `/review`
3. Blocking/High 解消後に commit（ユーザー明示指示時のみ）

---

## 既存 Rules / Agents への影響

- **`.cursor/rules/*.mdc`:** 未変更
- **`.cursor/agents/*.md`:** 未変更
- **`.cursor/hooks.json`:** 未変更
- **追加のみ:** BUGBOT.md が rules の PR 向けミラー

---

## ZEGO 作業へ戻れる状態か

**はい。** 本スコープは `.cursor/` 運用ファイルのみ。ZEGO 実装 · `_headers` 修正 · platform-live ソースは未触。8788 dev / publish blocker GO 状態は維持。

---

## 未実施（意図的 · Tier B/C）

- Cloud Agents / Automations
- Worktrees / `.cursor/environment.json`
- Skills 移行 / Customize ページの一括再構成
- MCP 新規追加
