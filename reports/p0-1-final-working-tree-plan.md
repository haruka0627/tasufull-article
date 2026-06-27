# P0-1 Final Working Tree Plan

**実施日:** 2026-06-28  
**Git HEAD:** `4ad5a2b` — `docs(tlv): update business simulator evidence`  
**スコープ:** 調査・分類のみ（**git add / commit / rm / checkout / build / deploy / dist 修正 なし**）  
**前提:** 束 A–M コミット済 · 束 D untracked cleanup 済 · tracked `scripts/tmp-*` 復元済

---

## 1. サマリー

| 項目 | 値 |
| --- | ---: |
| **残 working tree（status 行）** | **53** |
| **物理ファイル（dist 配下展開含む）** | **約 70+**（`dist/docs/AI/` 7 件等） |
| **P0-1 reports/scripts 小束** | **完了**（束 A–M） |
| **主な残り** | dist drift **42 行** · reports **12 行** |

### カテゴリ別件数（status 行）

| カテゴリ | M | ?? | 計 |
| --- | ---: | ---: | ---: |
| **deploy/cloudflare/dist** | 24 | 18 | **42** |
| **last-run JSON** | 4 | 1 | **5** |
| **PNG QA artifact** | 0 | 2 dir | **2** |
| **Builder redesign** | 0 | 1 dir | **1** |
| **Builder report.json** | 0 | 1 | **1** |
| **triage report** | 0 | 1 | **1** |
| **modified 正本 report（.md）** | 2 | 0 | **2** |

---

## 2. 全件一覧 — カテゴリ別

### 2.1 deploy/cloudflare/dist（42 行 · 束 E）

#### Modified（24）

| ファイル | 主な drift 内容 | 判定 |
| --- | --- | --- |
| `deploy/cloudflare/dist/admin-operations-dashboard.html` | robots `noindex` meta 注入 | **build 後に自動解消** · 束 E |
| `deploy/cloudflare/dist/builder/builder-ai.html` | 同上 | 束 E（Builder 領域） |
| `deploy/cloudflare/dist/builder/user-dashboard.html` | 同上 | 束 E（Builder 領域） |
| `deploy/cloudflare/dist/member-auth.js` | BD ルート 5 件追加 | 束 E（BD 領域 · source HEAD 済） |
| `deploy/cloudflare/dist/shared/voice-core/transports/voice-openai-realtime-websocket-transport.js` | voice-core 同期 | 束 E（TASFUL AI / voice 領域） |
| `deploy/cloudflare/dist/shared/voice-core/voice-core-test.html` | 同上 | 束 E |
| `deploy/cloudflare/dist/docs/COMMIT-STAGING-builder-frozen.md` | docs ミラー | **build 後に自動解消** |
| `deploy/cloudflare/dist/docs/ai-search-beta-checklist.md` | robots meta | build 後自動解消 |
| `deploy/cloudflare/dist/docs/anpi-line-deploy-checklist.md` | robots meta | build 後自動解消 |
| `deploy/cloudflare/dist/docs/anpi-line-manual-test.md` | robots meta | build 後自動解消 |
| `deploy/cloudflare/dist/docs/anpi-rls-jwt-setup.md` | robots meta | build 後自動解消 |
| `deploy/cloudflare/dist/docs/anpi-supabase-production-checklist.md` | robots meta | build 後自動解消 |
| `deploy/cloudflare/dist/docs/chat-dual-window-demo.md` | robots meta | build 後自動解消 |
| `deploy/cloudflare/dist/docs/deploy-git-stage-manifest.json` | manifest 更新 | build 後自動解消 |
| `deploy/cloudflare/dist/docs/gen-ai-voice-manual-checklist.md` | robots meta | build 後自動解消 |
| `deploy/cloudflare/dist/docs/match-mvp-design.md` | robots meta | build 後自動解消 |
| `deploy/cloudflare/dist/docs/production-release-checklist.md` | robots meta | build 後自動解消 |
| `deploy/cloudflare/dist/docs/supabase-migration-plan.md` | robots meta | build 後自動解消 |
| `deploy/cloudflare/dist/docs/talk-call-turn-config.md` | robots meta | build 後自動解消 |
| `deploy/cloudflare/dist/docs/talk-call-turn-production-checklist.md` | robots meta | build 後自動解消 |
| `deploy/cloudflare/dist/docs/talk-call-web-push-deploy.md` | robots meta | build 後自動解消 |
| `deploy/cloudflare/dist/docs/talk-staging-prelaunch-checklist.md` | robots meta | build 後自動解消 |
| `deploy/cloudflare/dist/docs/talk-supabase-sync.md` | robots meta | build 後自動解消 |
| `deploy/cloudflare/dist/docs/tasful-ui-final-checklist.md` | robots meta | build 後自動解消 |

#### Untracked（18 行 · build mirror）

