# AI秘書（admin-*）差分棚卸し（TLV 完了後）

**実施日:** 2026-06-26  
**HEAD:** `27ecb18` — `build(tlv): sync Pages dist for live modules and payout assets`  
**作業種別:** 調査・分類のみ（コード変更 / stage / commit なし）

---

## 1. git status 概要

| 区分 | 件数 | 備考 |
|------|------|------|
| 全体 `M`（tracked 変更） | **26** | AI秘書直結は **7**（source 1 + dist 6） |
| 全体 `??`（未追跡） | **~90+** | secretary phase dist 初回同梱・supabase-ops・Voice・site CSS 混在 |
| **AI秘書 source `M`** | **1** | `ai-ops-case-store.js` のみ |
| **AI秘書 root admin-* `M`** | **0** | `admin-operations-dashboard.*` · `admin-ai-secretary-*` · `admin-ai-daily-inbox.js` 等は **HEAD と一致** |
| **AI秘書 dist `M`** | **6** | dashboard 3 + daily-inbox + morning-summary + ai-ops-case-store |
| **AI秘書 dist `??`** | **9** | `admin-ai-secretary-modes.js` 〜 `phase8` + `voice` |
| **AI秘書 test/scripts `M`** | **0** | 変更なし |
| **AI秘書 reports `M`** | **0** | `??` に `reports/ai-secretary-text-chat-first.md` |

`git diff --stat` 全体: **26 files, +4067 / -570**（AI秘書 dist が **+3405 行** 相当 · `admin-operations-dashboard.css` +2842 が大半）

### 直近コミット（TLV 完了済み）

```
27ecb18 build(tlv): sync Pages dist for live modules and payout assets
f91b202 build(anpi): sync Pages dist for anpi auth wiring
b655014 build(talk): sync Pages dist for talk modules and chat gate
```

### AI秘書 source 既コミット（参考）

```
e08f394 feat(secretary): add text chat phases for ops room and command center
ba55103 fix(secretary): restore AI secretary critical navigation paths
```

**結論:** 機能本体は source 済み。**未コミットは `ai-ops-case-store.js` 1件 + dist 同期遅れ。**

---

## 2. AI秘書候補一覧

### 2-1. パターン抽出（`git diff --name-status` · 7件）

| 状態 | パス |
|------|------|
| M | `ai-ops-case-store.js` |
| M | `deploy/cloudflare/dist/admin-ai-daily-inbox.js` |
| M | `deploy/cloudflare/dist/admin-ai-morning-summary.js` |
| M | `deploy/cloudflare/dist/admin-operations-dashboard.css` |
| M | `deploy/cloudflare/dist/admin-operations-dashboard.html` |
| M | `deploy/cloudflare/dist/admin-operations-dashboard.js` |
| M | `deploy/cloudflare/dist/ai-ops-case-store.js` |

### 2-2. パターン抽出（`git status --short` · 追加 `??`）

| 状態 | パス |
|------|------|
| ?? | `deploy/cloudflare/dist/admin-ai-secretary-modes.js` |
| ?? | `deploy/cloudflare/dist/admin-ai-secretary-phase2.js` |
| ?? | `deploy/cloudflare/dist/admin-ai-secretary-phase3.js` |
| ?? | `deploy/cloudflare/dist/admin-ai-secretary-phase4.js` |
| ?? | `deploy/cloudflare/dist/admin-ai-secretary-phase5.js` |
| ?? | `deploy/cloudflare/dist/admin-ai-secretary-phase6.js` |
| ?? | `deploy/cloudflare/dist/admin-ai-secretary-phase7.js` |
| ?? | `deploy/cloudflare/dist/admin-ai-secretary-phase8.js` |
| ?? | `deploy/cloudflare/dist/admin-ai-secretary-voice.js` |
| ?? | `reports/ai-secretary-text-chat-first.md` |

### 2-3. source 差分の中身

**`ai-ops-case-store.js`（+3行）**

```javascript
if (plan.resolved) {
  global.TasuAdminAiDailyInbox?.completeInboxItem?.(`inbox_aiops_${caseId}`);
}
```

ケース解決時に **daily inbox 完了連携** — `admin-ai-daily-inbox.js` dist 更新とセット。

**root `admin-*`:** 差分なし（`e08f394` 等でコミット済み）。

### 2-4. dist 差分テーマ

