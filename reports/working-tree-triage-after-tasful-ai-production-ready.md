# Working Tree Triage — after TASFUL AI Production Ready

**実施日:** 2026-06-28  
**Git HEAD:** `bf0f754` — `chore(tasful-ai): complete production ready verification`  
**スコープ:** 調査・棚卸しのみ（**コード変更 · staging · commit なし**）

---

## 1. サマリー

| 項目 | 値 |
| --- | --- |
| **未ステージ総数** | **122**（Modified **48** · Untracked **74**） |
| **root source 変更（M）** | **1** — `docs/README.md` のみ |
| **root source 未追跡** | **2** — `docs/*-backlog.md` |
| **dist 関連** | **48**（M 27 + ?? 21）— ほぼ build drift / 生成物 |
| **削除候補（tmp/debug）** | **約 25** ファイル + 2 ディレクトリ |

### 領域別件数

| 領域 | 件数 | 主な内容 |
| --- | ---: | --- |
| **deploy/cloudflare/dist** | 48 | build 注入（robots meta）· BD route dist 反映 · dist/docs 正本ミラー ?? |
| **reports（TASFUL AI 系）** | 24 | 未コミット検証/設計レポート · 一部 bf0f754 済と重複概念 |
| **TLV / live** | 19 | tmp-channel スクショ · tlv-business-simulator · talk triage |
| **Builder / Builder AI** | 17 | dist ミラー · v2 スクショ/report · tmp-capture 脚本 |
| **Platform** | 12 | verify-platform-ui3* · NB-1M reports · member-auth **dist only** |
| **AI秘書 / admin** | 9 | admin-operations **dist** · secretary triage/design ?? |
| **ANPI** | 5 | dist/docs/anpi-* M |
| **tmp / debug / one-off** | 25 | tmp-* · dist/.cursor · _patch_* · worktree-cleanup 等 |
| **Business Directory** | 3 | step2-edge report M · bd-stripe DOM ?? |
| **Materials** | 3 | free-download backlog/plan |
| **docs（root）** | 3 | README.md M（**保留**）· backlog ?? |
| **scripts（恒久検証）** | 5 | test-builder-ai-live-* · verify-platform-ui3-* |
| **bf0f754 済（触らない）** | — | verify-access · production-ready-verification 等は **clean** |

---

## 2. source / dist 対応状況

### 2.1 root source は clean（HEAD = bf0f754 と一致）

以下は **root に unstaged 変更なし**。差分は **committed dist vs working tree dist** のみ。

| dist（M） | root source | dist drift の主因 |
| --- | --- | --- |
| `deploy/cloudflare/dist/builder/builder-ai.html` | `builder/builder-ai.html` | build `search-blocking` → `noindex` meta 1行 |
| `deploy/cloudflare/dist/builder/user-dashboard.html` | `builder/user-dashboard.html` | 同上 |
| `deploy/cloudflare/dist/admin-operations-dashboard.html` | `admin-operations-dashboard.html` | 同上 |
| `deploy/cloudflare/dist/member-auth.js` | `member-auth.js` | **BD ルート追加**が source HEAD にあるが旧 dist 未同期 |
| `deploy/cloudflare/dist/shared/voice-core/transports/voice-openai-realtime-websocket-transport.js` | `shared/voice-core/...` | コメント差分（dist-only · source HEAD clean） |
| `deploy/cloudflare/dist/shared/voice-core/voice-core-test.html` | `shared/voice-core/...` | build 注入 / dist drift |
| `deploy/cloudflare/dist/docs/*.md`（17 M） | `docs/*.md`（各種） | dist ミラー · 正本 `docs/` は多く committed |

**結論:** 単独で dist だけ commit しない。領域ごとに **formal `npm run build:pages`** 後、source+dist をセットで選別。

### 2.2 TASFUL AI Production Ready（bf0f754）

