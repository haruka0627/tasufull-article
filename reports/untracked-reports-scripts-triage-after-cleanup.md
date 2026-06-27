# Untracked Reports / Scripts Triage — after Bundle D Cleanup

**実施日:** 2026-06-28  
**Git HEAD:** `8ad47e7` — `docs(business-directory): archive production step reports`  
**スコープ:** 調査・分類のみ（**git add / commit / rm / checkout / build / deploy なし**）  
**前提:** 束 A/B/C コミット済 · 束 D untracked 削除済（tracked `scripts/tmp-*` は復元済）· `deploy/cloudflare/dist/docs/**` は build mirror → **束 E まで保留**

---

## 1. サマリー

| 区分 | 件数 |
| --- | ---: |
| **untracked reports**（トップレベル 22 + 配下ファイル） | **41 ファイル** |
| **untracked scripts** | **5 ファイル** |
| **modified reports** | **12 ファイル** |
| **working tree 総数** | **81**（dist M 24 + reports M 12 + reports/scripts ?? 45） |

---

## 2. Untracked Reports — 全件分類

### 2.1 正本として commit 候補 ✅

| ファイル | 領域 | 理由 |
| --- | --- | --- |
| `reports/working-tree-triage-after-tasful-ai-production-ready.md` | P0-1 | TASFUL AI Production Ready 後の 122 件棚卸し正本。束 A–E 計画の根拠 |
| `reports/gateway-diff-triage-after-secretary.md` | Gateway | AI秘書 dist 完了後の Gateway 差分棚卸し（調査正本） |
| `reports/ops-common-diff-triage-after-gateway.md` | OPS | Gateway 完了後の共通 OPS 差分棚卸し |
| `reports/platform-diff-triage-after-builder.md` | Platform | Builder 完了後 Platform 差分棚卸し |
| `reports/talk-diff-triage-after-platform.md` | TALK | Platform 完了後 TALK 差分棚卸し |
| `reports/anpi-diff-triage-after-talk.md` | 安否 | TALK 完了後 ANPI 差分棚卸し |
| `reports/tlv-diff-triage-after-anpi.md` | TLV | ANPI 完了後 TLV 差分棚卸し |
| `reports/ai-secretary-diff-triage-after-tlv.md` | AI秘書 | TLV 完了後 AI秘書差分棚卸し |
| `reports/secretary-deepseek-adapter-design.md` | AI秘書 | DeepSeek 専用 Adapter 設計（P0-3 調査正本 · `secretary-deepseek-adapter-phase1.md` と対） |
| `reports/secretary-deepseek-deploy-triage.md` | AI秘書 | DeepSeek deploy 前 triage |
| `reports/ai-secretary-text-chat-first.md` | AI秘書 | テキストチャット First 検証レポート |
| `reports/ai-secretary-phase5-orchestrator-plan.md` | AI秘書 | Phase 5 Operations Orchestrator 設計調査 |
| `reports/gemini-billing-recovery.md` | TASFUL AI | Gemini 429 復旧検証レポート（probe JSON は束 D で削除済 · レポート本体は正本） |
| `reports/platform-all-browser-failure-triage.md` | Platform | all-browser 失敗の原因分類 |
| `reports/platform-all-browser-current-failures.md` | Platform | 失敗ログ正本（上記 triage の入力） |
| `reports/ai-selected-staging-result.md` | 横断 | 選別ステージング結果（2026-06-26 · 手順先例） |

### 2.2 QA 証跡として commit 候補 📸

| ファイル / ディレクトリ | 領域 | 理由 |
| --- | --- | --- |
| `reports/builder-ai-v2-final-polish/`（9） | Builder AI | v2 最終 polish PASS · 390/768/1280 スクショ + `report.json` |
| `reports/user-dashboard-builder-ai-card/`（6） | Builder AI | user-dashboard Builder AI カード UI 証跡 |
| `reports/voice-5d1b-manual-verify/`（4） | TASFUL AI | Voice 5d1b 手動検証 · ai-workspace 3 viewport + `report.json` |

### 2.3 tmp / debug として削除候補 🗑

| ファイル | 理由 |
| --- | --- |
| `reports/web-search-brave-ja-compare.json` | Brave/Serper 比較 one-off · **全 query が `null`**（338B · 実質失敗キャプチャ） |
| `reports/builder-ai-v2-redesign/`（4） | v2 中間 redesign 証跡 · **`builder-ai-v2-final-polish/` に置換済** |

### 2.4 既存 tracked に吸収済み / 重複 ⏭