| テーマ | ファイル | 概要 |
|--------|----------|------|
| **Phase 7 机 UI / command center** | `admin-operations-dashboard.html` (+316) | `ops-ai-command-center` · morning summary · daily inbox · phase2–8 chat UI |
| **机スタイル** | `admin-operations-dashboard.css` (+2842) | Phase 7 desk · inbox · chat composer 等の大規模 CSS |
| **ダッシュボード JS** | `admin-operations-dashboard.js` (+217) | 秘書 phase 連携・ナビ更新 |
| **Daily inbox** | `admin-ai-daily-inbox.js` (+74/-7) | inbox 完了 API · case store 連携 |
| **Morning summary** | `admin-ai-morning-summary.js` (+4) | 軽微更新 |
| **Case store ミラー** | `ai-ops-case-store.js` (+3) | source 同期 |
| **Secretary phase 初回 dist** | `admin-ai-secretary-*.js` ×9 (`??`) | modes + phase2–8 + voice |

### 2-5. dist 既存資産（変更なし · 参考）

`deploy/cloudflare/dist/admin-ai-*` は **17 ファイル追跡済み**（action-board, automation-engine, ops-watch, kpi-center 等）。今回の未コミットは上記 **6 M + 9 ??** のみ。

---

## 3. 分類表

### A. AI秘書 source（1件）

```
ai-ops-case-store.js
```

### B. AI秘書 dist（15件）

**変更あり（6）:**

```
deploy/cloudflare/dist/admin-operations-dashboard.css
deploy/cloudflare/dist/admin-operations-dashboard.html
deploy/cloudflare/dist/admin-operations-dashboard.js
deploy/cloudflare/dist/admin-ai-daily-inbox.js
deploy/cloudflare/dist/admin-ai-morning-summary.js
deploy/cloudflare/dist/ai-ops-case-store.js
```

**初回同梱（9）:**

```
deploy/cloudflare/dist/admin-ai-secretary-modes.js
deploy/cloudflare/dist/admin-ai-secretary-phase2.js
deploy/cloudflare/dist/admin-ai-secretary-phase3.js
deploy/cloudflare/dist/admin-ai-secretary-phase4.js
deploy/cloudflare/dist/admin-ai-secretary-phase5.js
deploy/cloudflare/dist/admin-ai-secretary-phase6.js
deploy/cloudflare/dist/admin-ai-secretary-phase7.js
deploy/cloudflare/dist/admin-ai-secretary-phase8.js
deploy/cloudflare/dist/admin-ai-secretary-voice.js
```

### C. AI秘書 test/scripts（0件 · 変更なし）

代表スイート（検証用 · コミット対象外）:

- `scripts/test-admin-operations-dashboard-browser.mjs`
- `scripts/test-admin-ai-secretary-text-chat-browser.mjs`
- `scripts/test-admin-ai-daily-inbox-browser.mjs`
- `scripts/test-morning-summary-jump.mjs`
- `scripts/test-admin-ai-ops-watch-browser.mjs`
- `scripts/review-admin-ai-full-system.mjs`

### D. AI秘書 reports/docs（1件 · 未追跡）

| パス | 状態 | 分類 |
|------|------|------|
| `reports/ai-secretary-text-chat-first.md` | `??` | AI秘書設計メモ · dist コミット外 |
| `deploy/cloudflare/dist/docs/ai-secretary-trend-scout-backlog.md` | `??` | docs ビルドコピー · 任意 |

### E. Gateway 共通（AI秘書コミットに混ぜない）

| ファイル | 状態 | 理由 |
|----------|------|------|
| `deploy/cloudflare/dist/ai-model-gateway.js` | M (+79) | TASFUL AI Workspace · attachments mock · **AD-005 Gateway トラック** |
| `ai-model-gateway.js` (root) | クリーン | dist のみ未同期 |

`admin-operations-dashboard.html` は `ai-model-gateway.js` を読込むが、**Gateway 変更は別コミット**。

### F. Voice 共通（混ぜない）

| ファイル | 状態 | 分類 |
|----------|------|------|
| `deploy/cloudflare/dist/voice-settings.*` | `??` ×3 | **Voice 設定 UI トラック** |
| `deploy/cloudflare/dist/tasful-ai-voice-core.js` | 追跡済み・クリーン | 秘書 voice 連携の依存 · Voice 本体ではない |
| `admin-ai-secretary-voice.js` | dist `??` | **AI秘書トラック**（`voice-settings` とは別） |

### G. supabase-ops / platform-ops 共通（混ぜない）