| ファイル | 状態 |
| --- | --- |
| `scripts/verify-tasful-ai-access-workspace.mjs` | ✅ **committed** |
| `deploy/cloudflare/dist/ai-workspace.html` | ✅ **committed**（noindex 1行） |
| `reports/tasful-ai-access-workspace-check.json` 等 | ✅ **committed** |

**触ってはいけない:** 上記 bf0f754 内容の revert / 上書き。

---

## 3. docs/README.md — Business Directory 行（保留）

| 項目 | 内容 |
| --- | --- |
| 変更 | Phase 7 Preflight Go → **Production Step 2**（DB+Edge staging 済 · Pages prod 未着手） |
| リンク | `business-directory-production-step2-edge.md` 2行追加 |
| 理由 | Business Directory Production Step 2 作業時の正本同期（TASFUL AI とは無関係） |
| 判定 | **保留** — BD 専用 PR と一緒に commit。TASFUL AI Production Ready 束には **含めない** |

---

## 4. 削除候補（tmp / debug / one-off）

| ファイル / パス | 領域 | 推定目的 | 注意 |
| --- | --- | --- | --- |
| `deploy/cloudflare/dist/.cursor/` | tmp | build 誤出力 / Cursor 設定混入 | **削除候補** · dist に不应 |
| `deploy/cloudflare/dist/_patch_worker_detail.py` | tmp | 手動パッチ残骸 | 削除候補 |
| `deploy/cloudflare/dist/_worker_shared_sections.html` | tmp | 手動パッチ残骸 | 削除候補 |
| `scripts/tmp-ai-workspace-phase1-deploy-smoke.mjs` | tmp | Phase1 deploy 一時 smoke | 削除 or reports 化後削除 |
| `scripts/tmp-capture-builder-ai-v2*.mjs`（3） | tmp | Builder v2 スクショ | 削除候補（reports 済） |
| `scripts/tmp-verify-user-dashboard-builder-ai-card.mjs` | tmp | カード検証 | 削除候補 |
| `scripts/tmp-channel-audit/*.png`（5 M） | tmp | TLV channel 監査 | 削除候補 |
| `scripts/tmp-channel-content-regression/*`（4 M） | tmp | channel 回帰 | 削除候補 |
| `reports/_gemini-recovery-probe.png` | tmp | 調査スクショ | 削除候補 |
| `reports/web-search-brave-ja-compare.json` | tmp | 空 probes（keys なし時） | 削除候補 |
| `reports/auto-generated-cleanup.md` | tmp | クリーンアップメモ | 削除 or docs 化 |
| `reports/worktree-cleanup-*.md`（3） | tmp | worktree 整理メモ | 削除候補 |
| `reports/wrangler-temp-untrack.md` | tmp | wrangler 一時メモ | 削除候補 |

**恒久化候補（削除しない · 別 PR）:** `scripts/test-builder-ai-live-*.mjs` · `scripts/verify-platform-ui3-*.mjs`

---

## 5. 領域別ファイル一覧

凡例 — **Commit:** ✅候補 · ❌除外 · ⏸保留 · 🗑削除候補

### 5.1 Builder / Builder AI（17）

