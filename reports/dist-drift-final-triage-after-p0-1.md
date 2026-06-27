# Dist Drift Final Triage — after P0-1

**実施日:** 2026-06-28  
**Git HEAD:** `28b1fdd` — `test(builder): refresh builder ai qa report for local server`  
**スコープ:** `deploy/cloudflare/dist/**` のみ · 調査・分類（**build / deploy / git add / commit なし**）  
**前提:** P0-1 reports/scripts 小束（A–P）完了 · 残 working tree **42 行 = dist のみ**

---

## 1. サマリー

| 項目 | 値 |
| --- | --- |
| **dist drift 総数（status 行）** | **42**（Modified **24** · Untracked **18**） |
| **実質コンテンツ差分あり（M）** | **6** |
| **CRLF  phantom のみ（M）** | **17**（`docs/*.md` + `deploy-git-stage-manifest.json`） |
| **build 後ミラー（??）** | **18 行**（物理ファイル約 **24** · `docs/AI/` 7 含む） |
| **一括 dist commit** | ❌ **No-Go**（領域混在 · AD-007） |

### 領域別件数（status 行）

| 領域 | M | ?? | 計 | 備考 |
| --- | ---: | ---: | ---: | --- |
| **BD** | 1 | 0 | **1** | `member-auth.js` |
| **Builder** | 2 | 0 | **2** | `builder-ai.html` · `user-dashboard.html` |
| **AI秘書 / admin** | 1 | 0 | **1** | `admin-operations-dashboard.html` |
| **voice-core（TASFUL AI Voice）** | 2 | 0 | **2** | transport JS · test HTML |
| **docs mirror** | 17 | 15 | **32** | 17=M phantom · 15=?? 未ミラー |
| **TASFUL AI sql / chat config** | 0 | 3 | **3** | `chat-supabase-config.js` · sql×2 |
| **Platform** | 0 | 0 | **0** | 直接 drift なし |
| **TLV / live** | 0 | 0 | **0** | 直接 drift なし |
| **横断 build 注入** | — | — | — | robots meta · site-assistant（Builder/admin 等に付与） |

---

## 2. Modified 24 件 — 詳細分類

### 2.1 実質差分あり（6 件）

| ファイル | 領域 | diff 概要 | source 対応 | 判定 |
| --- | --- | --- | --- | --- |
| `member-auth.js` | **BD** | BD ルート 5 行追加 | **source `member-auth.js` と dist working は一致** · committed dist のみ未同期 | **build コピーで解消** · E-BD 先頭候補 |
| `builder/builder-ai.html` | **Builder** | robots meta 1 行 | source に meta なし · `stage-cloudflare-pages.mjs` `applySearchBlockingToDist()` 注入 | **build 生成差分のみ** |
| `builder/user-dashboard.html` | **Builder** | robots meta + site-assistant 3 行 | source になし · build 注入（site-assistant は skip リスト外） | **build 生成差分のみ** |
| `admin-operations-dashboard.html` | **AI秘書** | robots meta 1 行 | source に meta なし · build 注入（site-assistant は skip） | **build 生成差分のみ** |
| `shared/voice-core/transports/voice-openai-realtime-websocket-transport.js` | **voice-core** | subprotocol 変更等（+19/-9） | **dist working = source** · committed dist が旧 | **source 一致 · build コピーで解消** |
| `shared/voice-core/voice-core-test.html` | **voice-core** | robots meta 形式更新 + 末尾注入 | 部分 build 注入 | **build 生成差分 + source 同期** |

### 2.2 noindex meta 注入のみ（3 HTML · 上表に含む）

build パイプライン（`deploy/cloudflare/stage-cloudflare-pages.mjs`）:

```147:176:deploy/cloudflare/stage-cloudflare-pages.mjs
const ROBOTS_META = '<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">';
// ...
function applySearchBlockingToDist() {
  walkHtmlFiles(OUT_DIR, (filePath) => { /* 全 HTML に meta 注入 */ });
}
```

| ファイル | robots のみ | 追加 build 注入 |
| --- | --- | --- |
| `admin-operations-dashboard.html` | ✅ | — |
| `builder/builder-ai.html` | ✅ | —（site-assistant **skip**） |
| `builder/user-dashboard.html` | ✅ | site-assistant CSS/JS×3 |

**分離結論:** 現行 6 件のうち **3 HTML は robots 中心** · user-dashboard は **robots + site-assistant** · いずれも source 直編集ではなく **dist-only build 後処理**。

### 2.3 CRLF phantom のみ（17 件 · コンテンツ差分 0）

`git diff -w` が空 · `git diff --numstat` が 0 行:

| ファイル |
| --- |
| `docs/COMMIT-STAGING-builder-frozen.md` |
| `docs/ai-search-beta-checklist.md` |
| `docs/anpi-line-deploy-checklist.md` |
| `docs/anpi-line-manual-test.md` |
| `docs/anpi-rls-jwt-setup.md` |
| `docs/anpi-supabase-production-checklist.md` |
| `docs/chat-dual-window-demo.md` |
| `docs/deploy-git-stage-manifest.json` |
| `docs/gen-ai-voice-manual-checklist.md` |
| `docs/match-mvp-design.md` |
| `docs/production-release-checklist.md` |
| `docs/supabase-migration-plan.md` |
| `docs/talk-call-turn-config.md` |
| `docs/talk-call-turn-production-checklist.md` |
| `docs/talk-call-web-push-deploy.md` |
| `docs/talk-staging-prelaunch-checklist.md` |
| `docs/talk-supabase-sync.md` |
| `docs/tasful-ui-final-checklist.md` |

**判定:** **行末 CRLF/LF のみ** · commit 不要 · `git checkout --` で復元可（束 E 前 cleanup）。

---