パターン `ops` でヒットするが **AI秘書単独コミット外**:

| パス | 状態 | 理由 |
|------|------|------|
| `deploy/cloudflare/dist/supabase-ops-*` | `??` ×10 | supabase-ops トラック |
| `deploy/cloudflare/dist/platform-ops-*` | `??` ×4 | Platform OPS トラック |
| `deploy/cloudflare/dist/support-*` | `??` 多数 | サポートセンター · dashboard からリンクされるが別モジュール |

**依存注意:** `admin-operations-dashboard.html` は `supabase-ops-*`（10本）・`platform-ops-*`（4本）・`support-ticket-*` を script 読込。**dist git 未同梱のため、秘書 dist のみデプロイすると 404 リスクあり。** 運用上は supabase-ops / platform-ops を先に dist 同期するか、同一デプロイで順次コミットが必要。

### H. Platform / Talk / ANPI / TLV 誤検出

| 項目 | 判定 |
|------|------|
| `deploy/cloudflare/dist/live/tlv-feature-flags.js` | M · **TLV ビルド生成物** |
| `talk-ops-assistant.js` 等 | diff なし · Talk dist 済 |
| `platform-content-gate*` | diff なし · Platform dist 済 |

### I. 判断不能 / 隣接

| 項目 | 判断 |
|------|------|
| `deploy/cloudflare/dist/chat-supabase-config.js` | デプロイ生成 · dashboard 参照 · Platform/supabase |
| `scripts/tmp-channel-*` | TLV テスト成果物 · AI秘書外 |
| `reports/gemini-*` · `builder-release-status.md` | パターン `case` 非該当 · 別トラック |

---

## 4. 必須確認ファイルの結果

| 確認対象 | 結果 |
|----------|------|
| `admin-operations-dashboard.*` | dist **M** 3件 · source クリーン |
| `admin-ai-*` secretary phase | dist **??** 9件 · source 追跡済み |
| `admin-ops-*` | 該当ファイル名なし |
| `ai-ops-case-store.js` | source + dist **M**（inbox 完了連携） |
| `admin-ai-daily-inbox.js` / `morning-summary` | dist **M** |
| `ops-watch` | `admin-ai-ops-watch.js` dist 追跡済み・**diff なし** |
| `deploy/cloudflare/dist/admin-*` | 上記 15件が未コミット核心 |
| `deploy/cloudflare/dist/ai-ops-*` | `ai-ops-case-store.js` のみ M |

---

## 5. Go / No-Go 判定

| 質問 | 判定 | 根拠 |
|------|------|------|
| AI秘書 source だけ先に切れるか | **Go** | `ai-ops-case-store.js` 1件 · inbox 連携のみ |
| dist は別コミットにすべきか | **Go（推奨）** | TLV/ANPI 同パターン · `npm run build:pages` 後に admin-* のみ stage |
| Gateway / Voice / supabase-ops と分離できるか | **Go（stage 選別で）** | パターン誤検出分は除外可能 |
| reports は別コミットにすべきか | **Go（任意）** | `ai-secretary-text-chat-first.md` は docs トラック |
| AI秘書単独コミットとして安全か | **Go（条件付き）** | stage は `admin-*` + `ai-ops-case-store.js` のみ。dashboard 実行には **supabase-ops / platform-ops dist 同梱が別途必要** |

**No-Go 条件:**

- `ai-model-gateway.js` を秘書コミットに含める
- `git add deploy/cloudflare/dist/admin-*` で `admin-operations-dashboard` 以外の誤パスなし — **`admin-ai-secretary-*` と `admin-ai-daily-inbox` 等のみ**（`admin-ai-action-board.js` 等は diff なしのため stage されない）
- `voice-settings.*` / `supabase-ops-*` / `platform-ops-*` 混入

**RELEASE FROZEN 注記:** AI 秘書 v1.1 凍結済み。今回は **inbox 完了連携 + dist 同期**（Critical/仕様追従）と解釈可能。

---

## 6. 推奨コミット単位

### Commit 1 — source

```
feat(secretary): complete daily inbox item when ai-ops case resolves
```

**Stage（1）:**

```
ai-ops-case-store.js
```

### Commit 2 — dist（source 後 + `npm run build:pages`）

```
build(secretary): sync Pages dist for ops dashboard and secretary phases
```

**Stage 候補（15）:**