| ファイル | S/D | 推定目的 | Commit | 注意 |
| --- | --- | --- | --- | --- |
| `deploy/cloudflare/dist/builder/builder-ai.html` | dist | noindex meta drift | ❌ | formal build 後 · **Builder 凍結** |
| `deploy/cloudflare/dist/builder/user-dashboard.html` | dist | 同上 | ❌ | 同上 |
| `reports/builder-dashboard-phase6h-1280.png` | artifact | UI スクショ | ❌ | reports のみ |
| `reports/builder-release-status.md` | report | リリース状態 | ⏸ | Builder 担当 PR |
| `reports/builder-ai-v2-final-polish/` | artifact | v2 polish 証跡 | ❌ | 大量 png |
| `reports/builder-ai-v2-redesign/` | artifact | v2 redesign 証跡 | ❌ | 同上 |
| `reports/user-dashboard-builder-ai-card/` | artifact | dashboard カード | ❌ | 同上 |
| `reports/platform-diff-triage-after-builder.md` | report | diff triage | ⏸ | 参照用 |
| `scripts/test-builder-ai-live-e2e.mjs` | script | live E2E | ⏸ | 恒久化検討 |
| `scripts/test-builder-ai-live-qa.mjs` | script | live QA | ⏸ | 同上 |
| `scripts/tmp-capture-builder-ai-v2-final.mjs` | script | スクショ | 🗑 | tmp |
| `scripts/tmp-capture-builder-ai-v2.mjs` | script | スクショ | 🗑 | tmp |
| `scripts/tmp-capture-user-dashboard-builder-ai-icon.mjs` | script | スクショ | 🗑 | tmp |
| `scripts/tmp-verify-user-dashboard-builder-ai-card.mjs` | script | 検証 | 🗑 | tmp |
| `deploy/cloudflare/dist/docs/builder-ai-gemini-live-field-diagnosis-backlog.md` | dist | backlog ミラー | ❌ | build 生成 |

### 5.2 Platform（12）

| ファイル | S/D | 推定目的 | Commit | 注意 |
| --- | --- | --- | --- | --- |
| `deploy/cloudflare/dist/member-auth.js` | dist | BD routes 同期 | ❌ | source HEAD 済 · build 後 commit |
| `reports/company-mobile-audit-390.md` | report | 監査 | ⏸ | Platform PR |
| `reports/platform-nb1m-frontend-prod-deploy-ready.md` | report | NB-1M | ⏸ | 同上 |
| `reports/platform-all-browser-current-failures.md` | report | 失敗 triage | ❌ | スナップショット |
| `reports/platform-all-browser-failure-triage.md` | report | triage | ❌ | 同上 |
| `reports/platform-nb1m-smoke-browser.json` | artifact | smoke JSON | ❌ | 生成物 |
| `reports/platform-ops-flow-2-browser.json` | artifact | smoke JSON | ❌ | 生成物 |
| `scripts/verify-platform-ui3-batch1.mjs` | script | UI3 検証 | ⏸ | Platform 凍結 |
| `scripts/verify-platform-ui3-batch2-b1.mjs` | script | UI3 検証 | ⏸ | 同上 |
| `scripts/verify-platform-ui3-precommit.mjs` | script | precommit | ⏸ | 同上 |
| `deploy/cloudflare/dist/docs/platform-coupon-system-backlog.md` | dist | backlog ミラー | ❌ | build |
| `reports/gate-d-smoke-last.json` | artifact | Gate-D smoke | ❌ | 再生成可 |

### 5.3 TLV / live（19）

| ファイル | S/D | 推定目的 | Commit | 注意 |
| --- | --- | --- | --- | --- |
| `scripts/tmp-channel-audit/*.png`（5） | artifact | channel UI | 🗑 | tmp |
| `scripts/tmp-channel-content-regression/*`（4） | artifact | regression | 🗑 | tmp |
| `reports/tlv-business-simulator/README.md` | report | simulator | ❌ | TLV 別 PR |
| `reports/tlv-business-simulator/payout-engine-v2-implementation-phase.md` | report | payout | ❌ | 同上 |
| `reports/tlv-business-simulator/stripe-connect-payout-plan.md` | report | Stripe | ❌ | 同上 |
| `reports/tlv-diff-triage-after-anpi.md` | report | triage | ❌ | 参照 |
| `reports/talk-diff-triage-after-platform.md` | report | triage | ❌ | 参照 |
| `deploy/cloudflare/dist/docs/talk-*.md`（複数 M） | dist | talk docs ミラー | ❌ | **TLV 凍結** |

### 5.4 AI秘書 / admin（9）