## 3. Untracked 18 行 — 詳細

| パス | 領域 | source | 判定 |
| --- | --- | --- | --- |
| `chat-supabase-config.js` | TASFUL AI / chat | `writeChatSupabaseConfig()` が build 時生成（env または root `chat-supabase-config.js` から） | **build 生成 · dist-only** |
| `docs/AI/*`（7） | docs mirror | `docs/AI/*` | **build ミラー（未同期）** |
| `docs/CHANGELOG.md` 等（8） | docs mirror | `docs/*` 同名 | **build ミラー** |
| `docs/*-backlog.md`（6） | docs mirror | 束 A/B commit 済 source | **build ミラー** |
| `sql/ai-workspace-usage-daily.sql` | TASFUL AI | `sql/*` | **build ミラー** |
| `sql/ai-workspace-usage-daily-verify.sql` | TASFUL AI | `sql/*` | **build ミラー** |

**削除候補:** なし（正規 build 成果物 · build 後 commit 対象）

---

## 4. member-auth BD routes — 扱い

| 観点 | 状態 |
| --- | --- |
| **source `member-auth.js`** | BD 5 routes **あり**（L74–78） |
| **dist working** | source と **同一** |
| **dist committed（HEAD）** | BD routes **なし** |
| **git status** | ` M member-auth.js` = committed dist が旧 |

**結論:** 実装は source に取り込み済。**`npm run build:pages` で root → dist コピー**すれば同期。BD 専用 PR では **`member-auth.js` 1 ファイル**だけ stage 可能（最もクリーンな E 第 1 弾）。

---

## 5. source 対応サマリー

| 分類 | 件数 | ファイル |
| --- | ---: | --- |
| **source と一致（dist working）** | 2 | `member-auth.js` · voice transport JS |
| **build 生成差分のみ** | 4 | admin HTML · builder HTML×2 · voice test HTML |
| **build ミラー未同期（??）** | 18 行 | docs · sql · chat-supabase-config |
| **CRLF phantom（実質同一）** | 17 | `dist/docs/*` |
| **dist-only 削除候補** | **0** | — |

---

## 6. commit 候補（build 後 · 領域別小束）

| 小束 | 対象 | 件数 | Message 案 | 前提 |
| --- | --- | ---: | --- | --- |
| **E-pre** | CRLF phantom 17 | 0 commit | — | `git checkout -- deploy/cloudflare/dist/docs/...` |
| **E0** | formal build | — | — | `npm run build:pages`（8788 dev 停止含む） |
| **E-BD** | `member-auth.js` | 1 | `build(bd): sync member-auth routes in pages dist` | BD milestone 確定時 |
| **E-voice** | `shared/voice-core/**` | 2 | `build(tasful-ai): sync voice-core dist assets` | Voice / 5d1b 関連 |
| **E-Builder** | `builder/builder-ai.html` · `user-dashboard.html` | 2 | `build(builder): sync builder pages dist with search blocking` | Builder 触った場合のみ |
| **E-admin** | `admin-operations-dashboard.html` | 1 | `build(secretary): sync ops dashboard dist` | AI秘書 dist 同期時 |
| **E-docs** | `dist/docs/**` · `dist/sql/**` | ~24 | `build(pages): sync docs and sql mirror to dist` | docs 正本更新後 |
| **E-chat** | `chat-supabase-config.js` | 1 | E-docs または TASFUL AI 束に同梱可 | env 注入 · **secrets 含む可能性 → stage 前 diff 必須** |

**禁止:** 42 行一括 · Builder+BD+voice+docs 混在 commit

---

## 7. 削除 / 復元候補

| 操作 | 対象 | 理由 |
| --- | --- | --- |
| **checkout 復元** | `dist/docs/*` M 17 + manifest JSON | CRLF phantom · コンテンツ同一 |
| **削除** | なし（dist ファイル） | すべて build 正当成果物 |
| **build 後に自動解消** | ?? 18 行 + M 実質 6 件 | `npm run build:pages` フル実行 |

---

## 8. 次に実施すべき束 E の最初の小束

### 推奨順序

1. **E-pre（commit 不要）** — CRLF phantom 17 件を `git checkout -- deploy/cloudflare/dist/docs/` で消す（status 42 → **25** 目安）
2. **E0** — `npm run build:pages`（AD-009 · dev 停止 → build → dev 再開）
3. **E-BD（第 1 commit · 推奨）** — `deploy/cloudflare/dist/member-auth.js` **のみ**
   - 理由: source 確定済 · 1 ファイル · 領域明確 · BD Step 3+ 本番 Pages と整合
   - diff 確認: BD 5 routes のみであること

### 第 2 弾以降

4. **E-voice** — voice-core 2 件（TASFUL AI Voice 5d1b 証跡と整合）
5. **E-docs** — docs/sql/chat-config ミラー（`chat-supabase-config.js` は **secret 混入チェック**）
6. **E-Builder** / **E-admin** — HTML robots/site-assistant（build 全体反映後は他 HTML も更新されるため、**領域限定 stage は build 直後 snapshot を要確認**）

### 束 E 着手可否

| ゲート | 状態 |
| --- | --- |
| P0-1 reports/scripts | ✅ 完了 |
| dist 以外 working tree | ✅ **0** |
| 領域 milestone | ⏸ BD / voice / docs の優先度確認 |
| **束 E 着手** | ✅ **可能** — **E-pre → E0 → E-BD** から |

---

## 9. 参照

- `deploy/cloudflare/stage-cloudflare-pages.mjs` — robots · site-assistant · chat config · copyRecursive
- `reports/p0-1-final-working-tree-plan.md` §6
- `reports/working-tree-triage-after-tasful-ai-production-ready.md` §束 E
- `docs/DECISIONS.md` AD-007 · AD-009