| ファイル | 理由 |
| --- | --- |
| `reports/tasful-ai-current-status.md` | 2026-06-26 時点棚卸し。**bf0f754 / 56abe78 以降の Production Ready レポート群で大部分 supersede**。履歴参照としては価値あり → **単独 commit より保留 or 束に同梱要判断** |
| `reports/gemini-billing-recovery.md` の probe 参照 | `gemini-billing-recovery-probes.json` は束 D で削除済 · レポート内リンク切れの可能性 → commit 時に README 修正 or 注記 |

### 2.5 保留 ⏸

| ファイル | 理由 |
| --- | --- |
| （上記 `tasful-ai-current-status.md`） | supersede 判断待ち |
| `reports/builder-ai-v2-final-polish/report.json` | `pageUrl` が `file://` 記録（qa.mdc 違反記録）· 証跡としては残すが **再取得推奨** |

---

## 3. Untracked Scripts — 全件分類

| ファイル | 分類 | 理由 |
| --- | --- | --- |
| `scripts/test-builder-ai-live-e2e.mjs` | **正本 commit 候補** ✅ | Builder AI Live Gateway 8 action E2E · `test-builder-ai-p*.mjs` と同系列 |
| `scripts/test-builder-ai-live-qa.mjs` | **正本 commit 候補** ✅ | Builder AI Live QA チェックリスト |
| `scripts/verify-platform-ui3-batch1.mjs` | **正本 commit 候補** ✅ | Platform Phase UI-3 batch 1 検証 |
| `scripts/verify-platform-ui3-batch2-b1.mjs` | **正本 commit 候補** ✅ | Platform Phase UI-3 batch 2 |
| `scripts/verify-platform-ui3-precommit.mjs` | **正本 commit 候補** ✅ | Platform UI-3 precommit 最終チェック |

**削除候補:** なし（すべて `tmp-` 以外の永続テストスクリプト）

**保留:** Platform UI-3 スクリプト 3 本は **Platform 領域 PR と同梱** が自然（Builder スクリプトと混在 commit しない）

---

## 4. Modified Reports — 12 件分類

| ファイル | 分類 | 理由 |
| --- | --- | --- |
| `reports/builder-release-status.md` | **正本 commit 候補** ✅ | Builder release ステータス更新（+44/- 行） |
| `reports/company-mobile-audit-390.md` | **正本 commit 候補** ✅ | Company mobile 監査更新 |
| `reports/gemini-edge-diagnose.md` | **正本 commit 候補** ✅ | Gemini Edge 診断レポート更新 |
| `reports/platform-nb1m-frontend-prod-deploy-ready.md` | **正本 commit 候補** ✅ | Platform NB1M prod deploy ready |
| `reports/tlv-business-simulator/README.md` | **正本 commit 候補** ✅ | Ver2 Demo Payment Flow Complete 反映 |
| `reports/tlv-business-simulator/payout-engine-v2-implementation-phase.md` | **正本 commit 候補** ✅ | Ver2 実装フェーズ完了記録 |
| `reports/tlv-business-simulator/stripe-connect-payout-plan.md` | **正本 commit 候補** ✅ | Stripe Connect 送金プラン更新 |
| `reports/builder-dashboard-phase6h-1280.png` | **QA 証跡 commit 候補** 📸 | スクショ微更新（bin） |
| `reports/gate-d-smoke-last.json` | **保留** ⏸ | Gate D smoke **最終実行 JSON** · 再実行で上書きされやすい |
| `reports/gemini-edge-diagnose.json` | **保留** ⏸ | `.md` とペア · commit するなら **md+json 同梱** |
| `reports/tasful-ai-workspace-quota-edge-last.json` | **保留** ⏸ | quota 検証 last-run artifact（4 行差分） |
| `reports/tasful-ai-workspace-quota-production-compat.json` | **保留** ⏸ | 同上（8 行差分） |

---

## 5. deploy/cloudflare/dist/docs — 束 E 保留

| 内容 | 件数 | 判定 |
| --- | ---: | --- |
| `deploy/cloudflare/dist/docs/**` 正本ミラー | 18 | **build mirror · 束 E（領域別 build + dist stage）まで触らない** |
| `deploy/cloudflare/dist/sql/ai-workspace-usage-daily*.sql` | 2 | 同上 |
| `deploy/cloudflare/dist/chat-supabase-config.js` | 1 | 同上 |

---

## 6. 次に安全に commit できる小束（提案）

優先度順。**領域混在禁止 · ファイル個別 `git add`**。

### 束 F — P0-1 triage 正本（最小 · 最安全）✅ 推奨第 1