| ファイル | S/D | 推定目的 | Commit | 注意 |
| --- | --- | --- | --- | --- |
| `deploy/cloudflare/dist/admin-operations-dashboard.html` | dist | noindex drift | ❌ | **秘書凍結** |
| `reports/ai-secretary-diff-triage-after-tlv.md` | report | triage | ❌ | 凍結 |
| `reports/ai-secretary-phase5-orchestrator-plan.md` | report | 設計 | ❌ | 凍結 |
| `reports/ai-secretary-text-chat-first.md` | report | 設計 | ❌ | 凍結 |
| `reports/gateway-diff-triage-after-secretary.md` | report | triage | ❌ | AD-005 注意 |
| `reports/secretary-deepseek-adapter-design.md` | report | DeepSeek | ❌ | 凍結 |
| `reports/secretary-deepseek-deploy-triage.md` | report | deploy | ❌ | 凍結 |
| `reports/ops-common-diff-triage-after-gateway.md` | report | triage | ❌ | 凍結 |
| `deploy/cloudflare/dist/docs/ai-secretary-trend-scout-backlog.md` | dist | backlog | ❌ | build |

### 5.5 ANPI（5）

| ファイル | S/D | Commit | 注意 |
| --- | --- | --- | --- |
| `deploy/cloudflare/dist/docs/anpi-*.md`（5 M） | dist | ❌ | ANPI 専用 build+PR |
| `reports/anpi-diff-triage-after-talk.md` | report | ❌ | triage 参照 |

### 5.6 Business Directory（3）

| ファイル | S/D | Commit | 注意 |
| --- | --- | --- | --- |
| `reports/business-directory-production-step2-edge.md` | report | ✅ | **BD Step 2 PR** 先頭候補 |
| `reports/bd-stripe-checkout-dom.json` | artifact | ⏸ | BD PR に含めるか要判断 |
| `reports/bd-stripe-checkout-dom.png` | artifact | ⏸ | 同上 |

### 5.7 Materials（3）

| ファイル | S/D | Commit | 注意 |
| --- | --- | --- | --- |
| `docs/free-download-service-backlog.md` | source | ✅ | Materials backlog PR |
| `reports/free-download-service-plan.md` | report | ✅ | 同上 |
| `deploy/cloudflare/dist/docs/free-download-service-backlog.md` | dist | ❌ | build 後 |

### 5.8 docs（3）

| ファイル | S/D | Commit | 注意 |
| --- | --- | --- | --- |
| `docs/README.md` | source | ⏸ | **BD 行保留** |
| `docs/tasful-ai-ui-operation-assist-backlog.md` | source | ✅ | backlog · P0 後 |
| `deploy/cloudflare/dist/docs/*`（?? 多数） | dist | ❌ | 正本 `docs/` commit 後 build |

### 5.9 reports — TASFUL AI 関連（bf0f754 外 · 24）

| ファイル | Commit | 注意 |
| --- | --- | --- |
| `reports/brave-search-migration-study.md` | ✅ | Phase1 調査 · 読取専用 |
| `reports/tasful-ai-p0-2-production-connection-triage.md` | ✅ | 履歴 |
| `reports/tasful-ai-production-preflight.md` | ✅ | preflight 正本 |
| `reports/tasful-ai-production-readiness.md` | ✅ | 同上 |
| `reports/tasful-ai-production-ready-final-verification.md` | ✅ | No-Go 記録 |
| `reports/tasful-ai-production-environment-fix.md` | ✅ | 履歴 |
| `reports/tasful-ai-workspace-phase1-deploy.md` | ✅ | deploy 記録 |
| `reports/tasful-ai-workspace-enforcement-design.md` | ✅ | 設計 |
| `reports/tasful-ai-current-status.md` | ⏸ | 古い可能性 · 要読 |
| `reports/tasful-ai-workspace-quota-edge-last.json` | ❌ | 再生成物 |
| `reports/tasful-ai-workspace-quota-production-compat.json` | ❌ | 再生成物 |
| `reports/gemini-edge-diagnose.*` | ❌ | 診断スナップショット |
| `reports/gemini-billing-recovery*` | ❌ | 診断スナップショット |
| `reports/tasful-ai-workspace-phase1-deploy-smoke.json` | ❌ | 生成物 |
| `reports/voice-5d1b-manual-verify/` | ❌ | 手動検証 |