```
git add ai-ops-case-store.js
git add deploy/cloudflare/dist/admin-operations-dashboard.css
git add deploy/cloudflare/dist/admin-operations-dashboard.html
git add deploy/cloudflare/dist/admin-operations-dashboard.js
git add deploy/cloudflare/dist/admin-ai-daily-inbox.js
git add deploy/cloudflare/dist/admin-ai-morning-summary.js
git add deploy/cloudflare/dist/admin-ai-secretary-modes.js
git add deploy/cloudflare/dist/admin-ai-secretary-phase2.js
git add deploy/cloudflare/dist/admin-ai-secretary-phase3.js
git add deploy/cloudflare/dist/admin-ai-secretary-phase4.js
git add deploy/cloudflare/dist/admin-ai-secretary-phase5.js
git add deploy/cloudflare/dist/admin-ai-secretary-phase6.js
git add deploy/cloudflare/dist/admin-ai-secretary-phase7.js
git add deploy/cloudflare/dist/admin-ai-secretary-phase8.js
git add deploy/cloudflare/dist/admin-ai-secretary-voice.js
```

または:

```
git add deploy/cloudflare/dist/admin-operations-dashboard.*
git add deploy/cloudflare/dist/admin-ai-daily-inbox.js
git add deploy/cloudflare/dist/admin-ai-morning-summary.js
git add deploy/cloudflare/dist/admin-ai-secretary-*.js
git add deploy/cloudflare/dist/ai-ops-case-store.js
```

**Stage 前確認:** `git diff --cached --name-status` が上記パターンのみ。

**含めない:**

- `deploy/cloudflare/dist/ai-model-gateway.js`
- `voice-settings.*` / `supabase-ops-*` / `platform-ops-*` / `support-*`
- `live/**` / TLV / Talk / ANPI / Platform 残差分
- `chat-supabase-config.js`（ビルド生成）

### Commit 3（任意）— reports

```
docs(secretary): add text chat first design note
```

---

## 7. 推奨テスト

**source コミット前後:**

```bash
BASE_URL=http://127.0.0.1:8788 node scripts/test-admin-ai-daily-inbox-browser.mjs
```

**dist コミット前後:**

```bash
npm run build:pages
BASE_URL=http://127.0.0.1:8788 node scripts/test-admin-operations-dashboard-browser.mjs
BASE_URL=http://127.0.0.1:8788 node scripts/test-admin-ai-secretary-text-chat-browser.mjs
BASE_URL=http://127.0.0.1:8788 node scripts/test-morning-summary-jump.mjs
BASE_URL=http://127.0.0.1:8788 node scripts/test-admin-ai-ops-watch-browser.mjs
BASE_URL=http://127.0.0.1:8788 node scripts/review-admin-ai-full-system.mjs
```

**本番 dist 整合（任意）:**

```bash
node scripts/review-admin-ai-production-connectivity.mjs
```

---

## 8. 注意点

1. **dist-only が主戦場:** root `admin-ai-secretary-phase*.js` は既コミット。dist に **9 ファイル初回同梱** が必要。
2. **dashboard 依存グラフが広い:** HTML が supabase-ops / platform-ops / support / Gateway を読込。秘書 dist 単独では **Pages 上で一部 script 404** の可能性。後続トラックで `supabase-ops-*` · `platform-ops-*` dist を別コミットする計画を推奨。
3. **`admin-operations-dashboard.css` +2842 行:** 今回 dist 同期のボリューム中心。誤 stage 防止のため **ファイル名明示 add** 推奨。
4. **Gateway dist `M` は別物:** attachments mock 拡張 · TASFUL AI Workspace 用。
5. **`admin-ai-secretary-voice.js` ≠ `voice-settings.*`:** 前者は秘書トラック、後者は Voice 設定 UI。
6. **誤 stage リスク:** `admin-operations-dashboard.css` だけでも 2800+ 行。`git diff --cached` 必須（AD-007）。

---

## 9. 件数サマリ（報告用）

| # | 区分 | 件数 |
|---|------|------|
| ① | AI秘書 source | **1**（`ai-ops-case-store.js`） |
| ② | AI秘書 dist | **15**（M 6 + ?? 9） |
| ③ | test/scripts（変更） | **0** |
| ④ | reports/docs | **1**（`??` · `reports/ai-secretary-text-chat-first.md`） |
| ⑤ | 共通基盤 | **Gateway 1** · **Voice 3** · **supabase-ops 10** · **platform-ops 4** · **support 10+** · **TLV flags 1** · chat-supabase 1 |