```
reports/working-tree-triage-after-tasful-ai-production-ready.md
```

- **Message 案:** `docs(repo): add working tree triage after tasful-ai production ready`
- **リスク:** 低 · 単一 markdown · 領域横断だが docs-only

### 束 G — diff-triage チェーン（7 件 · docs-only）

```
reports/gateway-diff-triage-after-secretary.md
reports/ops-common-diff-triage-after-gateway.md
reports/platform-diff-triage-after-builder.md
reports/talk-diff-triage-after-platform.md
reports/anpi-diff-triage-after-talk.md
reports/tlv-diff-triage-after-anpi.md
reports/ai-secretary-diff-triage-after-tlv.md
```

- **Message 案:** `docs(repo): archive domain diff triage chain`
- **リスク:** 低 · 調査正本のみ

### 束 H — AI 秘書 正本（4 件）

```
reports/secretary-deepseek-adapter-design.md
reports/secretary-deepseek-deploy-triage.md
reports/ai-secretary-text-chat-first.md
reports/ai-secretary-phase5-orchestrator-plan.md
```

- **Message 案:** `docs(secretary): archive deepseek and phase5 design reports`
- **リスク:** 低 · AI秘書凍結領域だが **docs/reports のみ**

### 束 I — Builder QA 証跡（15 ファイル）

```
reports/builder-ai-v2-final-polish/
reports/user-dashboard-builder-ai-card/
reports/builder-dashboard-phase6h-1280.png   # modified · 同 PR に含める場合
```

- **Message 案:** `test(builder): add builder-ai v2 final polish QA evidence`
- **リスク:** 中 · PNG 多 · Builder 凍結だが QA 証跡は許容範例あり
- **除外:** `builder-ai-v2-redesign/` は削除候補

### 束 J — Builder Live テスト scripts（2 件）

```
scripts/test-builder-ai-live-e2e.mjs
scripts/test-builder-ai-live-qa.mjs
```

- **Message 案:** `test(builder): add live gateway e2e and qa scripts`
- **リスク:** 低 · source scripts · Builder 領域単独

### 束 K — Platform UI-3 scripts + triage（5–7 件 · 別 PR）

```
scripts/verify-platform-ui3-batch1.mjs
scripts/verify-platform-ui3-batch2-b1.mjs
scripts/verify-platform-ui3-precommit.mjs
reports/platform-all-browser-failure-triage.md
reports/platform-all-browser-current-failures.md
reports/platform-nb1m-frontend-prod-deploy-ready.md   # modified
```

- **Message 案:** `test(platform): add ui3 verification scripts and browser triage`
- **リスク:** 中 · Platform 領域単独 PR

### 束 L — TASFUL AI / Gateway 調査（任意）

```
reports/gemini-billing-recovery.md
reports/gemini-edge-diagnose.md          # modified
reports/gemini-edge-diagnose.json        # modified · md と同梱
reports/voice-5d1b-manual-verify/
```

- **Message 案:** `docs(tasful-ai): archive billing recovery and voice verify evidence`
- **保留:** quota JSON 2 件 · `tasful-ai-current-status.md`（supersede 判断後）

### 束 M — TLV Business Simulator docs（3 modified）

```
reports/tlv-business-simulator/README.md
reports/tlv-business-simulator/payout-engine-v2-implementation-phase.md
reports/tlv-business-simulator/stripe-connect-payout-plan.md
```

- **Message 案:** `docs(tlv): record ver2 demo payment flow completion`
- **リスク:** 低 · TLV シミュレータ docs のみ

---

## 7. 削除推奨（束 D 続き · commit 不要）

```
reports/web-search-brave-ja-compare.json
reports/builder-ai-v2-redesign/
```

---

## 8. 集計

| 分類 | untracked reports | untracked scripts | modified reports |
| --- | ---: | ---: | ---: |
| **正本 commit 候補** | 16 | 5 | 7 |
| **QA 証跡 commit 候補** | 19（3 dir） | — | 1 |
| **tmp/debug 削除候補** | 5（1 json + 1 dir） | — | — |
| **重複 / 吸収済み** | 1 | — | — |
| **保留** | 1 + 1 注記 | — | 4 |

---

## 9. 参照

- `reports/working-tree-triage-after-tasful-ai-production-ready.md`（束 A–E 原案）
- HEAD 履歴: `56abe78`（束 A）· `8673fb1`（束 B）· `8ad47e7`（束 C）
- `.cursor/rules/qa.mdc` — 8788 検証 · file:// 禁止