| パス | 内容 | 判定 |
| --- | --- | --- |
| `deploy/cloudflare/dist/chat-supabase-config.js` | 生成 JS | **build 後に自動解消** |
| `deploy/cloudflare/dist/docs/AI/`（7） | `docs/AI/*` 正本ミラー | build 後自動解消 |
| `deploy/cloudflare/dist/docs/CHANGELOG.md` 等 8 件 | `docs/` 正本ミラー | build 後自動解消 |
| `deploy/cloudflare/dist/docs/*-backlog.md`（6） | backlog ミラー（A/B 済 source） | build 後自動解消 |
| `deploy/cloudflare/dist/sql/ai-workspace-usage-daily*.sql`（2） | SQL ミラー | build 後自動解消 |

**一括 dist commit は No-Go**（Builder / TLV / ANPI / BD 混入 · AD-007 選別 stage 必須）。

---

### 2.2 last-run JSON（5 行）

| ファイル | サイズ | 内容 | 判定 |
| --- | ---: | --- | --- |
| `reports/gate-d-smoke-last.json` | 5.9K | Gate D smoke 最終実行 | **削除対象**（再実行で再生成） |
| `reports/gemini-edge-diagnose.json` | 43K | Edge 診断 raw | **保留**（`.md` は束 L commit 済 · JSON は再実行 or 意図的 archive 判断） |
| `reports/tasful-ai-workspace-quota-edge-last.json` | 1.5K | quota last-run | **削除対象** |
| `reports/tasful-ai-workspace-quota-production-compat.json` | 1.3K | quota compat last-run | **削除対象** |
| `reports/web-search-brave-ja-compare.json` | 338B | Brave/Serper 比較 · **全 null** | **削除対象** |

---

### 2.3 PNG QA artifact（2 ディレクトリ）

| パス | ファイル数 | 8788 記録 | 判定 |
| --- | ---: | --- | --- |
| `reports/voice-5d1b-manual-verify/` | 4 | ✅ `report.json` に `http://127.0.0.1:8788` | **commit 候補**（束 N · TASFUL AI Voice QA） |
| `reports/builder-ai-v2-redesign/` | 4 | なし（中間） | **削除対象**（§4 参照） |

---

### 2.4 Builder report.json（1 行）

| ファイル | 問題 | 判定 |
| --- | --- | --- |
| `reports/builder-ai-v2-final-polish/report.json` | `pageUrl: file://...` | §3 参照 |

---

### 2.5 triage report（1 行 · + 本書）

| ファイル | 判定 |
| --- | --- |
| `reports/untracked-reports-scripts-triage-after-cleanup.md` | **commit 候補**（束 N · P0-1 選別正本） |
| `reports/p0-1-final-working-tree-plan.md` | **commit 候補**（本書 · 束 N 同梱可） |

---

### 2.6 modified 正本 report — .md（2 行）

| ファイル | 領域 | 判定 |
| --- | --- | --- |
| `reports/builder-release-status.md` | Builder | **commit 候補**（束 O · Builder 単独） |
| `reports/company-mobile-audit-390.md` | Platform / Company | **commit 候補**（束 O · Platform 単独 or 上と分離） |

---

## 3. Builder `report.json` 判断

### 現状

```json
"pageUrl": "file:///c:/Users/rubih/tasufull-article/builder/builder-ai.html"
```

束 I では qa.mdc 違反のため **commit 除外**。同ディレクトリの `report-micro.json` · `report-icons.json` · PNG 6 枚は **commit 済**（`ceb2998`）。

### 8788 再取得の価値

| 観点 | 評価 |
| --- | --- |
| **正本化価値** | **中** — `pageUrl` と horizontalScroll の統合サマリーとして有用 |
| **冗長性** | `report-micro.json` が scroll/CSS 結果を既に保持 |
| **再取得手段** | `scripts/tmp-capture-builder-ai-v2-final.mjs` は束 D で削除済（untracked 復元なし）· **8788 向け capture 再実行 or 手動 Playwright** が必要 |
| **推奨** | **再取得して commit**（小 1 ファイル · `test(builder): add builder ai v2 capture report at 8788`） |

### 削除 vs 再取得

| 選択 | 推奨度 | 理由 |
| --- | --- | --- |
| **8788 再取得 → commit** | ✅ **推奨** | qa.mdc 準拠の正本完成 · 工数小 |
| **ローカル削除のみ** | △ 可 | micro/icons で PASS は証明済 · 欠落は許容 |
| **file:// のまま commit** | ❌ 不可 | qa.mdc 違反 |

---

## 4. `builder-ai-v2-redesign/` 判断

| 観点 | redesign | final-polish（commit 済） |
| --- | --- | --- |
| スクショ | `builder-ai-v2-{390,768,1280}.png` | `builder-ai-v2-final-*` + `icons-*` |
| report | `report.json`（msgCount のみ） | `report-micro.json` + `report-icons.json` |
| 時系列 | **中間イテレーション** | **最終 polish** |