### 5.10 deploy/cloudflare/dist — その他 ??（build 生成 · 21）

| パス | Commit | 注意 |
| --- | --- | --- |
| `deploy/cloudflare/dist/docs/AI/` … `DECISIONS.md` `TODO.md` 等 | ❌ | 正本 `docs/` 先 commit |
| `deploy/cloudflare/dist/chat-supabase-config.js` | ❌ | build 注入 |
| `deploy/cloudflare/dist/sql/ai-workspace-usage-daily*.sql` | ❌ | sql 正本から |
| `deploy/cloudflare/dist/.cursor/` `_patch_*` | 🗑 | 不应在 dist |

---

## 6. 触ってはいけないもの

| 種別 | 内容 |
| --- | --- |
| **bf0f754 コミット内容** | revert / 上書き禁止 |
| **`.env`** | 読取・commit・表示禁止 |
| **Supabase / CF secrets** | 値のログ禁止 |
| **Builder / Platform / TLV / AI秘書 凍結領域の source** | 現状 clean · 意図しない混入禁止 |
| **`ai-model-gateway.js` 契約** | AD-005 |
| **`git add -A`** | AD-007 |

---

## 7. 次にコミットすべき安全な束（提案）

### 束 A — docs/reports 整理（TASFUL AI 履歴 · 低リスク）✅ 推奨第1

**約 10–12 files · source のみ · dist/UI 触らない**

```
reports/brave-search-migration-study.md
reports/tasful-ai-p0-2-production-connection-triage.md
reports/tasful-ai-production-preflight.md
reports/tasful-ai-production-readiness.md
reports/tasful-ai-production-ready-final-verification.md
reports/tasful-ai-production-environment-fix.md
reports/tasful-ai-workspace-phase1-deploy.md
reports/tasful-ai-workspace-enforcement-design.md
docs/tasful-ai-ui-operation-assist-backlog.md
```

**Message 案:** `docs(tasful-ai): archive production connection reports`

---

### 束 B — Materials backlog（独立）✅

```
docs/free-download-service-backlog.md
reports/free-download-service-plan.md
```

**Message 案:** `docs(materials): add free download service backlog`

---

### 束 C — Business Directory Step 2（BD 担当 · README 同梱）⏸

```
reports/business-directory-production-step2-edge.md
docs/README.md                    # BD 行 + step1/step2 リンク
reports/bd-stripe-checkout-dom.*  # 任意
```

**Message 案:** `docs(business-directory): production step2 edge report`

---

### 束 D — tmp 削除（コミット不要 · ローカル cleanup）🗑

束 A/B コミット前に実施推奨 — `git clean` は **対象パス明示** · `-fd` 全域禁止。

---

### 束 E — dist 同期（領域別 · 後回し）❌ 今回しない

1. 領域確定（例: BD only → member-auth.js + BD pages）
2. `npm run build:pages`
3. 該当 `deploy/cloudflare/dist/**` のみ stage

**122 件一括 dist commit は No-Go**（Builder/TLV/ANPI 混入）。

---

## 8. 推奨実行順序

1. **束 D** — tmp/debug 削除（working tree 122 → ~95 目安）
2. **束 A** — TASFUL AI 履歴 reports commit
3. **束 B** — Materials backlog（任意 · 独立）
4. **束 C** — BD + README（BD タイミングで）
5. **束 E** — 領域別 formal build + dist（Platform BD / Builder 等は別 milestone）

---

## 9. 参照

- `docs/TODO.md` §P0-1
- `docs/KNOWN_ISSUES.md` KI-002
- `reports/tasful-ai-production-ready-verification.md`（Go 済）
- `reports/ai-selected-staging-result.md`（選別先例）