**結論: 完全に置換済み — 将来参照価値なし**

- final-polish が superset（layout + icon 検証）
- redesign の `report.json` に unique な合格情報なし
- git 履歴に redesign 証跡は不要（束 I で final 確定）

**推奨: ローカル削除**（commit 不要 · 束 D 続き cleanup）

---

## 5. 判定サマリー

### commit 対象（dist 以外 · 推奨小束）

| 小束 | ファイル | Message 案 |
| --- | --- | --- |
| **N — P0-1 triage 正本** | `untracked-reports-scripts-triage-after-cleanup.md` · `p0-1-final-working-tree-plan.md` | `docs(repo): archive p0-1 triage and final plan` |
| **N' — Voice QA** | `voice-5d1b-manual-verify/`（4） | `test(tasful-ai): archive voice 5d1b manual verify evidence` |
| **O — Builder status** | `builder-release-status.md` | `docs(builder): update release status` |
| **O' — Company audit** | `company-mobile-audit-390.md` | `docs(platform): update company mobile audit` |
| **P — Builder report.json** | `builder-ai-v2-final-polish/report.json`（8788 再取得後） | `test(builder): add builder ai v2 capture report at 8788` |

**commit しない:** last-run JSON 5 件 · redesign 4 件 · dist 42 行

### 削除対象（ローカル cleanup · commit 不要）

```
reports/web-search-brave-ja-compare.json
reports/gate-d-smoke-last.json          # または checkout -- で tracked 復元
reports/tasful-ai-workspace-quota-edge-last.json
reports/tasful-ai-workspace-quota-production-compat.json
reports/builder-ai-v2-redesign/         # 4 files
reports/builder-ai-v2-final-polish/report.json   # 再取得しない場合のみ
```

`gate-d-smoke-last.json` · quota JSON は **tracked M** — 削除すると ` D ` になるため **checkout -- 復元** か **意図的削除 commit** を別判断。

### 保留

| 対象 | 理由 |
| --- | --- |
| `reports/gemini-edge-diagnose.json` | `.md` 更新済 · JSON は raw dump · 再実行 or archive 判断 |
| **deploy/cloudflare/dist 全体** | 束 E · 領域別 build 後 |
| `builder-ai-v2-final-polish/report.json` | 8788 再取得待ち |

### build 後に自動解消

- `deploy/cloudflare/dist/**` の **42 status 行すべて**
- `npm run build:pages` → `docs/` · `docs/AI/` · backlog · sql ミラー再生成
- robots meta · `member-auth.js` · voice-core · builder HTML は source と build パイプラインで同期

---

## 6. 束 E 着手可否

| 項目 | 判定 |
| --- | --- |
| **P0-1 reports/scripts 整理** | ✅ **完了**（束 A–M + 本 plan で残り非 dist は明確化） |
| **一括 dist commit** | ❌ **不可**（42 行混在 · 122 件教訓） |
| **束 E 着手** | ✅ **可能** — ただし **領域 1 つに限定** |

### 推奨束 E 実行順（領域別）

1. **E-BD** — `member-auth.js` + BD pages のみ（source 確定済み場合）
2. **E-Builder** — `builder/builder-ai.html` · `user-dashboard.html` のみ
3. **E-docs-mirror** — `dist/docs/**` 一括（build 後 · docs-only PR）
4. **E-voice** — `shared/voice-core/**`
5. **E-admin** — `admin-operations-dashboard.html`

各ステップ: `npm run build:pages` → 該当 `deploy/cloudflare/dist/**` のみ個別 `git add` → 領域ラベル commit。

### 着手前チェックリスト

- [ ] 束 N（triage 正本 2 件）commit
- [ ] last-run JSON cleanup（checkout or 削除）
- [ ] redesign 削除
- [ ] （任意）8788 report.json 再取得
- [ ] 領域 milestone 確定（BD / Builder / 等）
- [ ] `npm run dev` + 8788 LISTEN 確認後 build

---

## 7. P0-1 完了判定

| ゲート | 状態 |
| --- | --- |
| 束 A–C（TASFUL AI / Materials / BD docs） | ✅ |
| 束 D cleanup | ✅（tracked tmp 復元済） |
| 束 F–M（reports/scripts 小束） | ✅ |
| 残 dist drift | ⏸ 束 E |
| 残 one-off artifact | 🗑 削除推奨（§5） |
| **P0-1 docs/reports 正本** | ✅ **実質完了** — 本 plan commit でクローズ可能 |

---

## 8. 参照

- `reports/working-tree-triage-after-tasful-ai-production-ready.md`（8536406）
- `reports/untracked-reports-scripts-triage-after-cleanup.md`
- `docs/TODO.md` §P0-1 · `docs/KNOWN_ISSUES.md` KI-002
- HEAD 履歴: `8536406`（F）→ … → `4ad5a2b`（M）
